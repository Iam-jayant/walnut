const { ethers } = require("ethers");

const errors = [
  "ERC20InsufficientAllowance(address,uint256,uint256)",
  "ERC20InsufficientBalance(address,uint256,uint256)",
  "ERC20InvalidApprover(address)",
  "ERC20InvalidSpender(address)",
  "FHEAllowanceError()",
  "InsufficientAllowance()",
  "OnlyMinter()",
  "Unauthorized()",
  "InvalidSignature()",
  "ERC20InsufficientAllowance(address,uint256,uint128)",
  "ERC20InsufficientAllowance(address,euint128,euint128)"
];

for (const err of errors) {
  if (ethers.id(err).slice(0, 10) === "0xd2251dd5") {
    console.log("MATCH FOUND:", err);
  }
}
