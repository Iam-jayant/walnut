const fs = require('fs');
let content = fs.readFileSync('scripts/verify-ens-sepolia.js', 'utf-8');

const setupCode = `  const rpcUrl = "https://sepolia-rollup.arbitrum.io/rpc";
  const etherProvider = new ethers.JsonRpcProvider(rpcUrl);
  const etherWalletA = new ethers.Wallet(pkA, etherProvider);
  const walletA = etherWalletA;
  const etherWalletC = new ethers.Wallet(pkC, etherProvider);

  const { createCofheConfig, createCofheClient } = require("@cofhe/sdk/node");
  const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(rpcUrl) });
  
  const cofheConfig = createCofheConfig({
    environment: "node",
    supportedChains: [arbSepolia],
    useWorker: false
  });
  
  const walletClientA = createWalletClient({ account: accountA, chain: arbitrumSepolia, transport: http(rpcUrl) });
  const cofheClientA = createCofheClient(cofheConfig);
  cofheClientA.config.useWorker = false;
  await cofheClientA.connect(publicClient, walletClientA);

  const walletClientB = createWalletClient({ account: privateKeyToAccount(walletB.privateKey), chain: arbitrumSepolia, transport: http(rpcUrl) });
  const cofheClientB = createCofheClient(cofheConfig);
  cofheClientB.config.useWorker = false;
  await cofheClientB.connect(publicClient, walletClientB);

  const walletClientC = createWalletClient({ account: accountC, chain: arbitrumSepolia, transport: http(rpcUrl) });
  const cofheClientC = createCofheClient(cofheConfig);
  cofheClientC.config.useWorker = false;
  await cofheClientC.connect(publicClient, walletClientC);
`;

const lines = content.split('\n');
const out = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('const walletA = etherWalletA;')) continue;
    if (line.includes('const etherProvider =')) continue;
    if (line.includes('const etherWalletA =')) continue;
    if (line.includes('const etherWalletC =')) continue;
    if (line.includes('const { createCofheConfig, createCofheClient } = require("@cofhe/sdk/node");')) continue;
    if (line.includes('const rpcUrl = "https://sepolia-rollup.arbitrum.io/rpc";')) continue;
    if (line.includes('const publicClient =')) continue;
    if (line.includes('const walletClientB =')) continue;
    if (line.includes('const cofheConfig =')) continue;
    if (line.includes("environment: 'node',") || line.includes('environment: "node",')) continue;
    if (line.includes('supportedChains: [arbSepolia],')) continue;
    if (line.includes('useWorker: false')) continue;
    if (line.trim() === '});' && (lines[i-1] && lines[i-1].includes('useWorker: false'))) continue;
    if (line.includes('const cofheClientB =')) continue;
    if (line.includes('cofheClientB.config.useWorker')) continue;
    if (line.includes('await cofheClientB.connect')) continue;
    if (line.includes('const walletClientA =')) continue;
    if (line.includes('const cofheClientA =')) continue;
    if (line.includes('await cofheClientA.connect')) continue;
    if (line.includes('const walletClientC =')) continue;
    if (line.includes('const cofheClientC =')) continue;
    if (line.includes('await cofheClientC.connect')) continue;
    if (line.includes('// Also disable worker manually if it')) continue;
    
    if (line.includes('async function main() {')) {
        out.push(line);
        out.push(setupCode);
    } else {
        out.push(line);
    }
}

fs.writeFileSync('scripts/verify-ens-sepolia.js', out.join('\n'));
console.log('Rewrote verify-ens-sepolia.js successfully!');
