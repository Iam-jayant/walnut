import type { Abi, Address } from "viem";

import walnutLendingAbiRaw from "../abis/WalnutLending.deployed.json";
import walnutP2pAbiRaw from "../abis/WalnutP2P.deployed.json";
import walnutWrapperAbiRaw from "../abis/WalnutVaultWrapper.deployed.json";

function requirePublicEnv(key: string, value: string | undefined) {
  if (!value) {
    throw new Error(`[walnut-contract] Missing required environment variable: ${key}`);
  }

  return value;
}

const chainIdRaw = requirePublicEnv("NEXT_PUBLIC_CHAIN_ID", process.env.NEXT_PUBLIC_CHAIN_ID);
const parsedChainId = Number(chainIdRaw);

if (!Number.isInteger(parsedChainId) || parsedChainId <= 0) {
  throw new Error(
    `[walnut-contract] NEXT_PUBLIC_CHAIN_ID must be a positive integer. Received: ${chainIdRaw}`
  );
}

export const walnutChainId = parsedChainId;

export const walnutRpcUrl = requirePublicEnv(
  "NEXT_PUBLIC_RPC_URL_PRIMARY",
  process.env.NEXT_PUBLIC_RPC_URL_PRIMARY
);

export const walnutContractAddress = requirePublicEnv(
  "NEXT_PUBLIC_WALNUT_LENDING_ADDRESS",
  process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS
) as Address;

export const walnutFherc20Address = requirePublicEnv(
  "NEXT_PUBLIC_FHERC20_ADDRESS",
  process.env.NEXT_PUBLIC_FHERC20_ADDRESS
) as Address;

export const walnutOracleAddress = requirePublicEnv(
  "NEXT_PUBLIC_ORACLE_ADDRESS",
  process.env.NEXT_PUBLIC_ORACLE_ADDRESS
) as Address;

export const walnutMockUsdcAddress = requirePublicEnv(
  "NEXT_PUBLIC_MOCK_USDC_ADDRESS",
  process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS
) as Address;

export const walnutP2PAddress = requirePublicEnv(
  "NEXT_PUBLIC_WALNUT_P2P_ADDRESS",
  process.env.NEXT_PUBLIC_WALNUT_P2P_ADDRESS
) as Address;

export const walnutWrapperAddress = requirePublicEnv(
  "NEXT_PUBLIC_WRAPPER_ADDRESS",
  process.env.NEXT_PUBLIC_WRAPPER_ADDRESS
) as Address;

export const walnutLendingAbi = walnutLendingAbiRaw as unknown as Abi;
export const walnutP2pAbi = walnutP2pAbiRaw as unknown as Abi;
export const walnutWrapperAbi = walnutWrapperAbiRaw as unknown as Abi;

export const erc20Abi = [
  { inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], name: "approve", outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], name: "allowance", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "account", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "decimals", outputs: [{ name: "", type: "uint8" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "mint", outputs: [], stateMutability: "nonpayable", type: "function" },
] as const;

export async function getGasFeeOverrides(publicClient: any) {
  try {
    const feeEstimate = await publicClient?.estimateFeesPerGas();
    if (feeEstimate?.maxFeePerGas) {
      return {
        maxFeePerGas: (feeEstimate.maxFeePerGas * 150n) / 100n, // 50% buffer for Arbitrum Sepolia base fee surges
        maxPriorityFeePerGas: feeEstimate.maxPriorityFeePerGas
          ? (feeEstimate.maxPriorityFeePerGas * 150n) / 100n
          : undefined,
      };
    }
  } catch (error) {
    console.warn("[Walnut Gas Helper] Failed to estimate gas fees:", error);
  }
  return {};
}
