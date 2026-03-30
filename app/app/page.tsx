"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/walnut/glass-panel";
import { trimHex, useWalnutProtocol } from "@/hooks/use-walnut-protocol";

const flowCards = [
  {
    title: "Onboard Permit",
    detail: "Bind wallet context before decrypting private lending state.",
    href: "/app/onboard",
  },
  {
    title: "Encrypt Deposit",
    detail: "Seal collateral inputs in-browser and submit ciphertext handles.",
    href: "/app/deposit",
  },
  {
    title: "Borrow Privately",
    detail: "Simulate LTV locally and request encrypted debt updates.",
    href: "/app/borrow",
  },
  {
    title: "Run Demo",
    detail: "Show the full encrypt, send, and decrypt flow for judges.",
    href: "/app/demo",
  },
];

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
    <div className="space-y-6">
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
            <Button variant="outline" className="glass-button" onClick={() => setShowDecrypted((value) => !value)}>
              {showDecrypted ? "Hide Values" : "Decrypt Values"}
            </Button>
            <Button variant="outline" className="glass-button" onClick={() => protocol.refreshBalances()}>
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
            <h2 className="font-display text-xl text-foreground">Quick Actions</h2>
            <p className="text-sm text-muted-foreground">Wave 1 routes are split for precise flow testing.</p>
          </div>
          <div className="flex flex-wrap gap-2">
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

      <div className="scroll-cards">
        {flowCards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="interactive-tilt glass-panel rounded-2xl p-5"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Flow Card</p>
            <h3 className="mt-3 text-2xl font-display text-foreground">{card.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.detail}</p>
          </Link>
        ))}
      </div>

      {(protocol.status || protocol.lastTxHash) && (
        <GlassPanel className="border-accent/40">
          {protocol.status && <p className="text-sm text-foreground">{protocol.status}</p>}
          {protocol.lastTxHash && (
            <p className="mt-2 font-mono text-xs text-accent/80">Tx: {trimHex(protocol.lastTxHash)}</p>
          )}
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
