import "dotenv/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@cofhe/hardhat-plugin";

import type { HardhatUserConfig } from "hardhat/config";

const rawRpcUrl =
  process.env.ARBITRUM_SEPOLIA_RPC_URL ??
  process.env.NEXT_PUBLIC_RPC_URL_PRIMARY ??
  "https://sepolia-rollup.arbitrum.io/rpc";
const normalizedRpcUrl = rawRpcUrl.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//)
  ? rawRpcUrl
  : `https://${rawRpcUrl}`;

const rawPrivateKey = process.env.PRIVATE_KEY ?? process.env.NEXT_PUBLIC_PRIVATE_KEY ?? "";
const normalizedPrivateKey = rawPrivateKey
  ? rawPrivateKey.startsWith("0x")
    ? rawPrivateKey
    : `0x${rawPrivateKey}`
  : "";

const config: HardhatUserConfig = {
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
    arbitrumSepolia: {
      url: normalizedRpcUrl,
      accounts: normalizedPrivateKey ? [normalizedPrivateKey] : [],
      chainId: 421614,
    },
  },
  etherscan: {
    apiKey: process.env.ARBISCAN_API_KEY || "",
  },
  // Supported plugin config keys only.
  cofhe: {
    logMocks: true,
    gasWarning: true,
  },
};

export default config;
