/**
 * Deploy LevelBadgeNFT to Base or Base Sepolia.
 *
 * Usage:
 *   set PRIVATE_KEY=0x...
 *   set RPC_URL=https://sepolia.base.org   (optional)
 *   node scripts/deploy.cjs base-sepolia
 *   node scripts/deploy.cjs base
 */
const fs = require('fs');
const path = require('path');
const { createWalletClient, createPublicClient, http, formatEther } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base, baseSepolia } = require('viem/chains');

async function main() {
  const target = (process.argv[2] || 'base-sepolia').toLowerCase();
  const chain = target === 'base' ? base : baseSepolia;
  const defaultRpc =
    target === 'base' ? 'https://mainnet.base.org' : 'https://sepolia.base.org';
  const rpc = process.env.RPC_URL || defaultRpc;
  const pk = process.env.PRIVATE_KEY;
  if (!pk) {
    console.error('Set PRIVATE_KEY env var (deployer key with Base ETH).');
    process.exit(1);
  }

  const artifactPath = path.join(__dirname, '..', 'src', 'contracts', 'LevelBadgeNFT.json');
  if (!fs.existsSync(artifactPath)) {
    console.error('Missing artifact. Run: npm run compile');
    process.exit(1);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);

  const publicClient = createPublicClient({ chain, transport: http(rpc) });
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpc),
  });

  const bal = await publicClient.getBalance({ address: account.address });
  console.log('Deployer:', account.address);
  console.log('Chain:', chain.name, `(${chain.id})`);
  console.log('Balance:', formatEther(bal), 'ETH');

  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [],
  });
  console.log('Deploy tx:', hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const address = receipt.contractAddress;
  console.log('LevelBadgeNFT:', address);

  const envLine = `VITE_NFT_ADDRESS=${address}\nVITE_CHAIN_ID=${chain.id}\n`;
  const envPath = path.join(__dirname, '..', '.env');
  fs.writeFileSync(envPath, envLine);
  console.log('Wrote .env with contract address. Restart `npm run dev`.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
