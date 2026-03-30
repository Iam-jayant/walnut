"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/walnut/glass-panel";
import { trimHex, useWalnutProtocol } from "@/hooks/use-walnut-protocol";

export default function WalnutDashboardPage() {
  const [showDecrypted, setShowDecrypted] = useState(false);
  const protocol = useWalnutProtocol();

  const collateralLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return "******";
    if (protocol.collateral.decrypted.isPending) return "Decrypting...";
    if (typeof protocol.collateral.decrypted.data === "bigint") {
      return protocol.collateral.decrypted.data.toString();
    }
    return "0";
  }, [protocol.canRead, protocol.collateral.decrypted.data, protocol.collateral.decrypted.isPending, showDecrypted]);

  const debtLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return "******";
    if (protocol.debt.decrypted.isPending) return "Decrypting...";
    if (typeof protocol.debt.decrypted.data === "bigint") {
      return protocol.debt.decrypted.data.toString();
    }
    return "0";
  }, [protocol.canRead, protocol.debt.decrypted.data, protocol.debt.decrypted.isPending, showDecrypted]);

  return (
    <div className="space-y-5">
      <GlassPanel className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Encrypted Dashboard</p>
            <h1 className="mt-2 font-display text-3xl text-foreground">Private Lending Command Center</h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              This dashboard reads encrypted collateral and debt from WalnutWave1 and decrypts values locally in your
              browser.
            </p>
          </div>
          <div className="flex gap-2">
            {!protocol.permit.hasPermit && (
              <Button size="sm" variant="outline" className="glass-button" onClick={protocol.permit.requestPermitCreation}>
                Enable Private Access
              </Button>
            )}
            <Button size="sm" variant="outline" className="glass-button" onClick={() => setShowDecrypted((value) => !value)}>
              {showDecrypted ? "Hide Values" : "Decrypt Values"}
            </Button>
            <Button size="sm" variant="outline" className="glass-button" onClick={() => protocol.refreshBalances()}>
              Refresh
            </Button>
          </div>
        </div>
      </GlassPanel>

      <div className="grid gap-4 md:grid-cols-2">
        <GlassPanel>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Collateral</p>
          <p className="mt-4 font-mono text-4xl text-foreground">{collateralLabel}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            Ciphertext: {trimHex(protocol.collateral.encrypted.data as string | undefined)}
          </p>
        </GlassPanel>
        <GlassPanel>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Debt</p>
          <p className="mt-4 font-mono text-4xl text-foreground">{debtLabel}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            Ciphertext: {trimHex(protocol.debt.encrypted.data as string | undefined)}
          </p>
        </GlassPanel>
      </div>

      <GlassPanel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-foreground">Actions</h2>
            <p className="text-sm text-muted-foreground">Move through the encrypted flow in order.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Link href="/app/onboard" className="glass-chip">
              Onboard
            </Link>
            <Link href="/app/deposit" className="glass-chip">
              Deposit
            </Link>
            <Link href="/app/borrow" className="glass-chip">
              Borrow
            </Link>
            <Link href="/app/repay" className="glass-chip">
              Repay
            </Link>
            <Link href="/app/demo" className="glass-chip">
              Demo
            </Link>
          </div>
        </div>
      </GlassPanel>

      {(protocol.status || protocol.lastTxHash) && (
        <GlassPanel className="border-accent/40">
          {protocol.status && <p className="text-sm text-foreground">{protocol.status}</p>}
          {protocol.lastTxHash && (
            <p className="mt-2 font-mono text-xs text-accent/80">Tx: {trimHex(protocol.lastTxHash)}</p>
          )}
        </GlassPanel>
      )}

      {protocol.permit.isPermitInitializing && (
        <GlassPanel className="border-black/10">
          <p className="text-sm text-muted-foreground">Preparing private access...</p>
        </GlassPanel>
      )}

      {protocol.decryptBlocked && !protocol.permit.isPermitInitializing && (
        <GlassPanel className="border-amber-300/40">
          <p className="text-sm text-foreground">Private access not enabled.</p>
        </GlassPanel>
      )}

      {!protocol.canUseContract && (
        <GlassPanel className="border-destructive/50">
          <p className="text-sm text-destructive">
            Set <code>NEXT_PUBLIC_WALNUT_CONTRACT_ADDRESS</code> to enable encrypted contract actions.
          </p>
        </GlassPanel>
      )}
    </div>
  );
}
