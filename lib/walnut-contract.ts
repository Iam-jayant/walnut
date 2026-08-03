import type { Abi, Address } from "viem";

import walnutLendingAbiRaw from "../abis/WalnutLending.deployed.json";

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

export const walnutLendingAbi = walnutLendingAbiRaw as unknown as Abi;

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


