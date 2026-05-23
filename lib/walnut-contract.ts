import type { Abi, Address } from "viem";

import walnutLendingArtifact from "@/artifacts/contracts/WalnutLending.sol/WalnutLending.json";

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
  process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS ?? process.env.NEXT_PUBLIC_V2_CONTRACT_ADDRESS
) as Address;

export const walnutLendingAbi = walnutLendingArtifact.abi as Abi;
