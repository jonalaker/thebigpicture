// Airdrop Configuration for PINN44 Token on Polygon
export const AIRDROP_CONFIG = {
  // Polygon Mainnet RPC
  POLYGON_RPC_URL: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  
  // Token contract address (set in .env.local)
  TOKEN_ADDRESS: process.env.PINN44_TOKEN_ADDRESS || '',
  
  // Relayer private key (set in .env.local)
  RELAYER_PRIVATE_KEY: process.env.RELAYER_PRIVATE_KEY || '',
  
  // Amount of tokens per airdrop (100 tokens)
  // Adjust decimals based on your token (assuming 18 decimals)
  AIRDROP_AMOUNT: process.env.AIRDROP_AMOUNT || '100',
  TOKEN_DECIMALS: parseInt(process.env.TOKEN_DECIMALS || '18'),
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: 60000, // 1 minute
  MAX_REQUESTS_PER_WINDOW: 1,
  
  // Polygon Chain ID
  CHAIN_ID: 137,
  CHAIN_NAME: 'Polygon Mainnet',
};

// ERC20 ABI - only the functions we need
export const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
];

// EIP-712 Domain for signature verification
export const EIP712_DOMAIN = {
  name: 'PINN44 Airdrop',
  version: '1',
  chainId: AIRDROP_CONFIG.CHAIN_ID,
};

// EIP-712 Types for claim message
export const CLAIM_TYPES = {
  Claim: [
    { name: 'recipient', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'message', type: 'string' },
  ],
};

// Message that users sign to claim
export const CLAIM_MESSAGE = 'I am claiming my PINN44 airdrop tokens. This signature proves I own this wallet.';
