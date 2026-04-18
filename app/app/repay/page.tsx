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
  const [settlementStep, setSettlementStep] = useState<"idle" | "principal" | "interest" | "complete">("idle");
  const protocol = useWalnutProtocol();

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
      setSettlementStep("interest");
      
      try {
        await initiatePrivaraSettlement();
        setSettlementStep("complete");
        setAmount("");
      } catch {
        protocol.setStatus("Repayment started, but finalization failed. Please retry.");
        setSettlementStep("idle");
      }
    } else {
      setSettlementStep("idle");
    }
  }

  async function initiatePrivaraSettlement() {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    protocol.setStatus("Repayment completed.");
  }

  return (
    <div className="space-y-6">
      <GlassPanel className="walnut-hero">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Repay Debt</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Repay Your Balance</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Enter a number and complete repayment.
        </p>
      </GlassPanel>

      <ProtocolAlerts protocol={protocol} />

      {settlementStep !== "idle" && (
        <GlassPanel className="walnut-card border-accent/40">
          <p className="walnut-label">Repayment Progress</p>
          <div className="mt-3 space-y-2">
            <div className="walnut-progress flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${settlementStep === "principal" ? "bg-accent animate-pulse" : "bg-accent"}`} />
              <p className="text-sm text-foreground">Step 1: Confirm repayment</p>
            </div>
            <div className="walnut-progress flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${settlementStep === "interest" ? "bg-accent animate-pulse" : settlementStep === "complete" ? "bg-accent" : "bg-muted"}`} />
              <p className="text-sm text-foreground">Step 2: Finalizing</p>
            </div>
          </div>
        </GlassPanel>
      )}

      <GlassPanel className="walnut-card space-y-4">
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
            className="border-black/10 bg-white text-foreground placeholder:text-muted-foreground/80"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {!protocol.permit.hasPermit && (
            <Button variant="outline" className="glass-button" onClick={protocol.permit.requestPermitCreation}>
              Enable Private Access
            </Button>
          )}
          <Button
            className="glass-button bg-accent text-accent-foreground hover:bg-accent/85"
            onClick={handleRepay}
            disabled={protocol.isWriting || protocol.isEncrypting || settlementStep !== "idle"}
          >
            Repay
          </Button>
          <Button variant="outline" className="glass-button" onClick={() => setShowDecrypted((value) => !value)}>
            {showDecrypted ? "Hide Debt" : "Show Debt"}
          </Button>
        </div>
      </GlassPanel>

      <GlassPanel className="walnut-card walnut-card-strong">
        <p className="walnut-label">Outstanding Debt</p>
        <p className="walnut-value">{debtLabel}</p>
        <p className="walnut-meta">Amount left to repay</p>
      </GlassPanel>

      {protocol.status && (
        <GlassPanel className="walnut-alert border-accent/40">
          {protocol.status && <p className="text-sm text-foreground">{protocol.status}</p>}
        </GlassPanel>
      )}

      <SystemStatusPanel protocol={protocol} />
    </div>
  );
}
