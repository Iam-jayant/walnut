"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassPanel } from "@/components/walnut/glass-panel";
import { ProtocolAlerts, SystemStatusPanel } from "@/components/walnut/protocol-health";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";

function toNumber(value: unknown) {
  if (typeof value === "bigint") return Number(value);
  return 0;
}

export default function BorrowPage() {
  const [amount, setAmount] = useState("");
  const [showDecrypted, setShowDecrypted] = useState(false);
  const protocol = useWalnutProtocol();

  const collateral = useMemo(() => toNumber(protocol.collateral.decrypted.data), [protocol.collateral.decrypted.data]);
  const currentDebt = useMemo(() => toNumber(protocol.debt.decrypted.data), [protocol.debt.decrypted.data]);
  const amountNumber = Number(amount || "0");
  const newDebt = currentDebt + amountNumber;
  const ltvRatio = collateral > 0 ? Math.min(999, (newDebt / collateral) * 100) : 0;
  const previewHealthFactor = collateral > 0 && newDebt > 0 ? (collateral / newDebt).toFixed(2) : "N/A";
  const exceedsLTV = ltvRatio > 80;

  const debtLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return "******";
    if (protocol.debtDecrypting) return "Loading...";
    if (typeof protocol.debt.decrypted.data === "bigint") {
      return protocol.debt.decrypted.data.toString();
    }
    return "0";
  }, [protocol.canRead, protocol.debt.decrypted.data, protocol.debtDecrypting, showDecrypted]);

  async function handleBorrow() {
    const success = await protocol.submitEncryptedAmount("borrow", amount);
    if (success) setAmount("");
  }

  return (
    <div className="space-y-6">
      <GlassPanel className="walnut-hero">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Borrow</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Private Loan Request</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Choose how much you want to borrow and preview your position before confirming.
        </p>
      </GlassPanel>

      <ProtocolAlerts protocol={protocol} />

      <GlassPanel className="walnut-card space-y-4">
        <div>
          <label htmlFor="borrow-amount" className="mb-2 block text-sm text-foreground">
            Borrow Amount
          </label>
          <Input
            id="borrow-amount"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ""))}
            placeholder="250"
            className="border-black/10 bg-white text-foreground placeholder:text-muted-foreground/80"
          />
        </div>

        {exceedsLTV && (
          <div className="walnut-alert walnut-alert-danger">
            <p className="text-sm text-red-700">
              This amount is above the 80% safety limit. Please enter a lower amount.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="walnut-card walnut-card-strong">
            <p className="walnut-label">New LTV</p>
            <p className="walnut-value">{ltvRatio.toFixed(2)}%</p>
            <p className="walnut-meta">Max: 80%</p>
          </div>
          <div className="walnut-card walnut-card-strong">
            <p className="walnut-label">Health Factor Preview</p>
            <p className="walnut-value">{previewHealthFactor}</p>
            <p className="walnut-meta">Liquidation at 1.05</p>
          </div>
        </div>

        <div className="walnut-alert walnut-alert-warning">
          <p className="text-xs text-muted-foreground">
            Keep your borrow amount under 80% of collateral for a safer position.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!protocol.permit.hasPermit && (
            <Button variant="outline" className="glass-button" onClick={protocol.permit.requestPermitCreation}>
              Enable Private Access
            </Button>
          )}
          <Button
            className="glass-button bg-accent text-accent-foreground hover:bg-accent/85"
            onClick={handleBorrow}
            disabled={protocol.isWriting || protocol.isEncrypting}
          >
            Borrow
          </Button>
          <Button variant="outline" className="glass-button" onClick={() => setShowDecrypted((value) => !value)}>
            {showDecrypted ? "Hide Debt" : "Show Debt"}
          </Button>
        </div>
      </GlassPanel>

      <GlassPanel className="walnut-card walnut-card-strong">
        <p className="walnut-label">Current Debt</p>
        <p className="walnut-value">{debtLabel}</p>
        <p className="walnut-meta">Your current borrowed balance</p>
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
