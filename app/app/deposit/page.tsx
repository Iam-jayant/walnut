"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassPanel } from "@/components/walnut/glass-panel";
import { ProtocolAlerts, SystemStatusPanel } from "@/components/walnut/protocol-health";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";

export default function DepositPage() {
  const [amount, setAmount] = useState("");
  const [showDecrypted, setShowDecrypted] = useState(false);
  const protocol = useWalnutProtocol();

  const collateralLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return "******";
    if (protocol.collateralDecrypting) return "Loading...";
    if (typeof protocol.collateral.decrypted.data === "bigint") {
      return protocol.collateral.decrypted.data.toString();
    }
    return "0";
  }, [protocol.canRead, protocol.collateral.decrypted.data, protocol.collateralDecrypting, showDecrypted]);

  async function handleDeposit() {
    const success = await protocol.submitEncryptedAmount("deposit", amount);
    if (success) setAmount("");
  }

  return (
    <div className="space-y-6">
      <GlassPanel className="walnut-hero">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Deposit Collateral</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Add Collateral</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Enter a number and confirm to add collateral.
        </p>
      </GlassPanel>

      <ProtocolAlerts protocol={protocol} />

      <GlassPanel className="walnut-card space-y-4">
        <div>
          <label htmlFor="deposit-amount" className="mb-2 block text-sm text-foreground">
            Amount
          </label>
          <Input
            id="deposit-amount"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ""))}
            placeholder="1000"
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
            onClick={handleDeposit}
            disabled={protocol.isWriting || protocol.isEncrypting}
          >
            Deposit
          </Button>
          <Button variant="outline" className="glass-button" onClick={() => setShowDecrypted((value) => !value)}>
            {showDecrypted ? "Hide Balance" : "Show Balance"}
          </Button>
        </div>
      </GlassPanel>

      <GlassPanel className="walnut-card walnut-card-strong">
        <p className="walnut-label">Current Collateral</p>
        <p className="walnut-value">{collateralLabel}</p>
        <p className="walnut-meta">Your current collateral balance</p>
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
