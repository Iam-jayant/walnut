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
    // TODO: Temporary mock for Privara SDK settlement on testnet
    // The ReineiraSDK defaults to hardcoded testnet addresses (e.g. escrow: 0xbe1...)
    // which do not exist on Arbitrum Sepolia. We bypass the SDK here to allow testing.
    // This will be fixed upon Mainnet launch when Privara deploys to the main network.
    
    // Simulate a brief network delay (e.g., 2.5 seconds)
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    const mockTxHash = "0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
    const chainId = body.chainId ?? 421614; // Default to Arbitrum Sepolia
    const arbiscanBaseUrl = chainId === 421614 
      ? "https://sepolia.arbiscan.io" 
      : "https://arbiscan.io";
    const arbiscanUrl = `${arbiscanBaseUrl}/tx/${mockTxHash}`;

    return NextResponse.json({ 
      ok: true, 
      hash: mockTxHash,
      arbiscanUrl,
      escrowId: Math.floor(Math.random() * 1000).toString(),
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

