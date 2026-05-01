import type { Abi, Address } from "viem";

import walnutV1Artifact from "@/lib/abi/WalnutV1.json";

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
  "NEXT_PUBLIC_CONTRACT_ADDRESS",
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS
) as Address;

export const walnutV1Abi = walnutV1Artifact.abi as Abi;
