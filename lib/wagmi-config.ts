/**
 * Wagmi Configuration for x402 Wallet Integration
 *
 * Configures wallet connectors (MetaMask, Coinbase Wallet)
 * and Polygon Amoy testnet (+ Polygon mainnet) for USDC micropayments.
 *
 * Testnet:  Polygon Amoy (eip155:80002)
 * Mainnet:  Polygon (eip155:137)  — switch NEXT_PUBLIC_X402_NETWORK when ready
 */
import { http, createConfig } from "wagmi";
import { polygonAmoy, polygon } from "wagmi/chains";
import { coinbaseWallet } from "wagmi/connectors";

// ─── Wagmi Config ───────────────────────────────────────────────────────────
// Supports both Polygon Amoy (testnet) and Polygon mainnet.
// Wagmi v3 auto-discovers installed wallets (MetaMask, Brave, etc.) via EIP-6963,
// so we only need to explicitly add Coinbase Wallet.
export const wagmiConfig = createConfig({
    chains: [polygonAmoy, polygon],
    connectors: [
        coinbaseWallet({ appName: "PINN44 Chatbot" }),
    ],
    transports: {
        [polygonAmoy.id]: http(),
        [polygon.id]: http(),
    },
});

// ─── Network Info (for UI) ──────────────────────────────────────────────────
// To switch to mainnet: set NEXT_PUBLIC_X402_NETWORK=eip155:137
const isMainnet = process.env.NEXT_PUBLIC_X402_NETWORK === "eip155:137";
export const ACTIVE_CHAIN = isMainnet ? polygon : polygonAmoy;
export const CHAIN_NAME = isMainnet ? "Polygon" : "Polygon Amoy (Testnet)";
export const USDC_ADDRESS = isMainnet
    ? "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"  // Polygon Mainnet USDC
    : "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582"; // Polygon Amoy USDC
