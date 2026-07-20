import { encodeFunctionData, decodeEventLog } from 'viem';
import {
  NFT_CONTRACT_ADDRESS,
  NFT_ABI,
  ACTIVE_CHAIN,
  TARGET_CHAIN_ID,
} from './config.js';
import { wallet } from './connect.js';

const LOCAL_KEY = 'space-impact-base:minted-levels';

function loadLocalMints(address) {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    return new Set(raw[address?.toLowerCase()] || []);
  } catch {
    return new Set();
  }
}

function saveLocalMint(address, level) {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    const key = address.toLowerCase();
    const arr = new Set(raw[key] || []);
    arr.add(Number(level));
    raw[key] = [...arr];
    localStorage.setItem(LOCAL_KEY, JSON.stringify(raw));
  } catch {
    /* ignore */
  }
}

export function isContractConfigured() {
  return Boolean(NFT_CONTRACT_ADDRESS && /^0x[a-fA-F0-9]{40}$/.test(NFT_CONTRACT_ADDRESS));
}

export async function hasMintedLevel(level) {
  const snap = wallet.snapshot();
  if (!snap.connected) return false;

  if (!isContractConfigured()) {
    return loadLocalMints(snap.address).has(Number(level));
  }

  try {
    const client = wallet.getPublicClient();
    return await client.readContract({
      address: NFT_CONTRACT_ADDRESS,
      abi: NFT_ABI,
      functionName: 'hasMintedLevel',
      args: [snap.address, BigInt(level)],
    });
  } catch {
    return loadLocalMints(snap.address).has(Number(level));
  }
}

export async function getBadgeCount() {
  const snap = wallet.snapshot();
  if (!snap.connected) return 0;

  if (!isContractConfigured()) {
    return loadLocalMints(snap.address).size;
  }

  try {
    const client = wallet.getPublicClient();
    const bal = await client.readContract({
      address: NFT_CONTRACT_ADDRESS,
      abi: NFT_ABI,
      functionName: 'balanceOf',
      args: [snap.address],
    });
    return Number(bal);
  } catch {
    return loadLocalMints(snap.address).size;
  }
}

/**
 * Mint a level-clear badge on Base.
 * If contract address is not set, records a local demo claim.
 */
export async function mintLevelBadge(level, score) {
  const snap = wallet.snapshot();
  if (!snap.connected) {
    throw new Error('Connect a wallet first.');
  }
  if (!snap.onBase) {
    await wallet.switchToBase();
  }
  if (wallet.snapshot().chainId !== TARGET_CHAIN_ID) {
    throw new Error(`Switch your wallet to ${ACTIVE_CHAIN.label}.`);
  }

  if (await hasMintedLevel(level)) {
    throw new Error(`You already claimed the Level ${level} badge.`);
  }

  // Demo / local mode when contract not deployed
  if (!isContractConfigured()) {
    await new Promise((r) => setTimeout(r, 600));
    saveLocalMint(snap.address, level);
    return {
      mode: 'local',
      level,
      txHash: null,
      message: `Demo claim saved for Level ${level}. Deploy the NFT contract to mint on-chain.`,
    };
  }

  const data = encodeFunctionData({
    abi: NFT_ABI,
    functionName: 'mintLevelBadge',
    args: [BigInt(level), BigInt(score)],
  });

  const hash = await wallet.walletClient.sendTransaction({
    account: snap.address,
    to: NFT_CONTRACT_ADDRESS,
    data,
    chain: ACTIVE_CHAIN,
  });

  const client = wallet.getPublicClient();
  const receipt = await client.waitForTransactionReceipt({ hash });

  let tokenId = null;
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: NFT_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === 'LevelBadgeMinted') {
        tokenId = decoded.args.tokenId?.toString?.() ?? null;
        break;
      }
    } catch {
      /* not our event */
    }
  }

  saveLocalMint(snap.address, level);

  return {
    mode: 'onchain',
    level,
    tokenId,
    txHash: hash,
    explorer: `${ACTIVE_CHAIN.explorer}/tx/${hash}`,
    message: `Minted Level ${level} badge on ${ACTIVE_CHAIN.label}.`,
  };
}
