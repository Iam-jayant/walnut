"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassPanel } from "@/components/walnut/glass-panel";
import { ProtocolAlerts, SystemStatusPanel } from "@/components/walnut/protocol-health";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";

export default function WithdrawPage() {
  const [amount, setAmount] = useState("");
  const [showDecrypted, setShowDecrypted] = useState(false);
  const [withdrawInFlight, setWithdrawInFlight] = useState(false);
  const protocol = useWalnutProtocol({ mode: "advanced" });

  const pendingWithdraw = withdrawInFlight || protocol.isEncrypting;
  const pendingDecrypt = showDecrypted && (protocol.collateralDecrypting || protocol.debtDecrypting);

  const currentCollateral = useMemo(() => {
    if (typeof protocol.collateral.decrypted.data === "bigint") return protocol.collateral.decrypted.data;
    return 0n;
  }, [protocol.collateral.decrypted.data]);

  const currentDebt = useMemo(() => {
    if (typeof protocol.debt.decrypted.data === "bigint") return protocol.debt.decrypted.data;
    return 0n;
  }, [protocol.debt.decrypted.data]);

  const availableRaw = useMemo(() => {
    if (currentCollateral > currentDebt) return currentCollateral - currentDebt;
    return 0n;
  }, [currentCollateral, currentDebt]);

  const typedAmount = useMemo(() => {
    if (!amount || !/^\d+$/.test(amount)) return 0n;
    return BigInt(amount);
  }, [amount]);

  const projectedAvailable = useMemo(() => {
    if (typedAmount >= availableRaw) return 0n;
    return availableRaw - typedAmount;
  }, [availableRaw, typedAmount]);

  const availableCollateral = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return "******";
    if (protocol.collateralDecrypting || protocol.debtDecrypting) return "Loading...";

    const collateralValue = protocol.collateral.decrypted.data;
    const debtValue = protocol.debt.decrypted.data;

    if (typeof collateralValue === "bigint" && typeof debtValue === "bigint") {
      const available = collateralValue > debtValue ? collateralValue - debtValue : 0n;
      return available.toString();
    }
    return "0";
  }, [
    protocol.canRead,
    protocol.collateral.decrypted.data,
    protocol.debt.decrypted.data,
    protocol.collateralDecrypting,
    protocol.debtDecrypting,
    showDecrypted,
  ]);

  const projectedAvailableLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return "******";
    if (protocol.collateralDecrypting || protocol.debtDecrypting) return "Loading...";
    return projectedAvailable.toString();
  }, [projectedAvailable, protocol.canRead, protocol.collateralDecrypting, protocol.debtDecrypting, showDecrypted]);

  const exceedsAvailable = typedAmount > availableRaw && showDecrypted;

  async function handleWithdraw() {
    if (pendingWithdraw || !amount) return;

    setWithdrawInFlight(true);
    try {
      const success = await protocol.submitWithdraw(amount);
      if (success) {
        setAmount("");
      }
    } finally {
      setWithdrawInFlight(false);
    }
  }

  return (
    <div className="space-y-6">
      <GlassPanel className="walnut-hero">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Withdraw Collateral</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Withdraw Available Funds</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Withdraw only the collateral available after debt coverage.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="walnut-status-chip walnut-status-chip-ghost">Safe Withdrawal</span>
          <span className="walnut-status-chip walnut-status-chip-ghost">Debt Aware</span>
        </div>
      </GlassPanel>

      <ProtocolAlerts protocol={protocol} />

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <GlassPanel className="walnut-card walnut-card-strong space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="walnut-label">Withdraw Studio</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter an amount and submit an encrypted withdrawal from available collateral.
              </p>
            </div>
            <span className="walnut-status-chip walnut-status-chip-ghost">Encrypted</span>
          </div>

          <div>
            <label htmlFor="withdraw-amount" className="mb-2 block text-sm text-foreground">
              Amount
            </label>
            <Input
              id="withdraw-amount"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="Enter amount"
              className="h-12 border-black/10 bg-white text-lg text-foreground placeholder:text-muted-foreground/80"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { label: "50", value: "50" },
              { label: "100", value: "100" },
              { label: "250", value: "250" },
              { label: "500", value: "500" },
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

          {exceedsAvailable && (
            <div className="walnut-alert walnut-alert-danger">
              <p className="text-sm text-red-700">
                Amount exceeds currently available collateral. Enter a lower value.
              </p>
            </div>
          )}

          <div className="walnut-progress">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Withdrawal Rule</p>
            <p className="mt-2 text-sm text-foreground">Available collateral = collateral - debt.</p>
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
              onClick={handleWithdraw}
              isLoading={pendingWithdraw}
              loadingText={protocol.isEncrypting ? "Encrypting..." : "Withdrawing..."}
              disabled={!amount || pendingWithdraw || exceedsAvailable}
            >
              Withdraw
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
                <span>{showDecrypted ? "Hide Balance" : "Show Balance"}</span>
              </span>
            </Button>
          </div>
        </GlassPanel>

        <div className="grid gap-4">
          <GlassPanel className="walnut-card walnut-card-strong walnut-kpi-card">
            <p className="walnut-label">Available Collateral</p>
            <p className="walnut-value">{availableCollateral}</p>
            <p className="walnut-meta">Amount you can safely withdraw now</p>
          </GlassPanel>

          <GlassPanel className="walnut-card walnut-card-strong walnut-kpi-card">
            <p className="walnut-label">After This Withdrawal</p>
            <p className="walnut-value">{projectedAvailableLabel}</p>
            <p className="walnut-meta">Projected available collateral after confirmation</p>
          </GlassPanel>

          <GlassPanel className="walnut-card">
            <p className="walnut-label">Status</p>
            <p className="mt-2 text-sm text-foreground">
              {pendingWithdraw
                ? "Withdrawal transaction in progress..."
                : protocol.status || "Ready to submit encrypted withdrawal."}
            </p>
          </GlassPanel>
        </div>
      </div>

      {protocol.status && (
        <GlassPanel className="walnut-alert border-accent/40">
          {protocol.status && <p className="text-sm text-foreground">{protocol.status}</p>}
        </GlassPanel>
      )}

      <SystemStatusPanel protocol={protocol} />
    </div>
  );
}
