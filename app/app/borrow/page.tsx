"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProtocolAlerts } from "@/components/walnut/protocol-health";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";
import { useTokenBalances } from "@/hooks/use-token-balances";
import { BORROW_APR_PERCENT, LTV_LIMIT_PERCENT } from "@/lib/protocol-constants";

function toNumber(value: unknown) {
  if (typeof value === "bigint") return Number(value);
  return 0;
}

const parseUSDCInput = (value: string): bigint => {
  if (!value || !/^\d+(\.\d+)?$/.test(value)) return 0n;
  const [whole = "0", fraction = ""] = value.split(".");
  return BigInt(`${whole}${fraction.padEnd(6, "0").slice(0, 6)}`);
};

const formatUSDC = (rawValue: bigint | number | string): string => {
  const num = typeof rawValue === "bigint" ? Number(rawValue) : Number(rawValue);
  return (num / 1_000_000).toFixed(2);
};

const HIDDEN_VALUE = "••••••";
const HIDDEN_PREVIEW = "••••";

export default function BorrowPage() {
  const [amount, setAmount] = useState("");
  const [showDecrypted, setShowDecrypted] = useState(false);
  const [borrowInFlight, setBorrowInFlight] = useState(false);
  const protocol = useWalnutProtocol();
  const { wUSDCBalance, refreshBalances } = useTokenBalances();

  const pendingBorrow = borrowInFlight || protocol.isEncrypting;
  const pendingDecrypt = showDecrypted && protocol.debtDecrypting;

  const collateral = useMemo(() => toNumber(protocol.collateral.decrypted.data), [protocol.collateral.decrypted.data]);
  const currentDebt = useMemo(() => toNumber(protocol.debt.decrypted.data), [protocol.debt.decrypted.data]);
  const currentDebtBigint = useMemo(() => {
    if (typeof protocol.debt.decrypted.data === "bigint") return protocol.debt.decrypted.data;
    return 0n;
  }, [protocol.debt.decrypted.data]);

  const typedAmount = useMemo(() => {
    return parseUSDCInput(amount);
  }, [amount]);

  const projectedDebt = useMemo(() => currentDebtBigint + typedAmount, [currentDebtBigint, typedAmount]);
  const amountNumber = Number(typedAmount);
  const newDebt = currentDebt + amountNumber;
  
  // Wave 4: Credit tier and LTV calculation (Task 19.1)
  const creditTier = typeof protocol.creditTier === "bigint" ? Number(protocol.creditTier) : 0;
  const tierLtvBps = typeof protocol.tierLTV === "bigint" ? Number(protocol.tierLTV) : 7000; // Default to 70%
  const tierLtvPercent = tierLtvBps / 100; // Convert basis points to percentage
  
  // Wave 4: Maximum borrow amount based on collateral and LTV (Task 19.1)
  const maxBorrowAmount = useMemo(() => {
    if (collateral <= 0) return 0;
    return Math.floor((collateral * tierLtvBps) / 10000);
  }, [collateral, tierLtvBps]);
  
  const ltvRatio = collateral > 0 ? Math.min(999, (newDebt / collateral) * 100) : 0;
  const canRenderRiskPreview = showDecrypted && protocol.canRead && !protocol.debtDecrypting && collateral > 0;
  const previewLtv = canRenderRiskPreview ? `${ltvRatio.toFixed(2)}%` : HIDDEN_PREVIEW;
  
  // Industry standard health factor: (collateral × 10000) / debt
  // This matches the dashboard calculation and WalnutV2 contract logic
  const previewHealthFactor = useMemo(() => {
    if (!canRenderRiskPreview || newDebt <= 0) return HIDDEN_PREVIEW;
    const healthFactorRaw = (collateral * 10000) / newDebt;
    const healthFactorClamped = Math.min(healthFactorRaw, 100000); // Cap at 10.0
    return (healthFactorClamped / 10000).toFixed(2);
  }, [canRenderRiskPreview, collateral, newDebt]);
  
  const exceedsLTV = canRenderRiskPreview ? ltvRatio > tierLtvPercent : false;
  
  // Wave 4: Validate borrow amount against maximum (Task 19.1)
  const exceedsMaxBorrow = amountNumber > maxBorrowAmount;

  const debtLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return HIDDEN_VALUE;
    if (protocol.debtDecrypting && typeof protocol.debt.decrypted.data === "undefined") {
      // Only show "Loading..." if we don't have any previous value
      return "Loading...";
    }
    if (typeof protocol.debt.decrypted.data === "bigint") {
      return formatUSDC(protocol.debt.decrypted.data);
    }
    return "0.00";
  }, [protocol.canRead, protocol.debt.decrypted.data, protocol.debtDecrypting, showDecrypted]);

  async function handleBorrow() {
    if (pendingBorrow || !amount) return;

    setBorrowInFlight(true);
    try {
      const success = await protocol.submitEncryptedAmount("borrow", amount);
      if (success) {
        setAmount("");
        // Wave 4: Refresh wUSDC balance after borrow (Task 19.1)
        await refreshBalances();
      }
    } finally {
      setBorrowInFlight(false);
    }
  }

  const projectedDebtLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return HIDDEN_VALUE;
    if (protocol.debtDecrypting && typeof protocol.debt.decrypted.data === "undefined") {
      // Only show "Loading..." if we don't have any previous value
      return "Loading...";
    }
    return formatUSDC(projectedDebt);
  }, [projectedDebt, protocol.canRead, protocol.debtDecrypting, showDecrypted, protocol.debt.decrypted.data]);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Borrow wUSDC</h1>
        <p className="text-sm text-muted-foreground">Request a private loan with encrypted settlement.</p>
      </header>

      <ProtocolAlerts protocol={protocol} />

      <div className="border rounded-lg p-4">
        <div className="grid gap-4 items-start md:grid-cols-[1.7fr_1.1fr]">
          <section className="md:col-span-1 space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-mono uppercase text-muted-foreground">Borrow Studio</p>
              </div>
            </div>

            <div>
              <label htmlFor="borrow-amount" className="block text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Borrow Amount (wUSDC)
              </label>
              <Input
                id="borrow-amount"
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className="mt-2 w-full max-w-[60%] rounded-xl border border-slate-300 bg-slate-50 px-4 py-4 text-xl font-semibold text-foreground placeholder:text-slate-500 placeholder:text-sm placeholder:opacity-100 focus:border-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
              <div className="text-xs text-muted-foreground mt-1">
                Max: {canRenderRiskPreview ? formatUSDC(maxBorrowAmount) : HIDDEN_VALUE} wUSDC
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { label: "100", value: "100" },
                { label: "250", value: "250" },
                { label: "500", value: "500" },
                { label: "1000", value: "1000" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAmount(option.value)}
                  className="px-3 py-1 border rounded text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {option.label}
                </button>
              ))}
            </div>

            {(exceedsLTV || exceedsMaxBorrow) && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700">
                  {exceedsMaxBorrow
                    ? `This amount exceeds your maximum borrow limit of ${formatUSDC(maxBorrowAmount)} wUSDC. Please enter a lower amount.`
                    : `This amount is above the ${tierLtvPercent.toFixed(2)}% LTV limit. Please enter a lower amount.`}
                </p>
              </div>
            )}

            <div className="max-w-[60%] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {`Your credit tier ${creditTier} allows up to ${tierLtvPercent.toFixed(2)}% LTV at ${BORROW_APR_PERCENT}% APR.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {!protocol.permit.hasPermit && (
                <Button
                  variant="outline"
                  className="px-4 py-2"
                  onClick={protocol.permit.requestPermitCreation}
                  isLoading={protocol.permit.isPermitInitializing}
                  loadingText="Enabling..."
                >
                  Enable Private Access
                </Button>
              )}
              <Button
                className="bg-black text-white rounded px-4 py-2 hover:bg-slate-900"
                onClick={handleBorrow}
                isLoading={pendingBorrow}
                loadingText={protocol.isEncrypting ? "Encrypting..." : "Borrowing..."}
                disabled={!amount || pendingBorrow || exceedsLTV || exceedsMaxBorrow}
              >
                Borrow wUSDC
              </Button>
              <Button
                variant="outline"
                className="px-4 py-2"
                onClick={() => setShowDecrypted((value) => !value)}
                isLoading={pendingDecrypt}
                loadingText="Decrypting..."
              >
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span className="inline-flex h-4 w-4 items-center justify-center">
                    {showDecrypted ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </span>
                  <span>{showDecrypted ? "Hide Debt" : "Show Debt"}</span>
                </span>
              </Button>
            </div>
          </section>

          <aside className="grid gap-4 self-start">
            <div className="rounded-2xl">
              <div className="w-full">
                <div className="inline-flex w-full items-center justify-between gap-3 min-w-0 bg-slate-50 border border-slate-200 rounded-full px-3 py-2 shadow-sm text-xs text-slate-700">
                  <div className="inline-flex items-center gap-2 font-semibold uppercase tracking-[0.18em]">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Status</span>
                  </div>
                  <div className="min-w-0 truncate text-slate-600">
                    {pendingBorrow ? "Borrowing..." : !amount ? "Enter amount to continue" : exceedsMaxBorrow ? `Amount exceeds max borrow of ${formatUSDC(maxBorrowAmount)} wUSDC` : exceedsLTV ? `Above ${tierLtvPercent.toFixed(2)}% LTV` : "Ready to borrow"} — {`${tierLtvPercent.toFixed(2)}% LTV Cap`}
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-64 rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-mono uppercase text-muted-foreground">Credit Tier</div>
                <div className="text-xs font-mono uppercase text-muted-foreground">Encrypted</div>
              </div>
              <div className="mt-4 flex items-baseline gap-2.5">
                <p className="font-display text-3xl text-foreground">Tier {creditTier}</p>
                <p className="text-sm text-muted-foreground">of 4</p>
              </div>
              <div className="mt-4 grid gap-3">
                <div className="flex justify-between items-center text-sm min-w-0">
                  <span className="text-muted-foreground">Max LTV:</span>
                  <span className="font-mono text-foreground min-w-0 text-right truncate">{tierLtvPercent.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between items-center text-sm min-w-0">
                  <span className="text-muted-foreground">Borrow APR:</span>
                  <span className="font-mono text-foreground min-w-0 text-right truncate">{BORROW_APR_PERCENT}%</span>
                </div>
                <div className="flex justify-between items-center text-sm min-w-0">
                  <span className="text-muted-foreground">Max Borrow:</span>
                  <span className="font-mono text-foreground min-w-0 text-right truncate">
                    {canRenderRiskPreview ? `${formatUSDC(maxBorrowAmount)} wUSDC` : HIDDEN_VALUE}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mt-4">
          <div className="p-3 border rounded-2xl">
            <div className="text-xs font-mono uppercase text-muted-foreground">Current Debt (wUSDC)</div>
            <div className="font-mono text-lg font-semibold mt-2">{debtLabel}</div>
            <div className="text-sm text-muted-foreground mt-1">Your current borrowed balance</div>
          </div>
          <div className="p-3 border rounded-2xl">
            <div className="text-xs font-mono uppercase text-muted-foreground">Projected Debt (wUSDC)</div>
            <div className="font-mono text-lg font-semibold mt-2">{projectedDebtLabel}</div>
            <div className="text-sm text-muted-foreground mt-1">Estimated debt after this transaction confirms</div>
          </div>
          <div className="p-3 border rounded-2xl">
            <div className="text-xs font-mono uppercase text-muted-foreground">Risk Preview</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">New LTV</div>
                <div className="mt-2 font-mono text-lg text-foreground">{previewLtv}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Health Factor</div>
                <div className="mt-2 font-mono text-lg text-foreground">{previewHealthFactor}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
