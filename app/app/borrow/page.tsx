"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassPanel } from "@/components/walnut/glass-panel";
import { ProtocolAlerts, SystemStatusPanel } from "@/components/walnut/protocol-health";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";
import { useTokenBalances } from "@/hooks/use-token-balances";
import { BORROW_APR_PERCENT, LTV_LIMIT_PERCENT } from "@/lib/protocol-constants";

function toNumber(value: unknown) {
  if (typeof value === "bigint") return Number(value);
  return 0;
}

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
    if (!amount || !/^\d+$/.test(amount)) return 0n;
    return BigInt(amount);
  }, [amount]);

  const projectedDebt = useMemo(() => currentDebtBigint + typedAmount, [currentDebtBigint, typedAmount]);
  const amountNumber = Number(amount || "0");
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
  const previewLtv = canRenderRiskPreview ? `${ltvRatio.toFixed(2)}%` : "--";
  const previewHealthFactor = canRenderRiskPreview && newDebt > 0 ? (collateral / newDebt).toFixed(2) : "--";
  const exceedsLTV = canRenderRiskPreview ? ltvRatio > tierLtvPercent : false;
  
  // Wave 4: Validate borrow amount against maximum (Task 19.1)
  const exceedsMaxBorrow = amountNumber > maxBorrowAmount;

  const debtLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return "******";
    if (protocol.debtDecrypting) return "Loading...";
    if (typeof protocol.debt.decrypted.data === "bigint") {
      return protocol.debt.decrypted.data.toString();
    }
    return "0";
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
    if (!protocol.canRead || !showDecrypted) return "******";
    if (protocol.debtDecrypting) return "Loading...";
    return projectedDebt.toString();
  }, [projectedDebt, protocol.canRead, protocol.debtDecrypting, showDecrypted]);

  return (
    <div className="space-y-6">
      <GlassPanel className="walnut-hero">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Borrow</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Private Loan Request</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Select your amount, review risk metrics, and submit an encrypted borrow request.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="walnut-status-chip walnut-status-chip-ghost">Risk Preview</span>
          <span className="walnut-status-chip walnut-status-chip-ghost">{`${tierLtvPercent.toFixed(2)}% LTV Cap`}</span>
          <span className="walnut-status-chip walnut-status-chip-ghost">{`${BORROW_APR_PERCENT}% APR`}</span>
        </div>
      </GlassPanel>

      <ProtocolAlerts protocol={protocol} />

      <div className="grid items-start gap-4 xl:grid-cols-[1.45fr_1fr]">
        <div className="grid self-start gap-4">
          <GlassPanel className="walnut-card walnut-card-strong space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="walnut-label">Borrow Studio</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Tune your request and preview how it affects your safety before you confirm.
                </p>
              </div>
              <span className="walnut-status-chip walnut-status-chip-ghost">Encrypted</span>
            </div>

            <div>
              <label htmlFor="borrow-amount" className="mb-2 block text-sm text-foreground">
                Borrow Amount (wUSDC)
              </label>
              <Input
                id="borrow-amount"
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Enter amount"
                className="h-12 border-black/10 bg-white text-lg text-foreground placeholder:text-muted-foreground/80"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Max: {canRenderRiskPreview ? maxBorrowAmount.toLocaleString() : "******"} wUSDC
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { label: "100", value: "100" },
                { label: "250", value: "250" },
                { label: "500", value: "500" },
                { label: "1000", value: "1000" },
              ].map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant="outline"
                  className="glass-chip"
                  onClick={() => setAmount(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            {(exceedsLTV || exceedsMaxBorrow) && (
              <div className="walnut-alert walnut-alert-danger">
                <p className="text-sm text-red-700">
                  {exceedsMaxBorrow 
                    ? `This amount exceeds your maximum borrow limit of ${maxBorrowAmount.toLocaleString()} wUSDC. Please enter a lower amount.`
                    : `This amount is above the ${tierLtvPercent.toFixed(2)}% LTV limit. Please enter a lower amount.`}
                </p>
              </div>
            )}

            <div className="walnut-alert walnut-alert-info">
              <p className="text-xs text-muted-foreground">
                {`Your credit tier ${creditTier} allows up to ${tierLtvPercent.toFixed(2)}% LTV at ${BORROW_APR_PERCENT}% APR.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {!protocol.permit.hasPermit && (
                <Button
                  variant="outline"
                  className="glass-button"
                  onClick={protocol.permit.requestPermitCreation}
                  isLoading={protocol.permit.isPermitInitializing}
                  loadingText="Enabling..."
                >
                  Enable Private Access
                </Button>
              )}
              <Button
                className="glass-button bg-accent text-accent-foreground hover:bg-accent/85"
                onClick={handleBorrow}
                isLoading={pendingBorrow}
                loadingText={protocol.isEncrypting ? "Encrypting..." : "Borrowing..."}
                disabled={!amount || pendingBorrow || exceedsLTV || exceedsMaxBorrow}
              >
                Borrow wUSDC
              </Button>
              <Button
                variant="outline"
                className="glass-button min-w-39 justify-center"
                onClick={() => setShowDecrypted((value) => !value)}
                isLoading={pendingDecrypt}
                loadingText="Decrypting..."
              >
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span className="inline-flex h-4 w-4 items-center justify-center">
                    {showDecrypted ? (
                      <EyeOff className="h-4 w-4 transition-all duration-200 ease-out rotate-0 scale-100" />
                    ) : (
                      <Eye className="h-4 w-4 transition-all duration-200 ease-out scale-100" />
                    )}
                  </span>
                  <span>{showDecrypted ? "Hide Debt" : "Show Debt"}</span>
                </span>
              </Button>
            </div>
          </GlassPanel>


          <SystemStatusPanel protocol={protocol} />
        </div>

        <div className="grid gap-4">
          {/* Wave 4: Credit Tier Display (Task 19.1) */}
          <GlassPanel className="walnut-card walnut-card-strong">
            <p className="walnut-label">Credit Tier</p>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="font-display text-3xl text-foreground">Tier {creditTier}</p>
              <p className="text-sm text-muted-foreground">of 4</p>
            </div>
            <div className="mt-3 grid gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Max LTV:</span>
                <span className="font-mono text-foreground">{tierLtvPercent.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Borrow APR:</span>
                <span className="font-mono text-foreground">{BORROW_APR_PERCENT}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Max Borrow:</span>
                <span className="font-mono text-foreground">
                  {canRenderRiskPreview ? `${maxBorrowAmount.toLocaleString()} wUSDC` : "******"}
                </span>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="walnut-card walnut-card-strong walnut-kpi-card">
            <p className="walnut-label">Current Debt (wUSDC)</p>
            <p className="walnut-value">{debtLabel}</p>
            <p className="walnut-meta">Your current borrowed balance</p>
          </GlassPanel>

          <GlassPanel className="walnut-card walnut-card-strong walnut-kpi-card">
            <p className="walnut-label">Projected Debt (wUSDC)</p>
            <p className="walnut-value">{projectedDebtLabel}</p>
            <p className="walnut-meta">Estimated debt after this transaction confirms</p>
          </GlassPanel>

          <GlassPanel className="walnut-card">
            <p className="walnut-label">Risk Preview</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="walnut-progress">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">New LTV</p>
                <p className="mt-2 font-mono text-lg text-foreground">{previewLtv}</p>
              </div>
              <div className="walnut-progress">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Health Factor</p>
                <p className="mt-2 font-mono text-lg text-foreground">{previewHealthFactor}</p>
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>

    </div>
  );
}
