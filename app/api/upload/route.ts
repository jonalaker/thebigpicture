import { NextRequest, NextResponse } from 'next/server';

// Pinata API endpoint
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

        // Check file size (max 100MB)
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: 'File too large. Maximum size is 100MB.' },
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
            }
        });
        pinataFormData.append('pinataMetadata', metadata);

        // Optional: Pin options
        const options = JSON.stringify({
            cidVersion: 1,
        });
        pinataFormData.append('pinataOptions', options);

        // Upload to Pinata
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
        return NextResponse.json(
            { error: 'Failed to process upload' },
            { status: 500 }
        );
    }
}
