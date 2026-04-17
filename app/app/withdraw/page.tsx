"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassPanel } from "@/components/walnut/glass-panel";
import { ProtocolAlerts, SystemStatusPanel } from "@/components/walnut/protocol-health";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";

export default function WithdrawPage() {
  const [amount, setAmount] = useState("");
  const [showDecrypted, setShowDecrypted] = useState(false);
  const protocol = useWalnutProtocol();

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

  async function handleWithdraw() {
    const success = await protocol.submitWithdraw(amount);
    if (success) setAmount("");
  }

  return (
    <div className="space-y-6">
      <GlassPanel className="walnut-hero">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Withdraw Collateral</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Withdraw Available Funds</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Withdraw collateral that is available after covering your borrowed amount.
        </p>
      </GlassPanel>

      <ProtocolAlerts protocol={protocol} />

      <GlassPanel className="walnut-card space-y-4">
        <div>
          <label htmlFor="withdraw-amount" className="mb-2 block text-sm text-foreground">
            Amount
          </label>
          <Input
            id="withdraw-amount"
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
            onClick={handleWithdraw}
            disabled={protocol.isWriting || protocol.isEncrypting}
          >
            Withdraw
          </Button>
          <Button variant="outline" className="glass-button" onClick={() => setShowDecrypted((value) => !value)}>
            {showDecrypted ? "Hide Balance" : "Show Balance"}
          </Button>
        </div>
      </GlassPanel>

      <GlassPanel className="walnut-card walnut-card-strong">
        <p className="walnut-label">Available Collateral</p>
        <p className="walnut-value">{availableCollateral}</p>
        <p className="walnut-meta">Amount you can safely withdraw now</p>
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
