import { NextRequest, NextResponse } from 'next/server';

// NFT.storage API endpoint
const NFT_STORAGE_API = 'https://api.nft.storage/upload';

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

        // Check file size (max 100MB for NFT.storage)
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: 'File too large. Maximum size is 100MB.' },
                { status: 400 }
            );
        }

        // Get API key from environment
        const apiKey = process.env.NFT_STORAGE_API_KEY;

        if (!apiKey) {
            // If no API key, use a free public IPFS gateway (less reliable but works)
            console.log('No NFT_STORAGE_API_KEY set, using fallback method');
            return await uploadToPublicGateway(file);
        }

        // Upload to NFT.storage
        const response = await fetch(NFT_STORAGE_API, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
            body: file,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('NFT.storage error:', errorText);
            return NextResponse.json(
                { error: 'Failed to upload to IPFS' },
                { status: 500 }
            );
        }

        const result = await response.json();
        const cid = result.value?.cid;

        if (!cid) {
            return NextResponse.json(
                { error: 'Failed to get CID from upload' },
                { status: 500 }
            );
        }

        const ipfsUri = `ipfs://${cid}`;
        const gatewayUrl = `https://nftstorage.link/ipfs/${cid}`;

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

// Fallback: Upload to a public IPFS pinning service
async function uploadToPublicGateway(file: File): Promise<NextResponse> {
    try {
        // Use Filebase or another free pinning service
        // For demo purposes, we'll use the ipfs.io API (limited but works)
        const formData = new FormData();
        formData.append('file', file);

        // Try using Pinata's free public upload endpoint
        const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
            method: 'POST',
            headers: {
                // No auth for demo - this won't work in production without API key
            },
            body: formData,
        });

        if (!response.ok) {
            // If public gateway fails, return instructions
            return NextResponse.json({
                error: 'IPFS upload requires configuration. Please set NFT_STORAGE_API_KEY in environment variables.',
                instructions: 'Get a free API key at https://nft.storage and add NFT_STORAGE_API_KEY to your .env file.',
            }, { status: 503 });
        }

        const result = await response.json();
        const cid = result.IpfsHash;

        return NextResponse.json({
            success: true,
            ipfsUri: `ipfs://${cid}`,
            gatewayUrl: `https://gateway.pinata.cloud/ipfs/${cid}`,
            cid,
            fileName: file.name,
            fileSize: file.size,
        });

    } catch {
        return NextResponse.json({
            error: 'IPFS upload requires configuration. Please set NFT_STORAGE_API_KEY in environment variables.',
            instructions: 'Get a free API key at https://nft.storage and add NFT_STORAGE_API_KEY to your .env file.',
        }, { status: 503 });
    }
}
