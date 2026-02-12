import { NextRequest, NextResponse } from 'next/server';
import lighthouse from '@lighthouse-web3/sdk';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

// No timeout limits on AWS EC2
export const maxDuration = 600; // 10 minutes for very large files
export const dynamic = 'force-dynamic';

const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

async function uploadToLighthouse(filePath: string, apiKey: string, fileName: string): Promise<string> {
    console.log(`[Upload] Lighthouse SDK: uploading ${fileName} from disk...`);

    const result = await lighthouse.upload(
        filePath,
        apiKey,
        undefined, // no deal params
        undefined, // cidVersion default
        (progressData: any) => {
            if (progressData?.progress) {
                console.log(`[Upload] Lighthouse progress: ${progressData.progress}%`);
            }
        }
    );

    // Result can be { data: { Name, Hash, Size } } or { data: [{ Name, Hash, Size }] }
    const data = Array.isArray(result?.data) ? result.data[0] : result?.data;

    if (!data?.Hash) {
        console.error('[Upload] Lighthouse result:', JSON.stringify(result));
        throw new Error('Lighthouse SDK returned no hash');
    }

    console.log(`[Upload] Lighthouse success: ${data.Hash}`);
    return data.Hash;
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

    console.log(`[Upload] Pinata success: ${result.IpfsHash}`);
    return result.IpfsHash;
}

export async function POST(request: NextRequest) {
    let tempFilePath: string | null = null;

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (file.size > 2 * 1024 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large. Maximum size is 2GB.' }, { status: 400 });
        }

        const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
        console.log(`[Upload] Starting: ${file.name} (${fileSizeMB} MB)`);

        const lighthouseApiKey = process.env.LIGHTHOUSE_API_KEY;
        const pinataApiKey = process.env.PINATA_API_KEY;
        const pinataSecretKey = process.env.PINATA_SECRET_KEY;

        if (!lighthouseApiKey && !pinataApiKey) {
            return NextResponse.json({
                error: 'No IPFS provider configured. Set LIGHTHOUSE_API_KEY or PINATA_API_KEY in .env',
            }, { status: 503 });
        }

        const errors: string[] = [];
        let cid: string | null = null;
        let provider = '';

        // For Lighthouse: save file to disk first, then upload from path
        // This avoids holding 2GB+ in memory as a Buffer
        if (lighthouseApiKey) {
            try {
                // Save to temp file
                const tempDir = join(tmpdir(), 'tbp-uploads');
                await mkdir(tempDir, { recursive: true });

                const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                tempFilePath = join(tempDir, `${randomUUID()}_${safeFileName}`);

                console.log(`[Upload] Writing to temp file: ${tempFilePath}`);
                const arrayBuffer = await file.arrayBuffer();
                await writeFile(tempFilePath, Buffer.from(arrayBuffer));
                console.log(`[Upload] Temp file written, starting Lighthouse upload...`);

                cid = await uploadToLighthouse(tempFilePath, lighthouseApiKey, file.name);
                provider = 'lighthouse';
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error('[Upload] Lighthouse failed:', msg);
                errors.push(`Lighthouse: ${msg}`);
            }
        }

        // Fallback to Pinata for smaller files
        if (!cid && pinataApiKey && pinataSecretKey) {
            if (file.size > 100 * 1024 * 1024) {
                errors.push(`Pinata: File too large (${fileSizeMB}MB > 100MB free tier limit)`);
            } else {
                try {
                    cid = await uploadToPinata(file, pinataApiKey, pinataSecretKey);
                    provider = 'pinata';
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    console.error('[Upload] Pinata failed:', msg);
                    errors.push(`Pinata: ${msg}`);
                }
            }
        }

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

        console.log(`[Upload] Complete via ${provider}: ${ipfsUri}`);

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
    } finally {
        // Always clean up temp file
        if (tempFilePath) {
            try {
                await unlink(tempFilePath);
                console.log(`[Upload] Temp file cleaned up`);
            } catch {
                // ignore cleanup errors
            }
        }
    }
}
