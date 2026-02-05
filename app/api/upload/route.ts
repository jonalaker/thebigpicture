import { NextRequest, NextResponse } from 'next/server';

// Pinata API endpoint
const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

// Route segment config for App Router (Next.js 13+)
// These must be individual exports
export const maxDuration = 120; // 2 minutes max execution time
export const dynamic = 'force-dynamic';

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

        // Check file size (max 50MB - reasonable for serverless)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: 'File too large. Maximum size is 50MB for uploads.' },
                { status: 400 }
            );
        }

        // Get Pinata API keys from environment
        const pinataApiKey = process.env.PINATA_API_KEY;
        const pinataSecretKey = process.env.PINATA_SECRET_KEY;

        if (!pinataApiKey || !pinataSecretKey) {
            return NextResponse.json({
                error: 'IPFS upload not configured. Please set PINATA_API_KEY and PINATA_SECRET_KEY in environment variables.',
                instructions: 'Get your free API keys at https://pinata.cloud (1GB free storage)',
            }, { status: 503 });
        }

        // Create form data for Pinata
        const pinataFormData = new FormData();
        pinataFormData.append('file', file);

        // Add metadata
        const metadata = JSON.stringify({
            name: file.name,
            keyvalues: {
                uploadedAt: new Date().toISOString(),
                source: 'thebigpicture-bounties',
                fileSize: file.size.toString(),
            }
        });
        pinataFormData.append('pinataMetadata', metadata);

        // Pin options
        const options = JSON.stringify({
            cidVersion: 1,
        });
        pinataFormData.append('pinataOptions', options);

        // Upload to Pinata
        console.log(`Uploading file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

        const response = await fetch(PINATA_API_URL, {
            method: 'POST',
            headers: {
                'pinata_api_key': pinataApiKey,
                'pinata_secret_api_key': pinataSecretKey,
            },
            body: pinataFormData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Pinata error:', errorText);
            return NextResponse.json(
                { error: 'Failed to upload to IPFS. Please try again.' },
                { status: 500 }
            );
        }

        const result = await response.json();
        const cid = result.IpfsHash;

        if (!cid) {
            return NextResponse.json(
                { error: 'Failed to get CID from upload' },
                { status: 500 }
            );
        }

        const ipfsUri = `ipfs://${cid}`;
        const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;

        console.log(`Upload successful: ${ipfsUri}`);

        return NextResponse.json({
            success: true,
            ipfsUri,
            gatewayUrl,
            cid,
            fileName: file.name,
            fileSize: file.size,
        });

    } catch (error) {
        console.error('Upload error:', error);

        // Check for specific error types
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
            return NextResponse.json({
                error: 'Upload timed out. Please try with a smaller file or try again.',
            }, { status: 408 });
        }

        if (errorMessage.includes('fetch failed') || errorMessage.includes('network')) {
            return NextResponse.json({
                error: 'Connection to IPFS service failed. Please try again.',
            }, { status: 503 });
        }

        return NextResponse.json(
            { error: 'Failed to process upload. Please try again.' },
            { status: 500 }
        );
    }
}
