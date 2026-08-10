const fs = require('fs');

let content = fs.readFileSync('scripts/verify-ens-sepolia.js', 'utf8');

// 1. Restore Deposit Logic
const skipDepositLog = `console.log("\\n[0] Skipping Deposits (deposit is incompatible with live CoFHE without FHE.req)...\\nUsing empty balances (0) to prove aggregation and privacy.");`;

const newDepositLogic = `
  console.log("\\n[0] Restoring Deposits: Depositing for Wallet A and B...");
  
  // Need to ensure the public key is fetched for the clients first!
  const pkA_fhenix = await cofheClientA.getPublicKey();
  const pkB_fhenix = await cofheClientB.getPublicKey();

  const mockUSDC = await ethers.getContractAt("MockERC20", process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS || "0xbaF9465042BeFA0714E56bcDAddcaF6311FF5F59");

  // Wallet A Deposit (50 USDC)
  console.log("Approving & Depositing 50 USDC for Wallet A...");
  await (await mockUSDC.connect(walletA).approve(contractAddress, 50n)).wait();
  
  const encA = Encryptable.from(50).setPublicKey(pkA_fhenix);
  const ctA = (await cofheClientA.encrypt(encA)).data;
  const inputA = {
      ctHash: ctA.ctHash,
      securityZone: ctA.securityZone,
      utype: ctA.utype,
      signature: "0x"
  };
  await (await contract.connect(walletA).deposit(mockUSDC.target, inputA)).wait();
  console.log("Wallet A deposit successful.");

  // Wallet B Deposit (25 USDC)
  console.log("Approving & Depositing 25 USDC for Wallet B...");
  await (await mockUSDC.connect(walletB).approve(contractAddress, 25n)).wait();

  const encB = Encryptable.from(25).setPublicKey(pkB_fhenix);
  const ctB = (await cofheClientB.encrypt(encB)).data;
  const inputB = {
      ctHash: ctB.ctHash,
      securityZone: ctB.securityZone,
      utype: ctB.utype,
      signature: "0x"
  };
  await (await contract.connect(walletB).deposit(mockUSDC.target, inputB)).wait();
  console.log("Wallet B deposit successful.");
`;

content = content.replace(skipDepositLog, newDepositLogic);

// 2. Remove the getAggregatedCollateralCtHash calls which are unnecessary since we use real balances
const oldCtHashLogic = `const ctHashA = await contract.getAggregatedCollateralCtHash(walletA.address);
  const ctHashB = await contract.getAggregatedCollateralCtHash(walletB.address);`;

const newCtHashLogic = `// Fetch the real encrypted balances from the contract state
  const ctTupleA = await contract.getEncryptedCollateral(walletA.address);
  const ctHashA = ctTupleA[0];
  
  const ctTupleB = await contract.getEncryptedCollateral(walletB.address);
  const ctHashB = ctTupleB[0];`;

content = content.replace(oldCtHashLogic, newCtHashLogic);

fs.writeFileSync('scripts/verify-ens-sepolia.js', content);
console.log('Done restoring deposits.');
