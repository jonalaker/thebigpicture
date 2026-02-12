import { NextRequest, NextResponse } from 'next/server';

// No timeout limits on AWS EC2
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const LIGHTHOUSE_API_URL = 'https://node.lighthouse.storage/api/v0/add';
const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

async function uploadToLighthouse(file: File, apiKey: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
        const response = await fetch(LIGHTHOUSE_API_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            body: formData,
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Lighthouse error ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        if (!result.Hash) throw new Error('No Hash in Lighthouse response');
        return result.Hash;
    } finally {
        clearTimeout(timeout);
    }
}

async function uploadToPinata(file: File, apiKey: string, secretKey: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('pinataMetadata', JSON.stringify({
        name: file.name,
        keyvalues: {
            uploadedAt: new Date().toISOString(),
            source: 'thebigpicture',
        }
    }));
    formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

    const response = await fetch(PINATA_API_URL, {
        method: 'POST',
        headers: {
            'pinata_api_key': apiKey,
            'pinata_secret_api_key': secretKey,
        },
        body: formData,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinata error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    if (!result.IpfsHash) throw new Error('No IpfsHash in Pinata response');
    return result.IpfsHash;
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
        console.log(`[Upload] Starting: ${file.name} (${fileSizeMB} MB)`);

        const lighthouseApiKey = process.env.LIGHTHOUSE_API_KEY;
        const pinataApiKey = process.env.PINATA_API_KEY;
        const pinataSecretKey = process.env.PINATA_SECRET_KEY;

        let cid: string | null = null;
        let provider: string = '';
        const errors: string[] = [];

        // Try Pinata first (more reliable connectivity)
        if (pinataApiKey && pinataSecretKey) {
            // Pinata free tier: 100MB limit
            if (file.size <= 100 * 1024 * 1024) {
                try {
                    console.log('[Upload] Trying Pinata...');
                    cid = await uploadToPinata(file, pinataApiKey, pinataSecretKey);
                    provider = 'pinata';
                    console.log(`[Upload] Pinata success: ${cid}`);
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    console.error('[Upload] Pinata failed:', msg);
                    errors.push(`Pinata: ${msg}`);
                }
            } else {
                errors.push(`Pinata: File too large (${fileSizeMB}MB > 100MB limit)`);
            }
        }

        // Try Lighthouse as fallback (or primary for large files)
        if (!cid && lighthouseApiKey) {
            // Lighthouse: 2GB limit
            if (file.size <= 2 * 1024 * 1024 * 1024) {
                try {
                    console.log('[Upload] Trying Lighthouse...');
                    cid = await uploadToLighthouse(file, lighthouseApiKey);
                    provider = 'lighthouse';
                    console.log(`[Upload] Lighthouse success: ${cid}`);
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    console.error('[Upload] Lighthouse failed:', msg);
                    errors.push(`Lighthouse: ${msg}`);
                }
            }
        }

        // If neither is configured
        if (!pinataApiKey && !lighthouseApiKey) {
            return NextResponse.json({
                error: 'No IPFS provider configured. Set PINATA_API_KEY + PINATA_SECRET_KEY or LIGHTHOUSE_API_KEY in .env',
            }, { status: 503 });
        }

        // If all providers failed
        if (!cid) {
            console.error('[Upload] All providers failed:', errors);
            return NextResponse.json({
                error: `Upload failed. ${errors.join('. ')}`,
            }, { status: 500 });
        }

        const ipfsUri = `ipfs://${cid}`;
        const gatewayUrl = provider === 'lighthouse'
            ? `https://gateway.lighthouse.storage/ipfs/${cid}`
            : `https://gateway.pinata.cloud/ipfs/${cid}`;

        console.log(`[Upload] Success via ${provider}: ${ipfsUri}`);

        return NextResponse.json({
            success: true,
            ipfsUri,
            gatewayUrl,
            cid,
            provider,
            fileName: file.name,
            fileSize: file.size,
        });

    } catch (error) {
        console.error('[Upload] Unexpected error:', error);
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: `Upload failed: ${msg}` }, { status: 500 });
    }
}
