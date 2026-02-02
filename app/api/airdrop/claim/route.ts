import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { promises as fs } from 'fs';
import path from 'path';

// Claim tracking file
const CLAIMS_FILE = path.join(process.cwd(), 'data', 'airdrop-claims.json');

// Configuration
const AIRDROP_AMOUNT = process.env.AIRDROP_AMOUNT || '100';
const IMMEDIATE_PERCENTAGE = 10;
const LOCKED_PERCENTAGE = 90;

// StakingVesting ABI (only functions we need)
const STAKING_VESTING_ABI = [
    'function createVestingSchedule(address beneficiary, uint256 amount, uint8 vestType) external',
    'function token() view returns (address)',
];

// ERC20 ABI for token transfers
const ERC20_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
];

interface ClaimsData {
    claims: {
        [fingerprint: string]: {
            address: string;
            txHash: string;
            timestamp: number;
            ip: string;
        };
    };
    walletClaims: {
        [address: string]: boolean;
    };
}

// Load claims data
async function loadClaims(): Promise<ClaimsData> {
    try {
        const data = await fs.readFile(CLAIMS_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        // Ensure walletClaims exists
        if (!parsed.walletClaims) {
            parsed.walletClaims = {};
        }
        return parsed;
    } catch {
        return { claims: {}, walletClaims: {} };
    }
}

// Save claims data
async function saveClaims(data: ClaimsData): Promise<void> {
    await fs.writeFile(CLAIMS_FILE, JSON.stringify(data, null, 2));
}

// Check if fingerprint or wallet has already claimed
async function hasAlreadyClaimed(fingerprint: string, walletAddress: string): Promise<{ claimed: boolean; reason?: string }> {
    const claims = await loadClaims();

    // Check fingerprint (device)
    if (claims.claims[fingerprint]) {
        return { claimed: true, reason: 'This device has already claimed the airdrop' };
    }

    // Check wallet address
    const normalizedAddress = walletAddress.toLowerCase();
    if (claims.walletClaims[normalizedAddress]) {
        return { claimed: true, reason: 'This wallet has already claimed the airdrop' };
    }

    return { claimed: false };
}

// Record a claim
async function recordClaim(fingerprint: string, walletAddress: string, txHash: string, ip: string): Promise<void> {
    const claims = await loadClaims();
    const normalizedAddress = walletAddress.toLowerCase();

    claims.claims[fingerprint] = {
        address: walletAddress,
        txHash,
        timestamp: Date.now(),
        ip,
    };

    claims.walletClaims[normalizedAddress] = true;

    await saveClaims(claims);
}

// Get client IP
function getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    return forwarded?.split(',')[0]?.trim() || realIP || 'unknown';
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { walletAddress, fingerprint } = body;

        // Validate inputs
        if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
            return NextResponse.json(
                { error: 'Invalid wallet address' },
                { status: 400 }
            );
        }

        if (!fingerprint || fingerprint.length < 8) {
            return NextResponse.json(
                { error: 'Invalid device fingerprint' },
                { status: 400 }
            );
        }

        // Check if already claimed
        const claimCheck = await hasAlreadyClaimed(fingerprint, walletAddress);
        if (claimCheck.claimed) {
            return NextResponse.json(
                { error: claimCheck.reason },
                { status: 409 } // Conflict
            );
        }

        // Get environment variables
        const privateKey = process.env.RELAYER_PRIVATE_KEY;
        const rpcUrl = process.env.POLYGON_RPC_URL;
        const tokenAddress = process.env.NEXT_PUBLIC_PINN44_TOKEN_ADDRESS;
        const stakingAddress = process.env.NEXT_PUBLIC_STAKING_VESTING_ADDRESS;

        if (!privateKey || !rpcUrl || !tokenAddress || !stakingAddress) {
            console.error('Missing environment variables');
            return NextResponse.json(
                { error: 'Airdrop not configured' },
                { status: 503 }
            );
        }

        // Setup provider and wallet
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const relayerWallet = new ethers.Wallet(privateKey, provider);

        // Setup contracts
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, relayerWallet);
        const stakingContract = new ethers.Contract(stakingAddress, STAKING_VESTING_ABI, relayerWallet);

        // Calculate amounts
        const totalAmount = ethers.parseEther(AIRDROP_AMOUNT);
        const immediateAmount = (totalAmount * BigInt(IMMEDIATE_PERCENTAGE)) / BigInt(100);
        const lockedAmount = totalAmount - immediateAmount;

        // Check relayer has enough tokens
        const balance = await tokenContract.balanceOf(relayerWallet.address);
        if (balance < totalAmount) {
            console.error('Relayer wallet has insufficient tokens');
            return NextResponse.json(
                { error: 'Airdrop pool exhausted' },
                { status: 503 }
            );
        }

        // Step 1: Send 10% immediately to user
        console.log(`Sending ${ethers.formatEther(immediateAmount)} PINN44 to ${walletAddress}`);
        const transferTx = await tokenContract.transfer(walletAddress, immediateAmount);
        const transferReceipt = await transferTx.wait();

        // Step 2: Approve staking contract for locked amount
        console.log(`Approving ${ethers.formatEther(lockedAmount)} PINN44 for staking contract`);
        const approveTx = await tokenContract.approve(stakingAddress, lockedAmount);
        await approveTx.wait();

        // Step 3: Create vesting schedule (vestType 2 = AIRDROP)
        console.log(`Creating vesting schedule for ${walletAddress}`);
        const vestingTx = await stakingContract.createVestingSchedule(
            walletAddress,
            lockedAmount,
            2 // VestingType.AIRDROP
        );
        await vestingTx.wait();

        // Record the claim
        const clientIP = getClientIP(request);
        await recordClaim(fingerprint, walletAddress, transferReceipt.hash, clientIP);

        console.log(`Airdrop successful for ${walletAddress}. TX: ${transferReceipt.hash}`);

        return NextResponse.json({
            success: true,
            txHash: transferReceipt.hash,
            immediateAmount: ethers.formatEther(immediateAmount),
            lockedAmount: ethers.formatEther(lockedAmount),
            message: `Successfully claimed ${AIRDROP_AMOUNT} PINN44 tokens!`,
        });

    } catch (error) {
        console.error('Airdrop claim error:', error);

        const message = error instanceof Error ? error.message : 'Unknown error';

        // Handle specific errors
        if (message.includes('insufficient funds')) {
            return NextResponse.json(
                { error: 'Relayer wallet has insufficient gas' },
                { status: 503 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to process airdrop claim' },
            { status: 500 }
        );
    }
}

// GET endpoint to check claim status
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const fingerprint = searchParams.get('fingerprint');
    const walletAddress = searchParams.get('address');

    if (!fingerprint && !walletAddress) {
        return NextResponse.json(
            { error: 'Fingerprint or address required' },
            { status: 400 }
        );
    }

    const claims = await loadClaims();

    // Check fingerprint
    if (fingerprint && claims.claims[fingerprint]) {
        return NextResponse.json({
            claimed: true,
            claimInfo: claims.claims[fingerprint],
        });
    }

    // Check wallet
    if (walletAddress) {
        const normalizedAddress = walletAddress.toLowerCase();
        if (claims.walletClaims[normalizedAddress]) {
            return NextResponse.json({
                claimed: true,
                reason: 'Wallet has already claimed',
            });
        }
    }

    return NextResponse.json({ claimed: false });
}
