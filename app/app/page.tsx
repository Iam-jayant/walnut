"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  HandCoins,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/walnut/glass-panel";
import { HealthFactorCard } from "@/components/walnut/health-factor-card";
import { LiquidationBadge } from "@/components/walnut/liquidation-badge";
import { ProtocolAlerts, SystemStatusPanel } from "@/components/walnut/protocol-health";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";

export default function WalnutDashboardPage() {
  const [showDecrypted, setShowDecrypted] = useState(false);
  const protocol = useWalnutProtocol();

  const actions = [
    { href: "/app/deposit", label: "Deposit", hint: "Add collateral", icon: ArrowDownToLine },
    { href: "/app/borrow", label: "Borrow", hint: "Take a private loan", icon: HandCoins },
    { href: "/app/repay", label: "Repay", hint: "Reduce your debt", icon: RefreshCcw },
    { href: "/app/withdraw", label: "Withdraw", hint: "Move available collateral", icon: ArrowUpFromLine },
  ] as const;

  const collateralLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return "******";
    if (protocol.collateralDecrypting) return "Loading...";
    if (typeof protocol.collateral.decrypted.data === "bigint") {
      return protocol.collateral.decrypted.data.toString();
    }
    return "0";
  }, [protocol.canRead, protocol.collateral.decrypted.data, protocol.collateralDecrypting, showDecrypted]);

  const debtLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return "******";
    if (protocol.debtDecrypting) return "Loading...";
    if (typeof protocol.debt.decrypted.data === "bigint") {
      return protocol.debt.decrypted.data.toString();
    }
    return "0";
  }, [protocol.canRead, protocol.debt.decrypted.data, protocol.debtDecrypting, showDecrypted]);

  const healthFactorValue = useMemo(() => {
    if (typeof protocol.healthFactor?.decrypted?.data === "bigint") {
      return protocol.healthFactor.decrypted.data;
    }
    return undefined;
  }, [protocol.healthFactor?.decrypted?.data]);

  const availableCollateralLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return "******";
    const collateralValue = protocol.collateral.decrypted.data;
    const debtValue = protocol.debt.decrypted.data;
    if (typeof collateralValue !== "bigint" || typeof debtValue !== "bigint") return "0";
    return (collateralValue > debtValue ? collateralValue - debtValue : 0n).toString();
  }, [
    protocol.canRead,
    protocol.collateral.decrypted.data,
    protocol.debt.decrypted.data,
    showDecrypted,
  ]);

  const utilizationPercent = useMemo(() => {
    const collateralValue = protocol.collateral.decrypted.data;
    const debtValue = protocol.debt.decrypted.data;
    if (typeof collateralValue !== "bigint" || typeof debtValue !== "bigint" || collateralValue <= 0n) return 0;
    const scaled = (debtValue * 10000n) / collateralValue;
    return Math.min(100, Number(scaled) / 100);
  }, [protocol.collateral.decrypted.data, protocol.debt.decrypted.data]);

  const readinessLabel = protocol.permit.hasPermit ? "Private access ready" : "Setup pending";
  const readinessTone = protocol.permit.hasPermit
    ? "walnut-chip-ok"
    : "walnut-chip-pending";

  return (
    <div className="space-y-5">
      <GlassPanel className="walnut-hero overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Dashboard</p>
            <h1 className="mt-2 font-display text-3xl text-foreground">Private Lending Command Center</h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              View your balances and manage your position in one place.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className={`walnut-status-chip ${readinessTone}`}>{readinessLabel}</span>
              <span className="walnut-status-chip walnut-status-chip-ghost">
                Utilization {showDecrypted ? `${utilizationPercent.toFixed(2)}%` : "--"}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="glass-button" onClick={() => setShowDecrypted((value) => !value)}>
              {showDecrypted ? "Hide Values" : "Show Values"}
            </Button>
            <Button size="sm" variant="outline" className="glass-button" onClick={() => protocol.refreshBalances()}>
              Refresh
            </Button>
          </div>
        </div>
      </GlassPanel>

      {!protocol.permit.hasPermit && (
        <GlassPanel className="walnut-card walnut-alert-warning border-amber-300/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="walnut-label">Setup Required</p>
              <p className="mt-2 text-sm text-foreground">
                Enable private access once to decrypt balances and use confidential actions.
              </p>
            </div>
            <Button size="sm" className="glass-button bg-accent text-accent-foreground hover:bg-accent/85" onClick={protocol.permit.requestPermitCreation}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Enable Private Access
            </Button>
          </div>
        </GlassPanel>
      )}

      <ProtocolAlerts protocol={protocol} />

      <LiquidationBadge liquidatable={protocol.liquidatable} />

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <GlassPanel className="walnut-card walnut-card-strong walnut-spotlight">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="walnut-label">Position Lens</p>
              <h2 className="mt-2 font-display text-2xl text-foreground">Portfolio Snapshot</h2>
            </div>
            <span className="walnut-status-chip walnut-status-chip-ghost">Live</span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="walnut-kpi-shell">
              <p className="walnut-label">Available To Withdraw</p>
              <p className="walnut-value text-3xl">{availableCollateralLabel}</p>
              <p className="walnut-meta">Collateral minus current debt</p>
            </div>
            <div className="walnut-kpi-shell">
              <p className="walnut-label">Borrow Utilization</p>
              <p className="walnut-value text-3xl">
                {showDecrypted ? `${utilizationPercent.toFixed(2)}%` : "******"}
              </p>
              <p className="walnut-meta">How much of collateral is currently borrowed</p>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Borrowed vs supplied</span>
              <span>{showDecrypted ? `${utilizationPercent.toFixed(2)}%` : "--"}</span>
            </div>
            <div className="walnut-kpi-track">
              <div className="walnut-kpi-fill" style={{ width: `${Math.max(6, utilizationPercent)}%` }} />
            </div>
          </div>
        </GlassPanel>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <GlassPanel className="walnut-card walnut-card-strong walnut-kpi-card">
            <p className="walnut-label">Collateral</p>
            <p className="walnut-value">{collateralLabel}</p>
            <p className="walnut-meta">Total supplied value</p>
          </GlassPanel>
          <GlassPanel className="walnut-card walnut-card-strong walnut-kpi-card">
            <p className="walnut-label">Debt</p>
            <p className="walnut-value">{debtLabel}</p>
            <p className="walnut-meta">Total borrowed value</p>
          </GlassPanel>
        </div>
      </div>

      <HealthFactorCard
        healthFactor={healthFactorValue}
        isDecrypting={protocol.healthFactorDecrypting}
        showDecrypted={showDecrypted}
        status={protocol.healthFactorStatus}
      />

      <GlassPanel className="walnut-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-foreground">Actions</h2>
            <p className="text-sm text-muted-foreground">Use these steps to manage your position.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href} className="walnut-action-tile interactive-tilt">
                <div className="flex items-start gap-3">
                  <div className="walnut-action-icon">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{action.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{action.hint}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
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
