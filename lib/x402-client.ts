/**
 * x402 Client-Side Payment Wrapper
 *
 * Creates a fetch wrapper that automatically handles 402 Payment Required
 * responses by prompting the user's wallet to sign a USDC transfer authorization,
 * then retrying the request with the payment signature.
 *
 * Uses registerExactEvmScheme which registers BOTH v1 and v2 scheme handlers,
 * so it works with the Polygon Amoy facilitator (v1 protocol) out of the box.
 */
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import type { WalletClient } from "viem";
import { publicActions } from "viem";

/**
 * Creates an x402-aware fetch function that handles payment automatically.
 *
 * @param walletClient - A viem WalletClient from wagmi's useWalletClient()
 * @returns A wrapped fetch function that handles 402 → pay → retry flow
 */
export function createPaymentFetch(walletClient: WalletClient) {
    const account = walletClient.account;
    if (!account) {
        throw new Error("Wallet client has no account. Connect your wallet first.");
    }

    // Extend wallet client with public actions (readContract, etc.)
    const extendedClient = walletClient.extend(publicActions);

    // The x402 library expects signer.address at the top level, but viem
    // WalletClient stores it at .account.address. Create a proxy that
    // exposes .address directly while delegating everything else.
    const signer = Object.create(extendedClient, {
        address: { value: account.address, enumerable: true },
    });

    // Create client and register exact EVM scheme for both v1 and v2
    // registerExactEvmScheme automatically registers v1 handlers for all
    // known EVM networks (including "polygon-amoy") via registerV1()
    const client = new x402Client();
    registerExactEvmScheme(client, { signer });

    // Wrap native fetch with payment handling
    return wrapFetchWithPayment(fetch, client);
}
