import { ethers } from 'ethers';

/**
 * Shared transaction-retry logic for every wallet interaction on TBP.info.
 *
 * Policy (per product spec):
 *   1. Try the transaction up to NORMAL_ATTEMPTS (5) times at the wallet/relayer
 *      default gas. Retries only fire for transient network/mempool errors —
 *      never for user rejection or deterministic contract reverts.
 *   2. If still failing, escalate to "aggressive" gas (bumped priority + max fee)
 *      for a few more attempts.
 *   3. If everything fails, surface NETWORK_BUSY_MESSAGE so the user knows to wait
 *      or bump the gas tip manually.
 *
 * Isomorphic — used both client-side (BrowserProvider/MetaMask) and server-side
 * (the gasless relayer in /api/submit-work).
 */

export const NETWORK_BUSY_MESSAGE =
    'Network busy, try again in a few minutes, or manually increase Gas tip.';

const NORMAL_ATTEMPTS = 5;
// Fee multipliers applied once we escalate to "aggressive" gas, one per attempt.
const AGGRESSIVE_MULTIPLIERS = [2n, 3n, 4n];

export interface FeeOverrides {
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    gasPrice?: bigint;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** User declined the signature/transaction in their wallet — never retry. */
export function isUserRejection(err: unknown): boolean {
    const e = err as { code?: number | string; message?: string } | null;
    if (!e) return false;
    if (e.code === 4001 || e.code === 'ACTION_REJECTED') return true;
    const msg = (e.message || '').toLowerCase();
    return msg.includes('user rejected') || msg.includes('user denied');
}

/**
 * Transient failures worth retrying: network blips, RPC rate limits, and
 * under-priced / nonce / mempool issues. Deterministic failures (contract
 * reverts, "insufficient funds") are intentionally excluded so we fail fast.
 */
export function isRetryableError(err: unknown): boolean {
    if (isUserRejection(err)) return false;
    const e = err as { code?: number | string; message?: string } | null;
    const code = e?.code;
    if (
        code === 'NETWORK_ERROR' ||
        code === 'TIMEOUT' ||
        code === 'SERVER_ERROR' ||
        code === 'REPLACEMENT_UNDERPRICED' ||
        code === 'NONCE_EXPIRED' ||
        code === -32603 // generic internal JSON-RPC error, usually transient
    ) {
        return true;
    }
    const msg = (e?.message || '').toLowerCase();
    return (
        msg.includes('underpriced') ||
        msg.includes('timeout') ||
        msg.includes('timed out') ||
        msg.includes('took too long') ||
        msg.includes('network') ||
        msg.includes('rate limit') ||
        msg.includes('429') ||
        msg.includes('fetch failed') ||
        msg.includes('failed to fetch') ||
        msg.includes('connection') ||
        msg.includes('mempool') ||
        msg.includes('nonce') ||
        msg.includes('gas tip cap') ||
        msg.includes('max fee per gas') ||
        msg.includes('try again')
    );
}

/** Build aggressive fee overrides from current network conditions. */
async function aggressiveOverrides(
    provider: ethers.Provider,
    multiplier: bigint
): Promise<FeeOverrides> {
    try {
        const fee = await provider.getFeeData();
        if (fee.maxFeePerGas != null && fee.maxPriorityFeePerGas != null) {
            return {
                maxFeePerGas: fee.maxFeePerGas * multiplier,
                maxPriorityFeePerGas: fee.maxPriorityFeePerGas * multiplier,
            };
        }
        if (fee.gasPrice != null) {
            return { gasPrice: fee.gasPrice * multiplier };
        }
    } catch {
        // Couldn't read fee data — fall back to wallet/relayer defaults.
    }
    return {};
}

/**
 * Sends a transaction with automatic retry and gas escalation.
 *
 * `send` receives fee overrides and must broadcast the transaction (e.g.
 * `(o) => contract.submitWork(id, uri, thumb, o)`). It is only re-invoked when
 * the *broadcast itself* fails, so a transaction that already reached the
 * mempool is never double-submitted. Once broadcast succeeds we simply wait for
 * the receipt; a revert there surfaces normally.
 *
 * @param provider used to read live fee data for the aggressive phase; may be
 *                 null, in which case escalation relies on wallet defaults.
 */
export async function sendTxWithRetry(
    provider: ethers.Provider | null,
    send: (overrides: FeeOverrides) => Promise<ethers.ContractTransactionResponse>
): Promise<ethers.ContractTransactionReceipt | null> {
    // null => normal gas; bigint => aggressive gas at that multiplier.
    const phases: (bigint | null)[] = [
        ...Array<null>(NORMAL_ATTEMPTS).fill(null),
        ...AGGRESSIVE_MULTIPLIERS,
    ];

    for (let i = 0; i < phases.length; i++) {
        const multiplier = phases[i];
        let tx: ethers.ContractTransactionResponse;

        try {
            const overrides =
                multiplier && provider ? await aggressiveOverrides(provider, multiplier) : {};
            tx = await send(overrides);
        } catch (err) {
            if (isUserRejection(err)) throw err; // respect the user's choice
            if (!isRetryableError(err)) throw err; // deterministic failure — fail fast
            // Broadcast never landed, so it's safe to back off and retry.
            await delay(Math.min(1000 * (i + 1), 4000));
            continue;
        }

        // Broadcast succeeded; do NOT re-broadcast — just await mining.
        return tx.wait();
    }

    throw new Error(NETWORK_BUSY_MESSAGE);
}

/**
 * POSTs JSON with retry for transient transport failures (network errors and
 * gateway 5xx). Used by the gasless client path; the relayer already escalates
 * gas server-side, so we deliberately do NOT retry a 503 "network busy" response
 * (that would just hammer the relayer).
 */
export async function postJsonWithRetry<T>(
    url: string,
    body: unknown,
    retries = 2
): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            let json: unknown = null;
            try {
                json = await res.json();
            } catch {
                // non-JSON body
            }

            if (res.ok) return json as T;

            // Retry only transient gateway/server hiccups, not deliberate 4xx/503.
            if ([500, 502, 504].includes(res.status) && attempt < retries) {
                await delay(1000 * (attempt + 1));
                continue;
            }

            const message =
                (json as { error?: string })?.error || `Request failed (${res.status})`;
            throw new Error(message);
        } catch (err) {
            lastError = err;
            const msg = err instanceof Error ? err.message.toLowerCase() : '';
            const isNetwork =
                msg.includes('fetch') || msg.includes('network') || msg.includes('failed');
            if (attempt < retries && isNetwork) {
                await delay(1000 * (attempt + 1));
                continue;
            }
            throw err;
        }
    }

    throw lastError instanceof Error ? lastError : new Error(NETWORK_BUSY_MESSAGE);
}
