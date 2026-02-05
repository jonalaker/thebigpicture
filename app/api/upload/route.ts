import { NextRequest, NextResponse } from 'next/server';

// Pinata API endpoint
const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

// Increase timeout for large files
const UPLOAD_TIMEOUT = 120000; // 2 minutes

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

        // Check file size (max 100MB for Pinata)
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
                fileSize: file.size.toString(),
            }
        });
        pinataFormData.append('pinataMetadata', metadata);

        // Optional: Pin options
        const options = JSON.stringify({
            cidVersion: 1,
        });
        pinataFormData.append('pinataOptions', options);

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT);

        try {
            // Upload to Pinata with extended timeout
            const response = await fetch(PINATA_API_URL, {
                method: 'POST',
                headers: {
                    'pinata_api_key': pinataApiKey,
                    'pinata_secret_api_key': pinataSecretKey,
                },
                body: pinataFormData,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

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

        } catch (fetchError) {
            clearTimeout(timeoutId);

            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                return NextResponse.json({
                    error: 'Upload timed out. Large files may take longer. Please try again or use a smaller file.',
                    suggestion: 'For files over 10MB, consider compressing them first.',
                }, { status: 408 });
            }

            throw fetchError;
        }

    } catch (error) {
        console.error('Upload error:', error);

        // Check for network/connection errors
        if (error instanceof Error && error.message.includes('fetch failed')) {
            return NextResponse.json({
                error: 'Connection to IPFS service failed. Please check your internet connection and try again.',
                details: 'The upload service is temporarily unavailable.',
            }, { status: 503 });
        }

        return NextResponse.json(
            { error: 'Failed to process upload. Please try again.' },
            { status: 500 }
        );
    }
}

// Configure Next.js to allow larger request bodies
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '100mb',
        },
        responseLimit: '100mb',
    },
};
