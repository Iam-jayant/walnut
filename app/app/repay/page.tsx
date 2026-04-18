"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassPanel } from "@/components/walnut/glass-panel";
import { ProtocolAlerts, SystemStatusPanel } from "@/components/walnut/protocol-health";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";

export default function RepayPage() {
  const [amount, setAmount] = useState("");
  const [showDecrypted, setShowDecrypted] = useState(false);
  const [settlementStep, setSettlementStep] = useState<"idle" | "principal" | "complete">("idle");
  const protocol = useWalnutProtocol();

  const pendingRepay = protocol.isWriting || protocol.isEncrypting || settlementStep === "principal";
  const pendingDecrypt = showDecrypted && protocol.debtDecrypting;

  const currentDebt = useMemo(() => {
    if (typeof protocol.debt.decrypted.data === "bigint") return protocol.debt.decrypted.data;
    return 0n;
  }, [protocol.debt.decrypted.data]);

  const typedAmount = useMemo(() => {
    if (!amount || !/^\d+$/.test(amount)) return 0n;
    return BigInt(amount);
  }, [amount]);

  const postRepayDebt = useMemo(() => {
    if (typedAmount >= currentDebt) return 0n;
    return currentDebt - typedAmount;
  }, [currentDebt, typedAmount]);

  const debtLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return "******";
    if (protocol.debtDecrypting) return "Loading...";
    if (typeof protocol.debt.decrypted.data === "bigint") {
      return protocol.debt.decrypted.data.toString();
    }
    return "0";
  }, [protocol.canRead, protocol.debt.decrypted.data, protocol.debtDecrypting, showDecrypted]);

  async function handleRepay() {
    setSettlementStep("principal");
    const success = await protocol.submitRepay(amount);

    if (success) {
      // Privara private settlement - Wave 3 implementation
      setSettlementStep("complete");
      setAmount("");
    } else {
      setSettlementStep("idle");
    }
  }

  const projectedDebtLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return "******";
    if (protocol.debtDecrypting) return "Loading...";
    return postRepayDebt.toString();
  }, [postRepayDebt, protocol.canRead, protocol.debtDecrypting, showDecrypted]);

  return (
    <div className="space-y-6">
      <GlassPanel className="walnut-hero">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Repay Debt</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Repay Your Balance</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Submit encrypted principal repayment and monitor status in one place.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="walnut-status-chip walnut-status-chip-ghost">Principal Live</span>
          <span className="walnut-status-chip walnut-status-chip-ghost">Settlement Wave 3</span>
        </div>
      </GlassPanel>

      <ProtocolAlerts protocol={protocol} />

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <GlassPanel className="walnut-card walnut-card-strong space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="walnut-label">Repay Studio</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Complete principal repayment now. Private interest settlement is scheduled for Wave 3.
              </p>
            </div>
            <span className="walnut-status-chip walnut-status-chip-ghost">Encrypted</span>
          </div>

          <div>
            <label htmlFor="repay-amount" className="mb-2 block text-sm text-foreground">
              Repay Amount
            </label>
            <Input
              id="repay-amount"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="100"
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

          <div className="walnut-card border-accent/40">
            <p className="walnut-label">Repayment Progress</p>
            <div className="mt-3 space-y-2">
              <div className="walnut-progress flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${settlementStep === "principal" ? "bg-accent animate-pulse" : settlementStep === "complete" ? "bg-accent" : "bg-muted"}`} />
                <p className="text-sm text-foreground">
                  Step 1: Repay principal {settlementStep === "complete" ? "[complete]" : ""}
                </p>
              </div>
              <div className="walnut-progress flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-muted" />
                <p className="text-sm text-muted-foreground">Step 2: Private interest settlement (Coming in Wave 3)</p>
              </div>
            </div>
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
              onClick={handleRepay}
              isLoading={pendingRepay}
              loadingText={protocol.isEncrypting ? "Encrypting..." : "Repaying..."}
              disabled={!amount || pendingRepay}
            >
              Repay
            </Button>
            <Button
              variant="outline"
              className="glass-button"
              onClick={() => setShowDecrypted((value) => !value)}
              isLoading={pendingDecrypt}
              loadingText="Decrypting..."
            >
              {showDecrypted ? "Hide Debt" : "Show Debt"}
            </Button>
          </div>
        </GlassPanel>

        <div className="grid gap-4">
          <GlassPanel className="walnut-card walnut-card-strong walnut-kpi-card">
            <p className="walnut-label">Outstanding Debt</p>
            <p className="walnut-value">{debtLabel}</p>
            <p className="walnut-meta">Current principal balance</p>
          </GlassPanel>

          <GlassPanel className="walnut-card walnut-card-strong walnut-kpi-card">
            <p className="walnut-label">Projected Debt</p>
            <p className="walnut-value">{projectedDebtLabel}</p>
            <p className="walnut-meta">Estimated debt after this repayment confirms</p>
          </GlassPanel>

          <GlassPanel className="walnut-card">
            <p className="walnut-label">Status</p>
            <p className="mt-2 text-sm text-foreground">
              {pendingRepay
                ? "Repayment transaction in progress..."
                : protocol.status || "Ready to submit principal repayment."}
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
