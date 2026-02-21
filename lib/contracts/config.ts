// Smart Contract Configuration
// All contract addresses are loaded from environment variables

export const CONTRACTS_CONFIG = {
    // Network configuration (Polygon Amoy Testnet)
    CHAIN_ID: 80002,
    CHAIN_NAME: 'Polygon Amoy',
    RPC_URL: 'https://rpc-amoy.polygon.technology',
    BLOCK_EXPLORER: 'https://amoy.polygonscan.com',

    // Contract addresses (set after deployment)
    PINN44_TOKEN: process.env.NEXT_PUBLIC_PINN44_TOKEN_ADDRESS || '',
    STAKING_VESTING: process.env.NEXT_PUBLIC_STAKING_VESTING_ADDRESS || '',
    WORK_SUBMISSION: process.env.NEXT_PUBLIC_WORK_SUBMISSION_ADDRESS || '',
    CONTRIBUTOR_VAULT: process.env.NEXT_PUBLIC_CONTRIBUTOR_VAULT_ADDRESS || '',
    GOVERNANCE_MODULE: process.env.NEXT_PUBLIC_GOVERNANCE_MODULE_ADDRESS || '',
    BUYBACK_BURN: process.env.NEXT_PUBLIC_BUYBACK_BURN_ADDRESS || '',
    LIQUIDITY_MANAGER: process.env.NEXT_PUBLIC_LIQUIDITY_MANAGER_ADDRESS || '',
    GASLESS_MODULE: process.env.NEXT_PUBLIC_GASLESS_MODULE_ADDRESS || '',
    FIXED_PRICE_SWAP: process.env.NEXT_PUBLIC_FIXED_PRICE_SWAP_ADDRESS || '',
};

// Chain configuration for wallet (Polygon Amoy Testnet)
export const POLYGON_CHAIN = {
    chainId: '0x13882', // 80002 in hex
    chainName: 'Polygon Amoy',
    nativeCurrency: {
        name: 'POL',
        symbol: 'POL',
        decimals: 18,
    },
    rpcUrls: ['https://rpc-amoy.polygon.technology'],
    blockExplorerUrls: ['https://amoy.polygonscan.com'],
};

// Helper to get explorer URL for transaction
export function getExplorerTxUrl(txHash: string): string {
    return `${CONTRACTS_CONFIG.BLOCK_EXPLORER}/tx/${txHash}`;
}

// Helper to get explorer URL for address
export function getExplorerAddressUrl(address: string): string {
    return `${CONTRACTS_CONFIG.BLOCK_EXPLORER}/address/${address}`;
}
