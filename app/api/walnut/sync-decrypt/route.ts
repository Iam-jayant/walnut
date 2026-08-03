import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";

export const runtime = "nodejs";

const syncAbi = parseAbi([
  "function syncBorrowActive(bytes32 ciphertext, uint128 result, bytes signature) external",
  "function syncLoanRepay(bytes32 ciphertext, uint128 result, bytes signature) external",
  "function syncTotalBorrowed(bytes32 ciphertext, uint128 result, bytes signature) external",
  "function syncDepositTransfer(bytes32 ciphertext, uint128 result, bytes signature) external",
  "function syncWithdrawTransfer(bytes32 ciphertext, uint128 result, bytes signature) external",
  "function syncWinnerSelection(bytes32 ciphertext, uint128 result, bytes signature) external",
  "function syncPositionGuardCheck(bytes32 ciphertext, uint128 result, bytes signature) external",
  "function syncLiquidationCheck(bytes32 ciphertext, uint128 result, bytes signature) external",
]);

type SyncFunction =
  | "syncBorrowActive"
  | "syncLoanRepay"
  | "syncTotalBorrowed"
  | "syncDepositTransfer"
  | "syncWithdrawTransfer"
  | "syncWinnerSelection"
  | "syncPositionGuardCheck"
  | "syncLiquidationCheck";

type SyncDecryptRequest = {
  syncFunction?: SyncFunction;
  requestId?: string;
  result?: string;
  signature?: `0x${string}`;
  borrower?: `0x${string}`;
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
  return (
    value === "syncBorrowActive" ||
    value === "syncLoanPrincipal" ||
    value === "syncLoanRepay" ||
    value === "syncTotalBorrowed" ||
    value === "syncDepositTransfer" ||
    value === "syncWithdrawTransfer" ||
    value === "syncWinnerSelection" ||
    value === "syncPositionGuardCheck" ||
    value === "syncLiquidationCheck"
  );
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message || "Unknown sync error";
  return String(error);
}

const ipCache = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 20;

  const record = ipCache.get(ip);
  if (!record) {
    ipCache.set(ip, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
    return false;
  }

  record.count += 1;
  return record.count > maxRequests;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { ok: false, message: "Too many requests. Please try again in a minute." },
        { status: 429 }
      );
    }

    const body = (await request.json()) as SyncDecryptRequest;

    if (!isSyncFunction(body.syncFunction) || !body.requestId || !body.result || !body.signature) {
      return NextResponse.json(
        { ok: false, message: "Missing required fields: syncFunction, requestId, result, signature" },
        { status: 400 }
      );
    }

    if (body.syncFunction === "syncWinnerSelected" && !body.borrower) {
      return NextResponse.json(
        { ok: false, message: "Missing borrower address for syncWinnerSelected" },
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

    const ciphertextHex = ("0x" + requestId.toString(16).padStart(64, "0")) as `0x${string}`;

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
      args: body.syncFunction === "syncWinnerSelected"
        ? [body.borrower as `0x${string}`, ciphertextHex, result, body.signature] as const
        : [ciphertextHex, result, body.signature] as const,
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
