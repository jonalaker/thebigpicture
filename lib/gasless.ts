'use client';

import { ethers, BrowserProvider, JsonRpcSigner, Interface } from 'ethers';
import {
    CONTRACTS_CONFIG,
    FORWARDER_NAME,
    FORWARDER_ABI,
    WORK_SUBMISSION_ABI,
} from '@/lib/contracts';

/**
 * A signed ERC-2771 ForwardRequest, serialized for transport to the relay API.
 * Mirrors OpenZeppelin v5 ERC2771Forwarder.ForwardRequestData.
 */
export interface SignedForwardRequest {
    from: string;
    to: string;
    value: string; // stringified bigint for JSON safety
    gas: string;
    deadline: number; // uint48 seconds
    data: string;
    signature: string;
}

// EIP-712 type — field order MUST match OZ's FORWARD_REQUEST_TYPEHASH:
// "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint48 deadline,bytes data)"
const FORWARD_REQUEST_TYPES = {
    ForwardRequest: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'gas', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint48' },
        { name: 'data', type: 'bytes' },
    ],
};

/**
 * Builds and signs a gasless meta-transaction for WorkSubmission.submitWork.
 * The user only signs typed data (no gas, no MATIC required). The returned
 * request is relayed by the backend, which pays the gas.
 *
 * Only valid for bounties with no native (MATIC) stake — value is fixed to 0.
 */
export async function buildSignedSubmitWork(
    signer: JsonRpcSigner,
    provider: BrowserProvider,
    chainId: number,
    args: { bountyId: number; fileUri: string; thumbnailUri: string }
): Promise<SignedForwardRequest> {
    const forwarderAddress = CONTRACTS_CONFIG.FORWARDER;
    const workAddress = CONTRACTS_CONFIG.WORK_SUBMISSION;

    if (!forwarderAddress) throw new Error('Gasless forwarder not configured');
    if (!workAddress) throw new Error('WorkSubmission contract not configured');

    const from = await signer.getAddress();

    // Encode the inner submitWork(...) call
    const workIface = new Interface(WORK_SUBMISSION_ABI);
    const data = workIface.encodeFunctionData('submitWork', [
        args.bountyId,
        args.fileUri,
        args.thumbnailUri,
    ]);

    // Current forwarder nonce for this user
    const forwarder = new ethers.Contract(forwarderAddress, FORWARDER_ABI, provider);
    const nonce: bigint = await forwarder.nonces(from);

    // Estimate gas for the inner call, with a buffer. Simulation only — costs nothing.
    let gas: bigint;
    try {
        gas = await provider.estimateGas({ from, to: workAddress, data, value: 0n });
        gas = (gas * 15n) / 10n; // +50% headroom
    } catch {
        gas = 500_000n; // safe fallback
    }

    const deadline = Math.floor(Date.now() / 1000) + 3600; // valid for 1 hour

    const domain = {
        name: FORWARDER_NAME,
        version: '1',
        chainId,
        verifyingContract: forwarderAddress,
    };

    const message = {
        from,
        to: workAddress,
        value: 0n,
        gas,
        nonce,
        deadline,
        data,
    };

    const signature = await signer.signTypedData(domain, FORWARD_REQUEST_TYPES, message);

    return {
        from,
        to: workAddress,
        value: '0',
        gas: gas.toString(),
        deadline,
        data,
        signature,
    };
}
