const { ethers } = require("ethers");

const names = [
  "FHERC20InvalidReceiver(address)",
  "FHERC20InvalidSender(address)",
  "FHERC20UnauthorizedSpender(address,address)",
  "FHERC20ZeroBalance(address)",
  "FHERC20UnauthorizedUseOfEncryptedAmount(euint64,address)",
  "FHERC20UnauthorizedUseOfEncryptedAmount(uint256,address)",
  "FHERC20UnauthorizedCaller(address)",
  "FHERC20IncompatibleFunction()",
  "FHERC20TotalSupplyOverflow()",
  "NativeTransferFailed()",
  "AmountTooSmallForConfidentialPrecision()",
  "ClaimNotFound()",
  "AlreadyClaimed()",
  "LengthMismatch()"
];

for (const name of names) {
    const hash = ethers.id(name).slice(0, 10);
    if (hash === "0xd2251dd5") {
      console.log("FOUND:", name);
    }
}
