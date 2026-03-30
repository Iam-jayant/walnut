"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassPanel } from "@/components/walnut/glass-panel";
import { trimHex, useWalnutProtocol } from "@/hooks/use-walnut-protocol";

function toNumber(value: unknown) {
  if (typeof value === "bigint") return Number(value);
  return 0;
}

export default function BorrowPage() {
  const [amount, setAmount] = useState("");
  const [showDecrypted, setShowDecrypted] = useState(false);
  const protocol = useWalnutProtocol();

  const collateral = useMemo(() => toNumber(protocol.collateral.decrypted.data), [protocol.collateral.decrypted.data]);
  const amountNumber = Number(amount || "0");
  const ltvRatio = collateral > 0 ? Math.min(999, (amountNumber / collateral) * 100) : 0;

  const debtLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return "******";
    if (protocol.debt.decrypted.isPending) return "Decrypting...";
    if (typeof protocol.debt.decrypted.data === "bigint") {
      return protocol.debt.decrypted.data.toString();
    }
    return "0";
  }, [protocol.canRead, protocol.debt.decrypted.data, protocol.debt.decrypted.isPending, showDecrypted]);

  async function handleBorrow() {
    const success = await protocol.submitEncryptedAmount("borrow", amount);
    if (success) setAmount("");
  }

  return (
    <div className="space-y-6">
      <GlassPanel>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Borrow</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Private Loan Request</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Borrow values are encrypted before transaction submission. LTV preview is local-only for user guidance.
        </p>
      </GlassPanel>

      <GlassPanel className="space-y-4">
        <div>
          <label htmlFor="borrow-amount" className="mb-2 block text-sm text-foreground">
            Borrow Amount (uint128)
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Estimated LTV</p>
            <p className="mt-2 font-mono text-2xl text-foreground">{ltvRatio.toFixed(2)}%</p>
          </div>
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Indicative APR</p>
            <p className="mt-2 font-mono text-2xl text-foreground">8.00%</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            className="glass-button bg-accent text-accent-foreground hover:bg-accent/85"
            onClick={handleBorrow}
            disabled={protocol.isWriting || protocol.isEncrypting}
          >
            Borrow Encrypted Amount
          </Button>
          <Button variant="outline" className="glass-button" onClick={() => setShowDecrypted((value) => !value)}>
            {showDecrypted ? "Hide Debt" : "Decrypt Debt"}
          </Button>
        </div>
      </GlassPanel>

      <GlassPanel>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Current Debt</p>
        <p className="mt-3 font-mono text-3xl text-foreground">{debtLabel}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Ciphertext: {trimHex(protocol.debt.encrypted.data as string | undefined)}
        </p>
      </GlassPanel>

      {(protocol.status || protocol.lastTxHash) && (
        <GlassPanel className="border-accent/40">
          {protocol.status && <p className="text-sm text-foreground">{protocol.status}</p>}
          {protocol.lastTxHash && (
            <p className="mt-2 font-mono text-xs text-accent/80">Tx: {trimHex(protocol.lastTxHash)}</p>
          )}
        </GlassPanel>
      )}
    </div>
  );
}
