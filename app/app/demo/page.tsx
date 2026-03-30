"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trimHex, type WalnutAction, useWalnutProtocol } from "@/hooks/use-walnut-protocol";
import { GlassPanel } from "@/components/walnut/glass-panel";
import { ProtocolAlerts, SystemStatusPanel } from "@/components/walnut/protocol-health";

export default function DemoPage() {
  const [amount, setAmount] = useState("");
  const [action, setAction] = useState<WalnutAction>("deposit");
  const [showDecrypted, setShowDecrypted] = useState(false);
  const protocol = useWalnutProtocol();

  async function runDemo() {
    const success = await protocol.submitEncryptedAmount(action, amount);
    if (success) setAmount("");
  }

  const collateralLabel = useMemo(() => {
    if (!showDecrypted || !protocol.canRead) return "******";
    if (protocol.collateralDecrypting) return "Decrypting...";
    if (typeof protocol.collateral.decrypted.data === "bigint") {
      return protocol.collateral.decrypted.data.toString();
    }
    return "0";
  }, [protocol.canRead, protocol.collateral.decrypted.data, protocol.collateralDecrypting, showDecrypted]);

  const debtLabel = useMemo(() => {
    if (!showDecrypted || !protocol.canRead) return "******";
    if (protocol.debtDecrypting) return "Decrypting...";
    if (typeof protocol.debt.decrypted.data === "bigint") {
      return protocol.debt.decrypted.data.toString();
    }
    return "0";
  }, [protocol.canRead, protocol.debt.decrypted.data, protocol.debtDecrypting, showDecrypted]);

  return (
    <div className="space-y-6">
      <GlassPanel>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Demo / Test</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Encrypt -&gt; Send -&gt; Decrypt</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Use this route during judging to show the full private flow in one place.
        </p>
      </GlassPanel>

      <ProtocolAlerts protocol={protocol} />

      <GlassPanel className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm text-foreground">Action</p>
            <div className="flex gap-2">
              <button
                className={`glass-chip ${action === "deposit" ? "glass-chip-active" : ""}`}
                onClick={() => setAction("deposit")}
              >
                Deposit
              </button>
              <button
                className={`glass-chip ${action === "borrow" ? "glass-chip-active" : ""}`}
                onClick={() => setAction("borrow")}
              >
                Borrow
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="demo-amount" className="mb-2 block text-sm text-foreground">
              Amount (uint128)
            </label>
            <Input
              id="demo-amount"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="42"
              className="border-black/10 bg-white text-foreground placeholder:text-muted-foreground/80"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            className="glass-button bg-accent text-accent-foreground hover:bg-accent/85"
            onClick={runDemo}
            disabled={protocol.isEncrypting || protocol.isWriting}
          >
            Run Encrypted Transaction
          </Button>
          <Button variant="outline" className="glass-button" onClick={() => setShowDecrypted((value) => !value)}>
            {showDecrypted ? "Hide Decrypted Output" : "Decrypt Output"}
          </Button>
          <Button variant="outline" className="glass-button" onClick={() => protocol.refreshBalances()}>
            Re-Read State
          </Button>
        </div>
      </GlassPanel>

      <div className="grid gap-4 md:grid-cols-2">
        <GlassPanel>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Collateral</p>
          <p className="mt-3 font-mono text-3xl text-foreground">{collateralLabel}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Ciphertext: {trimHex(protocol.collateral.encrypted.data as string | undefined)}
          </p>
        </GlassPanel>
        <GlassPanel>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Debt</p>
          <p className="mt-3 font-mono text-3xl text-foreground">{debtLabel}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Ciphertext: {trimHex(protocol.debt.encrypted.data as string | undefined)}
          </p>
        </GlassPanel>
      </div>

      {(protocol.status || protocol.lastTxHash) && (
        <GlassPanel className="border-accent/40">
          {protocol.status && <p className="text-sm text-foreground">{protocol.status}</p>}
          {protocol.lastTxHash && (
            <p className="mt-2 font-mono text-xs text-accent/80">Tx: {trimHex(protocol.lastTxHash)}</p>
          )}
        </GlassPanel>
      )}

      <SystemStatusPanel protocol={protocol} />
    </div>
  );
}
