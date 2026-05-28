import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";

export const runtime = "nodejs";

const syncAbi = parseAbi([
  "function syncLoanPrincipal(bytes32 ciphertext, uint128 result, bytes signature) external",
  "function syncLoanRepay(bytes32 ciphertext, uint128 result, bytes signature) external",
  "function syncTotalBorrowed(bytes32 ciphertext, uint128 result, bytes signature) external",
]);

type SyncFunction = "syncLoanPrincipal" | "syncLoanRepay" | "syncTotalBorrowed";

type SyncDecryptRequest = {
  syncFunction?: SyncFunction;
  requestId?: string;
  result?: string;
  signature?: `0x${string}`;
};

function envOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

function normalizePrivateKey(privateKey: string): `0x${string}` {
  return privateKey.startsWith("0x") ? (privateKey as `0x${string}`) : `0x${privateKey}`;
}

function isSyncFunction(value: unknown): value is SyncFunction {
  return value === "syncLoanPrincipal" || value === "syncLoanRepay" || value === "syncTotalBorrowed";
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message || "Unknown sync error";
  return String(error);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SyncDecryptRequest;

    if (!isSyncFunction(body.syncFunction) || !body.requestId || !body.result || !body.signature) {
      return NextResponse.json(
        { ok: false, message: "Missing required fields: syncFunction, requestId, result, signature" },
        { status: 400 }
      );
    }

    if (!body.signature.startsWith("0x")) {
      return NextResponse.json({ ok: false, message: "Invalid decrypt signature" }, { status: 400 });
    }

    const requestId = BigInt(body.requestId);
    const result = BigInt(body.result);

    if (requestId < 0n || result < 0n || result > (1n << 128n) - 1n) {
      return NextResponse.json({ ok: false, message: "Invalid decrypt result bounds" }, { status: 400 });
    }

    const ciphertextHex = ('0x' + requestId.toString(16).padStart(64, '0')) as `0x${string}`;

    const contractAddress = envOrThrow("NEXT_PUBLIC_WALNUT_LENDING_ADDRESS") as `0x${string}`;
    const rpcUrl =
      process.env.ARBITRUM_SEPOLIA_RPC_URL ??
      process.env.NEXT_PUBLIC_RPC_URL_PRIMARY ??
      envOrThrow("NEXT_PUBLIC_RPC_URL_PRIMARY");
    const relayerKey = process.env.PRIVATE_KEY ?? envOrThrow("PRIVARA_SETTLEMENT_PRIVATE_KEY");
    const account = privateKeyToAccount(normalizePrivateKey(relayerKey));

    const publicClient = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(rpcUrl),
    });

    const walletClient = createWalletClient({
      account,
      chain: arbitrumSepolia,
      transport: http(rpcUrl),
    });

    const hash = await walletClient.writeContract({
      address: contractAddress,
      abi: syncAbi,
      functionName: body.syncFunction,
      args: [ciphertextHex, result, body.signature],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      return NextResponse.json({ ok: false, message: "Sync transaction reverted", hash }, { status: 500 });
    }

    return NextResponse.json({ ok: true, hash });
  } catch (error) {
    return NextResponse.json({ ok: false, message: formatError(error) }, { status: 500 });
  }
}
