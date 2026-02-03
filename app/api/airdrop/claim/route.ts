import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

// Configuration
const AIRDROP_AMOUNT = process.env.AIRDROP_AMOUNT || '100';
const IMMEDIATE_PERCENTAGE = 10;

// StakingVesting ABI (only functions we need)
const STAKING_VESTING_ABI = [
    'function createVestingSchedule(address beneficiary, uint256 amount, uint8 vestType) external',
    'function vestingSchedules(address, uint256) view returns (uint256 totalAmount, uint256 startTime, uint256 cliffDuration, uint256 vestingDuration, uint256 claimed, uint8 vestType, bool contributionUnlocked)',
    'function token() view returns (address)',
];

// ERC20 ABI for token transfers
const ERC20_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
];

// In-memory cache for fingerprints (resets on cold start, but blockchain is the source of truth)
const fingerprintCache = new Map<string, { address: string; timestamp: number }>();

// Check if wallet has any airdrop vesting schedule on-chain
async function hasExistingAirdropSchedule(
    stakingContract: ethers.Contract,
    walletAddress: string
): Promise<boolean> {
    try {
        // Check first vesting schedule (index 0)
        const schedule = await stakingContract.vestingSchedules(walletAddress, 0);
        // If totalAmount > 0 and vestType == 2 (AIRDROP), they've already claimed
        if (schedule.totalAmount > BigInt(0) && Number(schedule.vestType) === 2) {
            return true;
        }
        return false;
    } catch {
        // No schedule exists
        return false;
    }
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

        // Check in-memory fingerprint cache (quick check, not persistent)
        if (fingerprintCache.has(fingerprint)) {
            return NextResponse.json(
                { error: 'This device has already claimed the airdrop' },
                { status: 409 }
            );
        }

        // Get environment variables
        const privateKey = process.env.RELAYER_PRIVATE_KEY;
        const rpcUrl = process.env.POLYGON_RPC_URL;
        const tokenAddress = process.env.NEXT_PUBLIC_PINN44_TOKEN_ADDRESS;
        const stakingAddress = process.env.NEXT_PUBLIC_STAKING_VESTING_ADDRESS;

        if (!privateKey || !rpcUrl || !tokenAddress || !stakingAddress) {
            console.error('Missing environment variables:', {
                hasPrivateKey: !!privateKey,
                hasRpcUrl: !!rpcUrl,
                hasTokenAddress: !!tokenAddress,
                hasStakingAddress: !!stakingAddress,
            });
            return NextResponse.json(
                { error: 'Airdrop not configured. Please set environment variables.' },
                { status: 503 }
            );
        }

        // Setup provider and wallet
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const relayerWallet = new ethers.Wallet(privateKey, provider);

        // Setup contracts
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, relayerWallet);
        const stakingContract = new ethers.Contract(stakingAddress, STAKING_VESTING_ABI, relayerWallet);

        // Check if wallet has already claimed ON-CHAIN (source of truth)
        const hasSchedule = await hasExistingAirdropSchedule(stakingContract, walletAddress);
        if (hasSchedule) {
            return NextResponse.json(
                { error: 'This wallet has already claimed the airdrop' },
                { status: 409 }
            );
        }

        // Calculate amounts
        const totalAmount = ethers.parseEther(AIRDROP_AMOUNT);
        const immediateAmount = (totalAmount * BigInt(IMMEDIATE_PERCENTAGE)) / BigInt(100);
        const lockedAmount = totalAmount - immediateAmount;

        // Check relayer has enough tokens
        const balance = await tokenContract.balanceOf(relayerWallet.address);
        if (balance < totalAmount) {
            console.error('Relayer wallet has insufficient tokens:', ethers.formatEther(balance));
            return NextResponse.json(
                { error: 'Airdrop pool exhausted. Please contact support.' },
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

        // Cache fingerprint in memory
        fingerprintCache.set(fingerprint, {
            address: walletAddress,
            timestamp: Date.now(),
        });

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
                { error: 'Relayer wallet has insufficient gas. Please contact support.' },
                { status: 503 }
            );
        }

        if (message.includes('execution reverted')) {
            return NextResponse.json(
                { error: 'Transaction failed. You may have already claimed or there is a contract issue.' },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to process airdrop claim. Please try again later.' },
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

    // Check fingerprint in memory cache
    if (fingerprint && fingerprintCache.has(fingerprint)) {
        return NextResponse.json({
            claimed: true,
            reason: 'Device already claimed',
        });
    }

    // Check wallet on-chain if address provided
    if (walletAddress) {
        try {
            const rpcUrl = process.env.POLYGON_RPC_URL;
            const stakingAddress = process.env.NEXT_PUBLIC_STAKING_VESTING_ADDRESS;

            if (rpcUrl && stakingAddress) {
                const provider = new ethers.JsonRpcProvider(rpcUrl);
                const stakingContract = new ethers.Contract(stakingAddress, STAKING_VESTING_ABI, provider);

                const hasSchedule = await hasExistingAirdropSchedule(stakingContract, walletAddress);
                if (hasSchedule) {
                    return NextResponse.json({
                        claimed: true,
                        reason: 'Wallet has already claimed',
                    });
                }
            }
        } catch (err) {
            console.error('Error checking on-chain status:', err);
        }
    }

    return NextResponse.json({ claimed: false });
}
