import { NextRequest, NextResponse } from 'next/server';
import { appendWorkToSheet } from '@/lib/googleSheets';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { walletAddress, taskId, tokensEarned } = body;

        // Basic validation
        if (!walletAddress || !taskId || tokensEarned === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields: walletAddress, taskId, or tokensEarned' },
                { status: 400 }
            );
        }

        // Ideally, we would add backend signature verification here to prove the payload is legit
        // For a hackathon/MVP off-chain ledger, we'll accept the payload directly from the frontend request.

        await appendWorkToSheet({
            walletAddress,
            taskId,
            tokensEarned
        });

        return NextResponse.json({ success: true, message: 'Work successfully recorded on the ledger.' }, { status: 200 });

    } catch (error: any) {
        console.error('Track work error:', error);
        return NextResponse.json(
            { error: 'Failed to record work on the ledger. Check server logs.' },
            { status: 500 }
        );
    }
}
