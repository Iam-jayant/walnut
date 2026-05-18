import type { Abi, Address } from "viem";

import walnutV2Artifact from "@/lib/abi/WalnutV2.json";

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
  "NEXT_PUBLIC_V2_CONTRACT_ADDRESS",
  process.env.NEXT_PUBLIC_V2_CONTRACT_ADDRESS
) as Address;

// Wave 4 uses WalnutV2 ABI
export const walnutV2Abi = walnutV2Artifact.abi as Abi;
