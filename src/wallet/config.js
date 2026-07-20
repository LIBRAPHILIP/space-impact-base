import { base, baseSepolia } from 'viem/chains';

/** Prefer Base mainnet; Sepolia for testing. Override via env. */
export const TARGET_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || base.id);

export const CHAINS = {
  [base.id]: {
    ...base,
    label: 'Base',
    explorer: 'https://basescan.org',
  },
  [baseSepolia.id]: {
    ...baseSepolia,
    label: 'Base Sepolia',
    explorer: 'https://sepolia.basescan.org',
  },
};

export const ACTIVE_CHAIN = CHAINS[TARGET_CHAIN_ID] || CHAINS[base.id];

/**
 * Deployed Level Badge NFT address.
 * Set after running: npm run deploy:base-sepolia  or  npm run deploy:base
 * Leave empty to show mint UI in "demo" mode (local claim record only).
 */
export const NFT_CONTRACT_ADDRESS = (import.meta.env.VITE_NFT_ADDRESS || '').trim();

/** Free Project ID from https://cloud.reown.com — enables WalletConnect QR for mobile */
export const WC_PROJECT_ID = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '').trim();

export const NFT_ABI = [
  {
    type: 'function',
    name: 'mintLevelBadge',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'level', type: 'uint256' },
      { name: 'score', type: 'uint256' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'hasMintedLevel',
    stateMutability: 'view',
    inputs: [
      { name: 'player', type: 'address' },
      { name: 'level', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'tokenURI',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'event',
    name: 'LevelBadgeMinted',
    inputs: [
      { name: 'player', type: 'address', indexed: true },
      { name: 'level', type: 'uint256', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'score', type: 'uint256', indexed: false },
    ],
  },
];

export function shortAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
