import { NextRequest, NextResponse } from 'next/server';
import lighthouse from '@lighthouse-web3/sdk';

// No timeout limits on AWS EC2
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

async function uploadToLighthouse(file: File, apiKey: string): Promise<{ cid: string; provider: string }> {
    // Convert File to Buffer for the SDK
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[Upload] Lighthouse SDK: uploading ${file.name} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)...`);

    const result = await lighthouse.uploadBuffer(buffer, apiKey, file.name);

    if (!result?.data?.Hash) {
        throw new Error('Lighthouse SDK returned no hash');
    }

    return { cid: result.data.Hash, provider: 'lighthouse' };
}

async function uploadToPinata(file: File, apiKey: string, secretKey: string): Promise<{ cid: string; provider: string }> {
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
    return { cid: result.IpfsHash, provider: 'pinata' };
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // 2GB max
        if (file.size > 2 * 1024 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large. Maximum size is 2GB.' }, { status: 400 });
        }

        const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
        console.log(`[Upload] Starting: ${file.name} (${fileSizeMB} MB)`);

        const lighthouseApiKey = process.env.LIGHTHOUSE_API_KEY;
        const pinataApiKey = process.env.PINATA_API_KEY;
        const pinataSecretKey = process.env.PINATA_SECRET_KEY;

        const errors: string[] = [];
        let result: { cid: string; provider: string } | null = null;

        // Try Lighthouse first (supports up to 2GB via SDK)
        if (lighthouseApiKey) {
            try {
                result = await uploadToLighthouse(file, lighthouseApiKey);
                console.log(`[Upload] Lighthouse success: ${result.cid}`);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error('[Upload] Lighthouse failed:', msg);
                errors.push(`Lighthouse: ${msg}`);
            }
        }

        // Fallback to Pinata if Lighthouse failed
        if (!result && pinataApiKey && pinataSecretKey) {
            if (file.size > 100 * 1024 * 1024) {
                errors.push(`Pinata: File too large (${fileSizeMB}MB > 100MB free tier limit)`);
            } else {
                try {
                    result = await uploadToPinata(file, pinataApiKey, pinataSecretKey);
                    console.log(`[Upload] Pinata success: ${result.cid}`);
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    console.error('[Upload] Pinata failed:', msg);
                    errors.push(`Pinata: ${msg}`);
                }
            }
        }

        // No providers configured
        if (!lighthouseApiKey && !pinataApiKey) {
            return NextResponse.json({
                error: 'No IPFS provider configured. Set LIGHTHOUSE_API_KEY or PINATA_API_KEY in .env',
            }, { status: 503 });
        }

        // All providers failed
        if (!result) {
            console.error('[Upload] All providers failed:', errors);
            return NextResponse.json({
                error: `Upload failed. ${errors.join('. ')}`,
            }, { status: 500 });
        }

        const ipfsUri = `ipfs://${result.cid}`;
        const gatewayUrl = result.provider === 'lighthouse'
            ? `https://gateway.lighthouse.storage/ipfs/${result.cid}`
            : `https://gateway.pinata.cloud/ipfs/${result.cid}`;

        console.log(`[Upload] Complete via ${result.provider}: ${ipfsUri}`);

        return NextResponse.json({
            success: true,
            ipfsUri,
            gatewayUrl,
            cid: result.cid,
            provider: result.provider,
            fileName: file.name,
            fileSize: file.size,
        });

    } catch (error) {
        console.error('[Upload] Unexpected error:', error);
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: `Upload failed: ${msg}` }, { status: 500 });
    }
}
