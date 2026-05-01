import { NextResponse } from "next/server";
import { ReineiraSDK } from "@reineira-os/sdk";

export const runtime = "nodejs";

type SettleRequest = {
  kind: "repay_interest" | "p2p_match";
  user: string;
  counterparty?: string;
  amount: string;
  network?: "testnet" | "mainnet";
  chainId?: number;
};

function formatError(error: unknown): string {
  if (error instanceof Error) {
    const causeMessage =
      typeof (error as { cause?: unknown }).cause === "object" &&
      (error as { cause?: { message?: unknown } }).cause?.message
        ? String((error as { cause?: { message?: unknown } }).cause?.message)
        : null;

    const base = error.message || "Unknown error";
    return causeMessage ? `${base} | cause: ${causeMessage}` : base;
  }
  return String(error);
}

function envOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SettleRequest;

    if (!body?.user || !body?.amount || !body?.kind) {
      return NextResponse.json(
        { ok: false, message: "Invalid settlement payload." },
        { status: 400 }
      );
    }

    const amount = BigInt(body.amount);
    if (amount <= 0n) {
      return NextResponse.json(
        { ok: false, message: "Settlement amount must be greater than zero." },
        { status: 400 }
      );
    }

    const privateKey = envOrThrow("PRIVARA_SETTLEMENT_PRIVATE_KEY");
    const normalizedPrivateKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
    const rpcUrl =
      process.env.ARBITRUM_SEPOLIA_RPC_URL ??
      process.env.NEXT_PUBLIC_RPC_URL_PRIMARY ??
      envOrThrow("NEXT_PUBLIC_RPC_URL_PRIMARY");

    const sdk = ReineiraSDK.create({
      network: body.network ?? "testnet",
      privateKey: normalizedPrivateKey,
      rpcUrl,
      coordinatorUrl: process.env.PRIVARA_COORDINATOR_URL,
    });

    await sdk.initialize();

    // Keep server-side settlement behavior equivalent to the previous client-side path.
    const escrow = await sdk.escrow.create({
      amount,
      owner: body.user,
    });
    const tx = await escrow.redeem();

    return NextResponse.json({ ok: true, hash: tx.hash });
  } catch (error) {
    const message = formatError(error);
    const isCofheInitFailure =
      message.includes("FHE initialization failed") ||
      message.includes("CofhejsError") ||
      message.includes("Error serializing public key");

    if (isCofheInitFailure) {
      return NextResponse.json(
        {
          ok: false,
          message:
            `${message}. Reineira SDK currently depends on cofhejs/node initialization; this error is environment/SDK-level (not repay tx failure). Try Node 20 LTS runtime for this server process and verify Reineira SDK/cofhejs compatibility with Arbitrum Sepolia.`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

