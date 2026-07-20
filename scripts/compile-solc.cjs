const fs = require('fs');
const path = require('path');
const solc = require('solc');

const root = path.join(__dirname, '..');
const sourcePath = path.join(root, 'contracts', 'LevelBadgeNFT.sol');
const outDir = path.join(root, 'src', 'contracts');
const source = fs.readFileSync(sourcePath, 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'LevelBadgeNFT.sol': { content: source },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object'],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
  const fatal = output.errors.filter((e) => e.severity === 'error');
  for (const e of output.errors) console.log(e.formattedMessage || e.message);
  if (fatal.length) process.exit(1);
}

const contract = output.contracts['LevelBadgeNFT.sol']['LevelBadgeNFT'];
if (!contract) {
  console.error('Compile failed: contract not found in output');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const artifact = {
  contractName: 'LevelBadgeNFT',
  abi: contract.abi,
  bytecode: `0x${contract.evm.bytecode.object}`,
};
fs.writeFileSync(path.join(outDir, 'LevelBadgeNFT.json'), JSON.stringify(artifact, null, 2));
console.log('Wrote src/contracts/LevelBadgeNFT.json');
console.log('Bytecode length:', artifact.bytecode.length);
