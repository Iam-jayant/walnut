"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassPanel } from "@/components/walnut/glass-panel";
import { trimHex, useWalnutProtocol } from "@/hooks/use-walnut-protocol";

export default function RepayPage() {
  const [repayAmount, setRepayAmount] = useState("");
  const [showDecrypted, setShowDecrypted] = useState(false);
  const [localStatus, setLocalStatus] = useState("");
  const protocol = useWalnutProtocol();

  const debtLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return "******";
    if (protocol.debt.decrypted.isPending) return "Decrypting...";
    if (typeof protocol.debt.decrypted.data === "bigint") {
      return protocol.debt.decrypted.data.toString();
    }
    return "0";
  }, [protocol.canRead, protocol.debt.decrypted.data, protocol.debt.decrypted.isPending, showDecrypted]);

  function handleRepayIntent() {
    if (!repayAmount || !/^\d+$/.test(repayAmount)) {
      setLocalStatus("Enter a valid amount before preparing a repay intent.");
      return;
    }
    setLocalStatus(
      `Repay intent prepared for ${repayAmount}. Wave 1 contract does not expose repay() yet; this page is ready for the upgrade.`
    );
  }

  return (
    <div className="space-y-6">
      <GlassPanel>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Repay</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Repayment Flow Skeleton</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Wave 1 includes complete repay UX scaffolding. We will wire this to an on-chain <code>repay()</code> method
          during the core lending implementation wave.
        </p>
      </GlassPanel>

      <GlassPanel className="space-y-4">
        <div>
          <label htmlFor="repay-amount" className="mb-2 block text-sm text-foreground">
            Repay Amount (uint128)
          </label>
          <Input
            id="repay-amount"
            inputMode="numeric"
            value={repayAmount}
            onChange={(event) => setRepayAmount(event.target.value.replace(/[^0-9]/g, ""))}
            placeholder="100"
            className="border-black/10 bg-white text-foreground placeholder:text-muted-foreground/80"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            className="glass-button bg-accent text-accent-foreground hover:bg-accent/85"
            onClick={handleRepayIntent}
          >
            Prepare Repay Intent
          </Button>
          <Button variant="outline" className="glass-button" onClick={() => setShowDecrypted((value) => !value)}>
            {showDecrypted ? "Hide Debt" : "Decrypt Debt"}
          </Button>
        </div>

        {localStatus && <p className="text-sm text-foreground">{localStatus}</p>}
      </GlassPanel>

      <GlassPanel>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Outstanding Debt</p>
        <p className="mt-3 font-mono text-3xl text-foreground">{debtLabel}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Ciphertext: {trimHex(protocol.debt.encrypted.data as string | undefined)}
        </p>
      </GlassPanel>
    </div>
  );
}
