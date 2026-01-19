import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import {
    AIRDROP_CONFIG,
    ERC20_ABI,
    EIP712_DOMAIN,
    CLAIM_TYPES,
    CLAIM_MESSAGE,
} from '@/lib/airdrop/config';
import {
    hasClaimed,
    recordClaim,
    getNonce,
    incrementNonce,
    checkRateLimit,
} from '@/lib/airdrop/claims';

// Validate configuration on startup
function validateConfig(): string | null {
    if (!AIRDROP_CONFIG.TOKEN_ADDRESS) {
        return 'PINN44_TOKEN_ADDRESS not configured';
    }
    if (!AIRDROP_CONFIG.RELAYER_PRIVATE_KEY) {
        return 'RELAYER_PRIVATE_KEY not configured';
    }
    if (!ethers.isAddress(AIRDROP_CONFIG.TOKEN_ADDRESS)) {
        return 'Invalid token address format';
    }
    return null;
}

// Get client IP from request
function getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    const realIP = request.headers.get('x-real-ip');
    if (realIP) {
        return realIP;
    }
    return '127.0.0.1';
}

export async function POST(request: NextRequest) {
    try {
        // Validate configuration
        const configError = validateConfig();
        if (configError) {
            console.error('Airdrop config error:', configError);
            return NextResponse.json(
                { error: 'Airdrop service not configured properly' },
                { status: 503 }
            );
        }

        // Get client IP for rate limiting
        const clientIP = getClientIP(request);

        // Check rate limit
        if (!checkRateLimit(
            clientIP,
            AIRDROP_CONFIG.RATE_LIMIT_WINDOW_MS,
            AIRDROP_CONFIG.MAX_REQUESTS_PER_WINDOW
        )) {
            return NextResponse.json(
                { error: 'Rate limited. Please try again in 1 minute.' },
                { status: 429 }
            );
        }

        // Parse request body
        const body = await request.json();
        const { address, signature, nonce } = body;

        // Validate required fields
        if (!address || !signature || nonce === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields: address, signature, nonce' },
                { status: 400 }
            );
        }

        // Validate address format
        if (!ethers.isAddress(address)) {
            return NextResponse.json(
                { error: 'Invalid wallet address format' },
                { status: 400 }
            );
        }

        // Check if already claimed
        if (await hasClaimed(address)) {
            return NextResponse.json(
                { error: 'This address has already claimed the airdrop' },
                { status: 400 }
            );
        }

        // Verify nonce to prevent replay attacks
        const expectedNonce = await getNonce(address);
        if (parseInt(nonce) !== expectedNonce) {
            return NextResponse.json(
                { error: 'Invalid nonce. Please refresh and try again.', expectedNonce },
                { status: 400 }
            );
        }

        // Verify EIP-712 signature
        const domain = {
            ...EIP712_DOMAIN,
            verifyingContract: AIRDROP_CONFIG.TOKEN_ADDRESS as `0x${string}`,
        };

        const claimData = {
            recipient: address,
            nonce: BigInt(nonce),
            message: CLAIM_MESSAGE,
        };

        let recoveredAddress: string;
        try {
            recoveredAddress = ethers.verifyTypedData(
                domain,
                CLAIM_TYPES,
                claimData,
                signature
            );
        } catch (sigError) {
            console.error('Signature verification failed:', sigError);
            return NextResponse.json(
                { error: 'Invalid signature' },
                { status: 400 }
            );
        }

        // Check recovered address matches claimed address
        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
            return NextResponse.json(
                { error: 'Signature does not match the claiming address' },
                { status: 400 }
            );
        }

        // Create provider and relayer wallet
        const provider = new ethers.JsonRpcProvider(AIRDROP_CONFIG.POLYGON_RPC_URL);
        const relayerWallet = new ethers.Wallet(AIRDROP_CONFIG.RELAYER_PRIVATE_KEY, provider);

        // Create token contract instance
        const tokenContract = new ethers.Contract(
            AIRDROP_CONFIG.TOKEN_ADDRESS,
            ERC20_ABI,
            relayerWallet
        );

        // Calculate amount with decimals
        const amount = ethers.parseUnits(
            AIRDROP_CONFIG.AIRDROP_AMOUNT,
            AIRDROP_CONFIG.TOKEN_DECIMALS
        );

        // Check relayer has enough tokens
        const relayerBalance = await tokenContract.balanceOf(relayerWallet.address);
        if (relayerBalance < amount) {
            console.error('Insufficient relayer token balance');
            return NextResponse.json(
                { error: 'Airdrop temporarily unavailable. Please try again later.' },
                { status: 503 }
            );
        }

        // Execute the transfer
        console.log(`Processing airdrop: ${amount.toString()} tokens to ${address}`);

        const tx = await tokenContract.transfer(address, amount);
        console.log(`Transaction submitted: ${tx.hash}`);

        // Wait for confirmation (1 block on Polygon is fast)
        const receipt = await tx.wait(1);
        console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

        // Record the claim
        await recordClaim(address, tx.hash, clientIP);
        await incrementNonce(address);

        return NextResponse.json({
            success: true,
            message: 'Airdrop claimed successfully!',
            txHash: tx.hash,
            amount: AIRDROP_CONFIG.AIRDROP_AMOUNT,
            explorerUrl: `https://polygonscan.com/tx/${tx.hash}`,
        });

    } catch (error) {
        console.error('Airdrop claim error:', error);

        // Handle specific errors
        if (error instanceof Error) {
            if (error.message.includes('insufficient funds')) {
                return NextResponse.json(
                    { error: 'Relayer has insufficient MATIC for gas' },
                    { status: 503 }
                );
            }
            if (error.message.includes('nonce')) {
                return NextResponse.json(
                    { error: 'Transaction nonce error. Please try again.' },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json(
            { error: 'Failed to process airdrop. Please try again later.' },
            { status: 500 }
        );
    }
}

// GET endpoint to check claim status and get nonce
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
        return NextResponse.json(
            { error: 'Address parameter required' },
            { status: 400 }
        );
    }

    if (!ethers.isAddress(address)) {
        return NextResponse.json(
            { error: 'Invalid address format' },
            { status: 400 }
        );
    }

    const claimed = await hasClaimed(address);
    const nonce = await getNonce(address);

    return NextResponse.json({
        address,
        claimed,
        nonce,
        airdropAmount: AIRDROP_CONFIG.AIRDROP_AMOUNT,
        chainId: AIRDROP_CONFIG.CHAIN_ID,
        chainName: AIRDROP_CONFIG.CHAIN_NAME,
    });
}
