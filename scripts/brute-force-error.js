const { ethers } = require("ethers");

const names = [
  "ERC20InsufficientAllowance",
  "ERC20InsufficientBalance",
  "ERC20InvalidApprover",
  "ERC20InvalidSpender",
  "ERC20InvalidReceiver",
  "ERC20InvalidSender",
  "FHEAllowanceError",
  "FHEBalanceError",
  "AllowanceError",
  "InsufficientAllowance",
  "ERC20AllowanceError",
  "Error",
  "FHEERC20InsufficientAllowance"
];

const types = [
  "",
  "(address,uint256,uint256)",
  "(address,uint256,uint128)",
  "(address,euint128,euint128)",
  "(address)",
  "(address,address,euint64)",
  "(address,address,uint256)",
  "(address,uint256)",
  "(uint256)",
];

for (const name of names) {
  for (const type of types) {
    const sig = name + type;
    const hash = ethers.id(sig).slice(0, 10);
    if (hash === "0xd2251dd5") {
      console.log("FOUND:", sig);
    }
  }
}
