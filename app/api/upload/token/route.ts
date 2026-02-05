import { NextResponse } from 'next/server';

// Generate a temporary API key for client-side uploads
export async function GET() {
    try {
        const lighthouseApiKey = process.env.LIGHTHOUSE_API_KEY;

        if (!lighthouseApiKey) {
            // Fallback to Pinata if Lighthouse not configured
            const pinataApiKey = process.env.PINATA_API_KEY;
            const pinataSecretKey = process.env.PINATA_SECRET_KEY;

            if (pinataApiKey && pinataSecretKey) {
                // Generate Pinata JWT
                const response = await fetch('https://api.pinata.cloud/users/generateApiKey', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'pinata_api_key': pinataApiKey,
                        'pinata_secret_api_key': pinataSecretKey,
                    },
                    body: JSON.stringify({
                        keyName: `upload-${Date.now()}`,
                        permissions: {
                            endpoints: {
                                pinning: {
                                    pinFileToIPFS: true,
                                },
                            },
                        },
                        maxUses: 1,
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    return NextResponse.json({
                        provider: 'pinata',
                        jwt: data.JWT,
                        apiKey: data.pinata_api_key,
                        maxFileSize: 100 * 1024 * 1024, // 100MB for Pinata
                    });
                }
            }

            return NextResponse.json({
                error: 'No IPFS provider configured. Please set LIGHTHOUSE_API_KEY or PINATA_API_KEY.',
            }, { status: 503 });
        }

        // Return Lighthouse API key for client-side upload
        // Lighthouse supports large files directly from browser
        return NextResponse.json({
            provider: 'lighthouse',
            apiKey: lighthouseApiKey,
            maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB for Lighthouse
        });

    } catch (error) {
        console.error('Token generation error:', error);
        return NextResponse.json({
            error: 'Failed to generate upload token',
        }, { status: 500 });
    }
}
