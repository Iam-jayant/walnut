"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import type { Address } from "viem";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useCofheEncrypt } from "@cofhe/react";
import { Encryptable } from "@cofhe/sdk";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";
import { useToast } from "@/components/walnut/toast-provider";
import { wagmiConfig } from "@/lib/web3-config";
import {
  walnutChainId,
  walnutLendingAbi,
  walnutContractAddress as WALNUT_LENDING_ADDRESS,
  walnutMockUsdcAddress as MOCK_USDC_ADDRESS,
  walnutOracleAddress as ORACLE_ADDRESS,
} from "@/lib/walnut-contract";

const targetChainName =
  wagmiConfig.chains.find((chain) => chain.id === walnutChainId)?.name ??
  `Chain ${walnutChainId}`;

// Supported tokens on Arbitrum Sepolia
const SUPPORTED_TOKENS = [
  {
    address: MOCK_USDC_ADDRESS,
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  {
    address: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73" as Address,
    symbol: "WETH",
    name: "Wrapped Ethereum",
    decimals: 18,
  },
  {
    address: "0x152b0df80135c63b4cb1fbe00ddce7e9a8ffcb04" as Address,
    symbol: "LINK",
    name: "Chainlink Token",
    decimals: 18,
  },
] as const;

function TokenBadge({ symbol, name }: { symbol: string; name?: string }) {
  const TOKEN_IMAGES: Record<string, string> = {
    USDC: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png",
    cUSDC: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png",
    WETH: "https://assets.coingecko.com/coins/images/2518/standard/weth.png",
    LINK: "https://assets.coingecko.com/coins/images/877/large/chainlink.png",
  };
  const src = TOKEN_IMAGES[symbol] ?? `/tokens/${symbol.toLowerCase()}.png`;
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [src]);

  if (process.env.NODE_ENV === "development") {
    console.debug(`[TokenBadge] symbol=${symbol} src=${src} imgError=${imgError}`);
  }

  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-sm hover:scale-105 transition-transform cursor-pointer overflow-hidden bg-slate-100 border border-slate-200">
        {!imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`${symbol} logo`} onError={() => setImgError(true)} className="w-full h-full object-cover" />
        ) : (
          <div className="text-xs font-bold text-slate-500">{symbol.slice(0, 3)}</div>
        )}
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-900">{symbol}</div>
        <div className="text-xs text-muted-foreground">{name}</div>
      </div>
    </div>
  );
}

function TokenDropdown({ value, onChange, className }: { value: Address; onChange: (a: Address) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (e.target instanceof Node && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const selected = SUPPORTED_TOKENS.find((t) => t.address.toLowerCase() === value.toLowerCase()) ?? SUPPORTED_TOKENS[0];

  return (
    <div ref={ref} className={`${className} relative`}>
      <button type="button" onClick={() => setOpen((s) => !s)} className="w-full flex items-center justify-between gap-3 p-3 border rounded-xl bg-white shadow-sm">
        <TokenBadge symbol={selected.symbol} name={selected.name} />
        <span className="text-sm text-muted-foreground">▾</span>
      </button>

      {open && (
        <div className="absolute z-40 mt-2 w-full rounded-2xl border bg-white shadow-xl">
          {SUPPORTED_TOKENS.map((t) => (
            <button
              key={t.address}
              onClick={() => {
                onChange(t.address);
                setOpen(false);
              }}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3"
            >
              <TokenBadge symbol={t.symbol} name={t.name} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Oracle ABI (minimal)
const ORACLE_ABI = [
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "getUSDValue",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

type WithdrawStep = "idle" | "withdraw_pending" | "withdraw_confirmed" | "error";

function assertSuccessReceipt(receipt: { status?: "success" | "reverted" }) {
  if (receipt.status && receipt.status !== "success") {
    throw new Error("Transaction reverted on-chain.");
  }
}

export default function WithdrawPage() {
  const account = useAccount();
  const publicClient = usePublicClient();
  const { addToast } = useToast();
  const protocol = useWalnutProtocol();
  const encryptor = useCofheEncrypt();

  const [selectedToken, setSelectedToken] = useState<Address>(MOCK_USDC_ADDRESS);
  const [amount, setAmount] = useState("");
  const [withdrawStep, setWithdrawStep] = useState<WithdrawStep>("idle");
  const [withdrawTxHash, setWithdrawTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasActiveLoan = protocol.hasActiveLoan;

  const tokenInfo = useMemo(() => {
    const fromSupported = SUPPORTED_TOKENS.find((t) => t.address.toLowerCase() === selectedToken.toLowerCase());
    if (!fromSupported) return undefined;
    return {
      token: fromSupported.address,
      symbol: fromSupported.symbol,
      decimals: fromSupported.decimals,
    };
  }, [selectedToken]);

  const collateralUsd = protocol.collateral.decrypted.data ?? 0n;

  // Parse amount to bigint
  const parsedAmount = useMemo(() => {
    if (!amount || !/^\d+(\.\d+)?$/.test(amount)) return 0n;
    try {
      const decimals = tokenInfo?.decimals ?? 6;
      const parts = amount.split(".");
      const integerPart = parts[0] || "0";
      const decimalPart = (parts[1] || "").padEnd(decimals, "0").slice(0, decimals);
      return BigInt(integerPart + decimalPart);
    } catch {
      return 0n;
    }
  }, [amount, tokenInfo]);

  // Get USD value
  const { data: usdValue } = useReadContract({
    address: ORACLE_ADDRESS,
    abi: ORACLE_ABI,
    functionName: "getUSDValue",
    args: [selectedToken, parsedAmount],
    query: {
      enabled: parsedAmount > 0n,
    },
  });

  // Format USD value
  const formattedUsdValue = useMemo(() => {
    if (!usdValue || usdValue === 0n) return "$0.00";
    const value = Number(usdValue) / 1e6; // 6 decimals
    return `$${value.toFixed(2)}`;
  }, [usdValue]);

  const exceedsCollateral = useMemo(() => {
    if (!usdValue || usdValue === 0n) return false;
    return usdValue > collateralUsd;
  }, [collateralUsd, usdValue]);

  // Withdraw contract
  const { writeContractAsync: withdrawAsync } = useWriteContract();
  const { isLoading: isWithdrawConfirming } = useWaitForTransactionReceipt({
    hash: withdrawTxHash as `0x${string}` | undefined,
  });

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!account.address || parsedAmount === 0n || exceedsCollateral || !usdValue) return;

    try {
      setWithdrawStep("withdraw_pending");
      setErrorMessage(null);

      let encryptedAmountVal;
      try {
        const [encAmount] = await encryptor.encryptInputsAsync({
          items: [Encryptable.uint128(parsedAmount)],
          account: account.address,
          chainId: walnutChainId,
        });
        encryptedAmountVal = encAmount;
      } catch (err) {
        console.error("FHE Encryption failed", err);
        throw new Error("Withdrawal encryption failed. Please make sure your wallet supports FHE encryption.");
      }

      const gasPrice = await publicClient?.getGasPrice();
      const maxFeePerGas = gasPrice ? (gasPrice * 150n) / 100n : undefined;
      const maxPriorityFeePerGas = gasPrice ? (gasPrice * 10n) / 100n : undefined;

      const hash = await withdrawAsync({
        address: WALNUT_LENDING_ADDRESS,
        abi: walnutLendingAbi,
        functionName: "withdraw",
        args: [selectedToken, encryptedAmountVal as any],
        maxFeePerGas,
        maxPriorityFeePerGas,
      });

      setWithdrawTxHash(hash);
      addToast({ variant: "pending", message: "Withdraw transaction submitted..." });

      // Wait for confirmation
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        assertSuccessReceipt(receipt);
        // Sync decryption to execute ERC20 transfer and update collateral on-chain
        await protocol.syncDecryptResultsFromReceipt("withdraw", receipt as any);
      }

      setWithdrawStep("withdraw_confirmed");
      addToast({ variant: "success", message: "Withdraw request submitted. CoFHE settlement pending." });

      await protocol.refreshBalances();

      // Reset form
      setAmount("");
      setWithdrawTxHash(null);

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setWithdrawStep("idle");
      }, 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Withdraw failed";
      setErrorMessage(message);
      setWithdrawStep("error");
      addToast({ variant: "error", message });
    }
  };

  // Handle user cancellation
  const handleCancel = () => {
    setWithdrawStep("idle");
    setWithdrawTxHash(null);
    setErrorMessage(null);
  };

  // Determine button state
  const isProcessing = withdrawStep === "withdraw_pending" || isWithdrawConfirming;
  const canSubmit =
    parsedAmount > 0n &&
    !isProcessing &&
    withdrawStep !== "withdraw_confirmed" &&
    !exceedsCollateral &&
    !hasActiveLoan;

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Withdraw Collateral</h1>
        <p className="text-sm text-muted-foreground">Withdraw ERC20 tokens from your vault.</p>
      </header>

      <div className="border rounded-lg p-4">
        <div className="mb-3 text-sm font-medium">
          Status: {withdrawStep === "idle" ? (parsedAmount > 0n ? (exceedsCollateral ? "Amount exceeds encrypted collateral" : "Ready to withdraw") : "Enter amount to continue") : withdrawStep === "withdraw_pending" ? "Submitting withdrawal request..." : withdrawStep === "withdraw_confirmed" ? "Withdrawal request submitted" : "Transaction failed"} — {targetChainName}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <section className="md:col-span-2 space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase text-muted-foreground">Select Token</label>
              <TokenDropdown className="mt-2 w-full" value={selectedToken} onChange={(addr: Address) => setSelectedToken(addr)} />
            </div>

            {hasActiveLoan && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-900">Active Loan Detected</p>
                    <p className="text-sm text-amber-700 mt-1">Repay your loan before withdrawing collateral.</p>
                    <a
                      href="/app/repay"
                      className="inline-flex items-center gap-1 mt-3 px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors"
                    >
                      Go to Repay →
                    </a>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-mono uppercase text-muted-foreground">Amount</label>
              <Input
                id="withdraw-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className="mt-2 w-full"
                disabled={isProcessing}
              />
              <div className="text-xs text-muted-foreground mt-1">
                Encrypted collateral: ${(Number(collateralUsd) / 1e6).toFixed(2)} USD
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {[
                { label: "25%", value: parsedAmount > 0n ? parsedAmount / 4n : 0n },
                { label: "50%", value: parsedAmount > 0n ? parsedAmount / 2n : 0n },
                { label: "75%", value: parsedAmount > 0n ? (parsedAmount * 3n) / 4n : 0n },
                { label: "Max", value: parsedAmount },
              ].map((option) => {
                const displayValue = tokenInfo && option.value > 0n
                  ? (Number(option.value) / 10 ** tokenInfo.decimals).toFixed(6)
                  : "0";
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setAmount(displayValue)}
                    disabled={isProcessing || option.value === 0n}
                    className="px-3 py-1 border rounded text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {exceedsCollateral && withdrawStep === "idle" && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700">Amount exceeds your encrypted collateral. Enter a lower value.</p>
              </div>
            )}

            {withdrawStep !== "idle" && (
              <div className="p-3 border rounded">
                <div className="font-medium">Transaction Progress</div>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    {withdrawStep === "withdraw_pending" || isWithdrawConfirming ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : withdrawStep === "withdraw_confirmed" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : withdrawStep === "error" ? (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border" />
                    )}
                    <div>
                      Withdraw from Walnut
                      {withdrawTxHash && (
                        <a
                          href={`https://sepolia.arbiscan.io/tx/${withdrawTxHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 text-xs text-blue-600 hover:underline"
                        >
                          View
                        </a>
                      )}
                    </div>
                  </div>
                  {errorMessage && <div className="text-sm text-red-700">{errorMessage}</div>}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleWithdraw}
                disabled={!canSubmit}
                className="px-4 py-2 bg-black text-white rounded disabled:cursor-not-allowed disabled:opacity-50"
              >
                {hasActiveLoan ? "Repay Loan First" : "Withdraw"}
              </button>
              {withdrawStep === "error" && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 border rounded"
                >
                  Cancel
                </button>
              )}
            </div>
          </section>

          <aside className="space-y-3">
            <div className="p-3 border rounded">
              <div className="text-xs font-mono uppercase text-muted-foreground">USD Value</div>
              <div className="font-mono text-lg font-semibold mt-2">{formattedUsdValue}</div>
            </div>

            <div className="p-3 border rounded">
              <div className="text-xs font-mono uppercase text-muted-foreground">Collateral (decrypt to view)</div>
              <div className="font-mono text-lg font-semibold mt-2">
                ${(Number(collateralUsd) / 1e6).toFixed(2)}
              </div>
            </div>

            <div className="p-3 border rounded">
              <div className="text-xs font-mono uppercase text-muted-foreground">Status</div>
              <div className="mt-2 text-sm">
                {withdrawStep === "idle" && parsedAmount > 0n && !exceedsCollateral && "Ready to withdraw"}
                {withdrawStep === "idle" && parsedAmount === 0n && "Enter amount to continue"}
                {withdrawStep === "idle" && exceedsCollateral && "Amount exceeds encrypted collateral"}
                {withdrawStep === "withdraw_pending" && "Submitting withdrawal request..."}
                {withdrawStep === "withdraw_confirmed" && "Withdrawal request submitted"}
                {withdrawStep === "error" && "Transaction failed"}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
