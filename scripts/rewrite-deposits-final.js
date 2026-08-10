const fs = require('fs');
let content = fs.readFileSync('scripts/verify-ens-sepolia.js', 'utf8');

const startIdx = content.indexOf('console.log("\\n[0] Skipping Deposits');
if (startIdx === -1) {
  console.log('Could not find skipping deposits log');
} else {
  const endIdx = content.indexOf('console.log("\\n[1] Creating Privacy Boundary');
  const sectionToReplace = content.substring(startIdx, endIdx);
  
  const newDepositLogic = `console.log("\\n[0] Restoring Deposits: Depositing for Wallet A and B...");
  
  const pkA_fhenix = await cofheClientA.getPublicKey();
  const pkB_fhenix = await cofheClientB.getPublicKey();

  const mockUSDC = await ethers.getContractAt("MockERC20", process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS || "0xbaF9465042BeFA0714E56bcDAddcaF6311FF5F59");

  // Wallet A Deposit (50 USDC)
  console.log("Approving and Depositing 50 USDC for Wallet A...");
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

  // Wallet B (Secondary)
  console.log('Funding walletB with ETH for deposit...');
  const fundTx = await walletA.sendTransaction({
    to: walletB.address,
    value: ethers.parseEther('0.0005')
  });
  await fundTx.wait();

  // Wallet B Deposit (25 USDC)
  console.log("Approving and Depositing 25 USDC for Wallet B...");
  
  // Wallet B needs some MockUSDC first! (Wallet A will mint/transfer it to B)
  console.log("Transferring 25 MockUSDC from Wallet A to Wallet B...");
  await (await mockUSDC.connect(walletA).transfer(walletB.address, 25n)).wait();
  
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
  
  content = content.replace(sectionToReplace, newDepositLogic);
  fs.writeFileSync('scripts/verify-ens-sepolia.js', content);
  console.log('Replaced deposit section successfully!');
}
