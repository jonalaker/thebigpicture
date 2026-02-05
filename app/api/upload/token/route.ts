import { NextResponse } from 'next/server';

// Generate a temporary JWT for client-side uploads
// This keeps the secret key secure on the server while allowing direct uploads
export async function GET() {
    try {
        const pinataApiKey = process.env.PINATA_API_KEY;
        const pinataSecretKey = process.env.PINATA_SECRET_KEY;

        if (!pinataApiKey || !pinataSecretKey) {
            return NextResponse.json({
                error: 'Pinata not configured',
            }, { status: 503 });
        }

        // Generate a temporary JWT from Pinata
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
                maxUses: 1, // Single use token
            }),
        });

        if (!response.ok) {
            console.error('Failed to generate Pinata JWT');
            return NextResponse.json({
                error: 'Failed to generate upload token',
            }, { status: 500 });
        }

        const data = await response.json();

        return NextResponse.json({
            jwt: data.JWT,
            apiKey: data.pinata_api_key,
        });

    } catch (error) {
        console.error('Token generation error:', error);
        return NextResponse.json({
            error: 'Failed to generate upload token',
        }, { status: 500 });
    }
}
