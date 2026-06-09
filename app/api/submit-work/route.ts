import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { FORWARDER_ABI, WORK_SUBMISSION_ABI } from '@/lib/contracts/abis';
import { sendTxWithRetry, NETWORK_BUSY_MESSAGE } from '@/lib/tx-retry';

/**
 * Gasless work submission relay.
 *
 * Accepts a user-signed ERC-2771 ForwardRequest, validates it, then executes it
 * through the trusted forwarder using the relayer wallet — which pays the gas.
 * The user spends nothing and never needs MATIC.
 */

// submitWork(uint256,string,string) selector — the ONLY call we sponsor.
const SUBMIT_WORK_SELECTOR = new ethers.Interface(WORK_SUBMISSION_ABI).getFunction('submitWork')!.selector;

// Hard cap on forwarded gas to limit griefing/cost.
const MAX_GAS = 1_500_000n;

interface ForwardRequestBody {
    from: string;
    to: string;
    value: string;
    gas: string;
    deadline: number;
    data: string;
    signature: string;
}

function isAddress(a: unknown): a is string {
    return typeof a === 'string' && /^0x[a-fA-F0-9]{40}$/.test(a);
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const req: ForwardRequestBody = body?.request;

        // ---- Validate shape ----
        if (
            !req ||
            !isAddress(req.from) ||
            !isAddress(req.to) ||
            typeof req.data !== 'string' ||
            typeof req.signature !== 'string'
        ) {
            return NextResponse.json({ error: 'Malformed forward request' }, { status: 400 });
        }

        const rpcUrl = process.env.POLYGON_RPC_URL;
        const privateKey = process.env.RELAYER_PRIVATE_KEY;
        const forwarderAddress = process.env.NEXT_PUBLIC_FORWARDER_ADDRESS;
        const workAddress = process.env.NEXT_PUBLIC_WORK_SUBMISSION_ADDRESS;

        if (!rpcUrl || !privateKey || !forwarderAddress || !workAddress) {
            console.error('Gasless relay not configured', {
                hasRpc: !!rpcUrl,
                hasKey: !!privateKey,
                hasForwarder: !!forwarderAddress,
                hasWork: !!workAddress,
            });
            return NextResponse.json(
                { error: 'Gasless submission is not configured.' },
                { status: 503 }
            );
        }

        // ---- Security: only sponsor submitWork on the known WorkSubmission contract ----
        if (req.to.toLowerCase() !== workAddress.toLowerCase()) {
            return NextResponse.json({ error: 'Target not allowed' }, { status: 403 });
        }
        if (BigInt(req.value || '0') !== 0n) {
            return NextResponse.json({ error: 'Only zero-value submissions are sponsored' }, { status: 403 });
        }
        if (!req.data.toLowerCase().startsWith(SUBMIT_WORK_SELECTOR.toLowerCase())) {
            return NextResponse.json({ error: 'Only submitWork calls are sponsored' }, { status: 403 });
        }

        const gas = BigInt(req.gas || '0');
        if (gas <= 0n || gas > MAX_GAS) {
            return NextResponse.json({ error: 'Gas limit out of bounds' }, { status: 400 });
        }

        // ---- Set up relayer ----
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const relayer = new ethers.Wallet(privateKey, provider);
        const forwarder = new ethers.Contract(forwarderAddress, FORWARDER_ABI, relayer);

        const reqTuple = {
            from: req.from,
            to: req.to,
            value: 0n,
            gas,
            deadline: req.deadline,
            data: req.data,
            signature: req.signature,
        };

        // ---- Verify signature + nonce + deadline before spending gas ----
        const valid: boolean = await forwarder.verify(reqTuple);
        if (!valid) {
            return NextResponse.json(
                { error: 'Invalid or expired signature. Please try submitting again.' },
                { status: 400 }
            );
        }

        // ---- Ensure relayer can pay ----
        const balance = await provider.getBalance(relayer.address);
        if (balance < ethers.parseEther('0.02')) {
            console.error('Relayer low on gas:', ethers.formatEther(balance));
            return NextResponse.json(
                { error: 'Sponsor wallet is out of gas funds. Please contact support.' },
                { status: 503 }
            );
        }

        // ---- Relay (relayer pays gas) ----
        // Auto-retry transient network/mempool failures, escalating gas to
        // "aggressive" if needed. Re-broadcasting a request that already mined is
        // blocked by the forwarder nonce, so this never double-submits.
        const receipt = await sendTxWithRetry(provider, (overrides) =>
            forwarder.execute(reqTuple, { value: 0n, ...overrides })
        );

        return NextResponse.json({
            success: true,
            txHash: receipt?.hash,
            message: 'Work submitted gas-free!',
        });
    } catch (error) {
        console.error('Gasless submit error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';

        // Exhausted retries + aggressive gas — tell the user to wait or bump gas.
        if (message === NETWORK_BUSY_MESSAGE) {
            return NextResponse.json({ error: NETWORK_BUSY_MESSAGE }, { status: 503 });
        }
        if (message.includes('insufficient funds')) {
            return NextResponse.json(
                { error: 'Sponsor wallet has insufficient gas. Please contact support.' },
                { status: 503 }
            );
        }
        if (message.includes('execution reverted')) {
            return NextResponse.json(
                { error: 'Submission rejected by contract (deadline passed, bounty closed, or already submitted).' },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { error: 'Failed to relay submission. Please try again.' },
            { status: 500 }
        );
    }
}
