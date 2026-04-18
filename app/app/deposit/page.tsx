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

  const pendingDeposit = protocol.isWriting || protocol.isEncrypting;
  const pendingDecrypt = showDecrypted && protocol.collateralDecrypting;

  const currentCollateral = useMemo(() => {
    if (typeof protocol.collateral.decrypted.data === "bigint") return protocol.collateral.decrypted.data;
    return 0n;
  }, [protocol.collateral.decrypted.data]);

  const typedAmount = useMemo(() => {
    if (!amount || !/^\d+$/.test(amount)) return 0n;
    return BigInt(amount);
  }, [amount]);

  const projectedCollateral = useMemo(() => currentCollateral + typedAmount, [currentCollateral, typedAmount]);

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

  const projectedCollateralLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return "******";
    if (protocol.collateralDecrypting) return "Loading...";
    return projectedCollateral.toString();
  }, [projectedCollateral, protocol.canRead, protocol.collateralDecrypting, showDecrypted]);

  return (
    <div className="space-y-6">
      <GlassPanel className="walnut-hero">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Deposit Collateral</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Add Collateral</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Encrypt your input in-browser and submit private collateral to your Walnut position.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="walnut-status-chip walnut-status-chip-ghost">Secure Input</span>
          <span className="walnut-status-chip walnut-status-chip-ghost">Sepolia</span>
        </div>
      </GlassPanel>

      <ProtocolAlerts protocol={protocol} />

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <GlassPanel className="walnut-card walnut-card-strong space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="walnut-label">Deposit Studio</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Set an amount, encrypt locally, and confirm on-chain.
              </p>
            </div>
            <span className="walnut-status-chip walnut-status-chip-ghost">Encrypted</span>
          </div>

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
              className="h-12 border-black/10 bg-white text-lg text-foreground placeholder:text-muted-foreground/80"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { label: "250", value: "250" },
              { label: "500", value: "500" },
              { label: "1000", value: "1000" },
              { label: "5000", value: "5000" },
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

          <div className="walnut-progress">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">What Happens Next</p>
            <p className="mt-2 text-sm text-foreground">
              Amount is encrypted in your browser, then submitted as ciphertext to the contract.
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
              onClick={handleDeposit}
              isLoading={pendingDeposit}
              loadingText={protocol.isEncrypting ? "Encrypting..." : "Depositing..."}
              disabled={!amount || pendingDeposit}
            >
              Deposit
            </Button>
            <Button
              variant="outline"
              className="glass-button"
              onClick={() => setShowDecrypted((value) => !value)}
              isLoading={pendingDecrypt}
              loadingText="Decrypting..."
            >
              {showDecrypted ? "Hide Balance" : "Show Balance"}
            </Button>
          </div>
        </GlassPanel>

        <div className="grid gap-4">
          <GlassPanel className="walnut-card walnut-card-strong walnut-kpi-card">
            <p className="walnut-label">Current Collateral</p>
            <p className="walnut-value">{collateralLabel}</p>
            <p className="walnut-meta">Your current encrypted collateral balance</p>
          </GlassPanel>

          <GlassPanel className="walnut-card walnut-card-strong walnut-kpi-card">
            <p className="walnut-label">After This Deposit</p>
            <p className="walnut-value">{projectedCollateralLabel}</p>
            <p className="walnut-meta">Projected balance if current transaction confirms</p>
          </GlassPanel>

          <GlassPanel className="walnut-card">
            <p className="walnut-label">Status</p>
            <p className="mt-2 text-sm text-foreground">
              {pendingDeposit
                ? "Transaction in progress..."
                : protocol.status || "Ready for your next secure deposit."}
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
