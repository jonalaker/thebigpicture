import { NextRequest, NextResponse } from 'next/server';

// No timeout limits on AWS EC2 — upload server-side directly
export const maxDuration = 300; // 5 minutes (only matters if deployed elsewhere)
export const dynamic = 'force-dynamic';

const LIGHTHOUSE_API_URL = 'https://node.lighthouse.storage/api/v0/add';
const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // 2GB max on EC2
        const maxSize = 2 * 1024 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: 'File too large. Maximum size is 2GB.' },
                { status: 400 }
            );
        }

        console.log(`[Upload] Starting: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

        // Try Lighthouse first, then Pinata as fallback
        const lighthouseApiKey = process.env.LIGHTHOUSE_API_KEY;
        const pinataApiKey = process.env.PINATA_API_KEY;
        const pinataSecretKey = process.env.PINATA_SECRET_KEY;

        let cid: string;
        let provider: string;

        if (lighthouseApiKey) {
            // Upload to Lighthouse (supports up to 2GB)
            provider = 'lighthouse';
            const uploadFormData = new FormData();
            uploadFormData.append('file', file);

            const response = await fetch(LIGHTHOUSE_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${lighthouseApiKey}`,
                },
                body: uploadFormData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Upload] Lighthouse error:', errorText);
                throw new Error(`Lighthouse upload failed: ${response.status}`);
            }

            const result = await response.json();
            cid = result.Hash;

        } else if (pinataApiKey && pinataSecretKey) {
            // Fallback to Pinata
            provider = 'pinata';

            // Pinata limit: 100MB
            if (file.size > 100 * 1024 * 1024) {
                return NextResponse.json({
                    error: 'File too large for Pinata (100MB max). Configure LIGHTHOUSE_API_KEY for files up to 2GB.',
                }, { status: 400 });
            }

            const uploadFormData = new FormData();
            uploadFormData.append('file', file);
            uploadFormData.append('pinataMetadata', JSON.stringify({
                name: file.name,
                keyvalues: {
                    uploadedAt: new Date().toISOString(),
                    source: 'thebigpicture',
                }
            }));
            uploadFormData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

            const response = await fetch(PINATA_API_URL, {
                method: 'POST',
                headers: {
                    'pinata_api_key': pinataApiKey,
                    'pinata_secret_api_key': pinataSecretKey,
                },
                body: uploadFormData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Upload] Pinata error:', errorText);
                throw new Error(`Pinata upload failed: ${response.status}`);
            }

            const result = await response.json();
            cid = result.IpfsHash;

        } else {
            return NextResponse.json({
                error: 'No IPFS provider configured. Set LIGHTHOUSE_API_KEY or PINATA_API_KEY in environment.',
            }, { status: 503 });
        }

        if (!cid) {
            return NextResponse.json(
                { error: 'Upload succeeded but no CID was returned' },
                { status: 500 }
            );
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
        console.error('[Upload] Error:', error);
        const msg = error instanceof Error ? error.message : 'Unknown error';

        return NextResponse.json(
            { error: `Upload failed: ${msg}` },
            { status: 500 }
        );
    }
}
