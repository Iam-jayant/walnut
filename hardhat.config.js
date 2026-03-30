require("dotenv").config({ override: true });
require("@nomicfoundation/hardhat-ethers");

const rawRpcUrl = process.env.RPC_URL || process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "";
const normalizedRpcUrl = rawRpcUrl
  ? rawRpcUrl.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//)
    ? rawRpcUrl
    : `https://${rawRpcUrl}`
  : "";

const rawPrivateKey = process.env.PRIVATE_KEY || process.env.NEXT_PUBLIC_PRIVATE_KEY || "";
const normalizedPrivateKey = rawPrivateKey
  ? rawPrivateKey.startsWith("0x")
    ? rawPrivateKey
    : `0x${rawPrivateKey}`
  : "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.25",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./contracts",
  },
  networks: {
    sepolia: {
      url: normalizedRpcUrl,
      accounts: normalizedPrivateKey ? [normalizedPrivateKey] : [],
    },
  },
};
