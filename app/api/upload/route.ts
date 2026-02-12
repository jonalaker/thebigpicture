import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Server only provides the upload config — browser uploads directly to Lighthouse
export async function GET() {
    try {
        const lighthouseApiKey = process.env.LIGHTHOUSE_API_KEY;

        if (lighthouseApiKey) {
            return NextResponse.json({
                provider: 'lighthouse',
                apiKey: lighthouseApiKey,
                uploadUrl: 'https://upload.lighthouse.storage/api/v0/add',
                maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
            });
        }

        const pinataApiKey = process.env.PINATA_API_KEY;
        const pinataSecretKey = process.env.PINATA_SECRET_KEY;

        if (pinataApiKey && pinataSecretKey) {
            return NextResponse.json({
                provider: 'pinata',
                apiKey: pinataApiKey,
                secretKey: pinataSecretKey,
                uploadUrl: 'https://api.pinata.cloud/pinning/pinFileToIPFS',
                maxFileSize: 100 * 1024 * 1024, // 100MB
            });
        }

        return NextResponse.json(
            { error: 'No IPFS provider configured' },
            { status: 503 }
        );
    } catch (error) {
        console.error('[Upload Config] Error:', error);
        return NextResponse.json(
            { error: 'Failed to get upload config' },
            { status: 500 }
        );
    }
}
