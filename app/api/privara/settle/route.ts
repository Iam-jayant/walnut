import { NextResponse } from "next/server";
import { ReineiraSDK } from "@reineira-os/sdk";

export const runtime = "nodejs";

type SettleRequest = {
  user: string;
  interestAmount: string;
  protocolFee: string;
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

    // Validate required fields
    if (!body?.user || !body?.interestAmount || !body?.protocolFee) {
      return NextResponse.json(
        { ok: false, message: "Missing required fields: user, interestAmount, protocolFee" },
        { status: 400 }
      );
    }

    const interestAmount = BigInt(body.interestAmount);
    const protocolFee = BigInt(body.protocolFee);
    
    if (interestAmount <= 0n) {
      return NextResponse.json(
        { ok: false, message: "Interest amount must be greater than zero." },
        { status: 400 }
      );
    }

    if (protocolFee < 0n) {
      return NextResponse.json(
        { ok: false, message: "Protocol fee must be non-negative." },
        { status: 400 }
      );
    }

    // Check for required environment variables
    const privateKey = envOrThrow("PRIVARA_SETTLEMENT_PRIVATE_KEY");
    const lenderPoolAddress = envOrThrow("LENDER_POOL_ADDRESS");
    
    const normalizedPrivateKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
    const rpcUrl =
      process.env.ARBITRUM_SEPOLIA_RPC_URL ??
      process.env.NEXT_PUBLIC_RPC_URL_PRIMARY ??
      envOrThrow("NEXT_PUBLIC_RPC_URL_PRIMARY");

    // Initialize SDK with lender pool address context
    const sdk = ReineiraSDK.create({
      network: body.network ?? "testnet",
      privateKey: normalizedPrivateKey,
      rpcUrl,
      coordinatorUrl: process.env.PRIVARA_COORDINATOR_URL,
    });

    await sdk.initialize();

    // Create escrow with interest amount as escrow value
    // Owner is the lender pool address (receives the interest payment)
    const escrow = await sdk.escrow.create({
      amount: interestAmount,
      owner: lenderPoolAddress,
    });

    // Fund the escrow using the private key from environment variables
    const fundTx = await escrow.fund(interestAmount, { autoApprove: true });

    // Construct Arbiscan URL for the settlement transaction
    const chainId = body.chainId ?? 421614; // Default to Arbitrum Sepolia
    const arbiscanBaseUrl = chainId === 421614 
      ? "https://sepolia.arbiscan.io" 
      : "https://arbiscan.io";
    const arbiscanUrl = `${arbiscanBaseUrl}/tx/${fundTx.tx.hash}`;

    return NextResponse.json({ 
      ok: true, 
      hash: fundTx.tx.hash,
      arbiscanUrl,
      escrowId: escrow.id.toString(),
    });
  } catch (error) {
    const message = formatError(error);
    
    // Check for missing private key error
    if (message.includes("Missing required env var: PRIVARA_SETTLEMENT_PRIVATE_KEY")) {
      return NextResponse.json(
        { ok: false, message: "Missing private key" },
        { status: 500 }
      );
    }

    // Check for missing lender pool address error
    if (message.includes("Missing required env var: LENDER_POOL_ADDRESS")) {
      return NextResponse.json(
        { ok: false, message: "Missing lender pool address" },
        { status: 500 }
      );
    }

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

    // Escrow creation failure
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

