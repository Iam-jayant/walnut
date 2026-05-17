import "dotenv/config";
import { createRequire } from "node:module";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { createCofheClient, createCofheConfig } from "@cofhe/sdk/node";
import { Encryptable, FheTypes } from "@cofhe/sdk";
import { arbSepolia } from "@cofhe/sdk/chains";

const require = createRequire(import.meta.url);
const walnutV1Artifact = require("../artifacts/contracts/WalnutV1.sol/WalnutV1.json");

function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[phase0-smoke] Missing required env: ${key}`);
  }
  return value;
}

function normalizePrivateKey(key) {
  if (key.startsWith("0x")) return key;
  return `0x${key}`;
}

async function main() {
  const chainId = Number(requireEnv("NEXT_PUBLIC_CHAIN_ID"));
  const rpcUrl =
    process.env.NEXT_PUBLIC_RPC_URL_PRIMARY ||
    process.env.ARBITRUM_SEPOLIA_RPC_URL ||
    requireEnv("RPC_URL");
  const contractAddress = requireEnv("NEXT_PUBLIC_CONTRACT_ADDRESS");
  const privateKey = normalizePrivateKey(requireEnv("PRIVATE_KEY"));

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(rpcUrl),
  });

  const cofheConfig = createCofheConfig({
    supportedChains: [arbSepolia],
  });
  const cofheClient = createCofheClient(cofheConfig);
  await cofheClient.connect(publicClient, walletClient);

  const permit = await cofheClient.permits.getOrCreateSelfPermit(chainId, account.address);

  console.log("[phase0-smoke] Encrypting 1 unit...");
  const [encryptedAmount] = await cofheClient
    .encryptInputs([Encryptable.uint128(1n)])
    .setChainId(chainId)
    .setAccount(account.address)
    .execute();

  console.log("[phase0-smoke] Submitting deposit...");
  const hash = await walletClient.writeContract({
    address: contractAddress,
    abi: walnutV1Artifact.abi,
    functionName: "deposit",
    args: [encryptedAmount],
    account,
  });

  await publicClient.waitForTransactionReceipt({ hash });

  console.log("[phase0-smoke] Reading encrypted collateral...");
  const encryptedValue = await publicClient.readContract({
    address: contractAddress,
    abi: walnutV1Artifact.abi,
    functionName: "getEncryptedCollateral",
    args: [account.address],
  });

  const ctHash =
    typeof encryptedValue === "object" && encryptedValue !== null
      ? encryptedValue.ctHash ?? encryptedValue[0]
      : encryptedValue;

  console.log("[phase0-smoke] decryptForView...");
  const decrypted = await cofheClient
    .decryptForView(ctHash, FheTypes.Uint128)
    .setChainId(chainId)
    .setAccount(account.address)
    .withPermit(permit)
    .execute();

  console.log(`[phase0-smoke] Decrypted collateral: ${String(decrypted)}`);

  console.log("[phase0-smoke] decryptForTx...");
  const txDecrypt = await cofheClient
    .decryptForTx(ctHash)
    .setChainId(chainId)
    .setAccount(account.address)
    .withPermit(permit)
    .execute();

  console.log("[phase0-smoke] decryptForTx result:");
  console.log({
    ctHash: String(txDecrypt.ctHash),
    decryptedValue: String(txDecrypt.decryptedValue),
    signature: txDecrypt.signature,
  });

  console.log("[phase0-smoke] ✅ Phase 0 smoke test complete.");
}

main().catch((error) => {
  console.error("[phase0-smoke] Failed:", error);
  process.exitCode = 1;
});
