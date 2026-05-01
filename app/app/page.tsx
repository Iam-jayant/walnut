"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  HandCoins,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/walnut/glass-panel";
import { LiquidationBadge } from "@/components/walnut/liquidation-badge";
import { ProtocolAlerts, SystemStatusPanel } from "@/components/walnut/protocol-health";
import { useWalnutProtocol } from "../../hooks/use-walnut-protocol";
import {
  BASIS_POINTS_SCALE,
  HEALTH_FACTOR_AT_RISK_THRESHOLD,
  HEALTH_FACTOR_SAFE_THRESHOLD,
  HEALTH_FACTOR_SCORE_MAX,
  HEALTH_FACTOR_SCALE,
} from "@/lib/protocol-constants";

export default function WalnutDashboardPage() {
  const [showDecrypted, setShowDecrypted] = useState(false);
  const [isRevealingValues, setIsRevealingValues] = useState(false);
  const protocol = useWalnutProtocol();
  const collateralDecrypted =
    typeof protocol.collateral.decrypted.data === "bigint"
      ? protocol.collateral.decrypted.data
      : undefined;
  const debtDecrypted =
    typeof protocol.debt.decrypted.data === "bigint" ? protocol.debt.decrypted.data : undefined;

  const primaryAction = {
    href: "/app/deposit",
    label: "Deposit",
    hint: "Add collateral",
    icon: ArrowDownToLine,
  } as const;

  const secondaryActions = [
    { href: "/app/borrow", label: "Borrow", hint: "Take a private loan", icon: HandCoins },
    { href: "/app/withdraw", label: "Withdraw", hint: "Move available collateral", icon: ArrowUpFromLine },
    { href: "/app/repay", label: "Repay", hint: "Reduce your debt", icon: RefreshCcw },
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

  const totalPoolCollateralLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return "******";
    if (protocol.totalPoolCollateralDecrypting) return "Loading...";
    if (typeof protocol.totalPoolCollateral.decrypted.data === "bigint") {
      return protocol.totalPoolCollateral.decrypted.data.toString();
    }
    return "0";
  }, [protocol.canRead, protocol.totalPoolCollateral.decrypted.data, protocol.totalPoolCollateralDecrypting, showDecrypted]);

  const totalPoolDebtLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return "******";
    if (protocol.totalPoolDebtDecrypting) return "Loading...";
    if (typeof protocol.totalPoolDebt.decrypted.data === "bigint") {
      return protocol.totalPoolDebt.decrypted.data.toString();
    }
    return "0";
  }, [protocol.canRead, protocol.totalPoolDebt.decrypted.data, protocol.totalPoolDebtDecrypting, showDecrypted]);

  const healthFactorValue = protocol.healthFactorValue;

  const healthFactorLoading = Boolean(
    showDecrypted && protocol.canRead && protocol.healthFactorDecrypting
  );

  const healthFactorDisplay = useMemo(() => {
    if (!showDecrypted) return "******";
    if (healthFactorLoading) return "Loading...";
    if (healthFactorValue === undefined) return "N/A";
    const raw = Number(healthFactorValue) / Number(HEALTH_FACTOR_SCALE);
    const clamped = Math.max(0, Math.min(HEALTH_FACTOR_SCORE_MAX, raw));
    return clamped.toFixed(2);
  }, [healthFactorLoading, healthFactorValue, showDecrypted]);

  const healthGaugePercent = useMemo(() => {
    if (!showDecrypted || healthFactorLoading || healthFactorValue === undefined) return 14;
    const hf = Number(healthFactorValue) / Number(HEALTH_FACTOR_SCALE);
    if (!Number.isFinite(hf) || hf <= 0) return 8;
    return Math.max(8, Math.min(100, (hf / HEALTH_FACTOR_SCORE_MAX) * 100));
  }, [healthFactorLoading, healthFactorValue, showDecrypted]);

  const healthStatusLabel = useMemo(() => {
    if (!showDecrypted || healthFactorLoading || healthFactorValue === undefined) {
      return "Unknown";
    }

    if (healthFactorValue >= HEALTH_FACTOR_SAFE_THRESHOLD) return "Safe";
    if (healthFactorValue >= HEALTH_FACTOR_AT_RISK_THRESHOLD) return "At Risk";
    return "Liquidatable";
  }, [healthFactorLoading, healthFactorValue, showDecrypted]);

  const healthStatusTone = useMemo(() => {
    if (healthStatusLabel === "Safe") {
      return "border-emerald-200 bg-emerald-100 text-emerald-800";
    }

    if (healthStatusLabel === "At Risk") {
      return "border-amber-200 bg-amber-100 text-amber-800";
    }

    if (healthStatusLabel === "Liquidatable") {
      return "border-red-200 bg-red-100 text-red-800";
    }

    return "walnut-status-chip-ghost";
  }, [healthStatusLabel]);

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
    const scaled = (debtValue * BASIS_POINTS_SCALE) / collateralValue;
    return Math.min(100, Number(scaled) / 100);
  }, [protocol.collateral.decrypted.data, protocol.debt.decrypted.data]);

  const readinessLabel = protocol.permit.hasPermit ? "Private access ready" : "Setup pending";
  const readinessTone = protocol.permit.hasPermit
    ? "walnut-chip-ok"
    : "walnut-chip-pending";

  const showKpiValues = showDecrypted && protocol.canRead;
  const utilizationLabel = showKpiValues ? `${utilizationPercent.toFixed(2)}%` : "******";
  const utilizationBarWidth = showKpiValues ? Math.max(8, utilizationPercent) : 12;
  const collateralMetric = showDecrypted ? collateralLabel : "******";
  const debtMetric = showDecrypted ? debtLabel : "******";
  const availableMetric = showDecrypted ? availableCollateralLabel : "******";

  const creditTierLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return "******";
    if (protocol.creditTierLoading) return "Loading...";
    if (typeof protocol.creditTier === "bigint") {
      return `Tier ${protocol.creditTier.toString()}`;
    }
    return "N/A";
  }, [protocol.canRead, protocol.creditTier, protocol.creditTierLoading, showDecrypted]);

  const tierLtvLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return "******";
    if (protocol.tierLTVLoading) return "Loading...";
    if (typeof protocol.tierLTV === "bigint") {
      const percent = Number(protocol.tierLTV) / 100;
      return `${percent.toFixed(2)}%`;
    }
    return "N/A";
  }, [protocol.canRead, protocol.tierLTV, protocol.tierLTVLoading, showDecrypted]);

  async function revealValues() {
    if (isRevealingValues) return;

    setIsRevealingValues(true);
    try {
      await protocol.refreshBalances();
      await protocol.fetchHealthFactor();
    } finally {
      setIsRevealingValues(false);
    }
  }

  function handleToggleValues() {
    const next = !showDecrypted;
    setShowDecrypted(next);

    if (next && protocol.canRead) {
      void revealValues();
    }
  }

  return (
    <div className="space-y-5">
      <GlassPanel className="walnut-hero walnut-card-strong overflow-hidden p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_auto] lg:items-start">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Dashboard</p>
            <h1 className="mt-2 font-display text-[clamp(1.9rem,1.7vw+1.2rem,2.7rem)] text-foreground">
              Private Lending Command Center
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              One place for collateral, debt, health, and quick protocol actions.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className={`walnut-status-chip ${readinessTone}`}>{readinessLabel}</span>
              <span className="walnut-status-chip walnut-status-chip-ghost">
                Utilization {showKpiValues ? `${utilizationPercent.toFixed(2)}%` : "--"}
              </span>
              <span className="walnut-status-chip walnut-status-chip-ghost">
                Health {showDecrypted ? healthFactorDisplay : "--"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button
              size="sm"
              variant="outline"
              className="glass-button"
              onClick={handleToggleValues}
              isLoading={isRevealingValues}
              loadingText="Loading..."
            >
              {showDecrypted ? "Hide Values" : "Show Values"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="glass-button"
              onClick={() => {
                void protocol.refreshBalances();
                if (showDecrypted) {
                  void protocol.fetchHealthFactor();
                }
              }}
            >
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="walnut-kpi-shell">
            <p className="walnut-label">Available</p>
            <p className="walnut-value mt-2 text-2xl tracking-[0.12em]">{availableMetric}</p>
            <p className="walnut-meta">Ready to withdraw</p>
          </div>
          <div className="walnut-kpi-shell">
            <p className="walnut-label">Collateral</p>
            <p className="walnut-value mt-2 text-2xl tracking-[0.12em]">{collateralMetric}</p>
            <p className="walnut-meta">Total supplied</p>
          </div>
          <div className="walnut-kpi-shell">
            <p className="walnut-label">Debt</p>
            <p className="walnut-value mt-2 text-2xl tracking-[0.12em]">{debtMetric}</p>
            <p className="walnut-meta">Total borrowed</p>
          </div>
          <div className="walnut-kpi-shell">
            <p className="walnut-label">Borrow Utilization</p>
            <p className="walnut-value mt-2 text-2xl tracking-[0.12em]">{utilizationLabel}</p>
            <div className="mt-3 walnut-kpi-track">
              <div className="walnut-kpi-fill" style={{ width: `${utilizationBarWidth}%` }} />
            </div>
          </div>
        </div>
      </GlassPanel>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <GlassPanel className="walnut-card walnut-card-strong">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="walnut-label">Credit Tier</p>
              <h2 className="mt-2 font-display text-2xl text-foreground">{creditTierLabel}</h2>
              <p className="mt-2 text-sm text-muted-foreground">Current max LTV: {tierLtvLabel}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="glass-button"
              onClick={() => {
                void protocol.requestCreditTierUpdate();
              }}
              isLoading={protocol.creditTierPollingActive || protocol.isWriting}
              loadingText="Checking..."
              disabled={!protocol.canWrite}
            >
              Request Update
            </Button>
          </div>
        </GlassPanel>

        <GlassPanel className="walnut-card walnut-card-strong">
          <p className="walnut-label">Pool Stats</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="walnut-kpi-shell">
              <p className="walnut-label">Total Collateral</p>
              <p className="walnut-value mt-2 text-2xl tracking-[0.12em]">{totalPoolCollateralLabel}</p>
              <p className="walnut-meta">Encrypted pool supply</p>
            </div>
            <div className="walnut-kpi-shell">
              <p className="walnut-label">Total Debt</p>
              <p className="walnut-value mt-2 text-2xl tracking-[0.12em]">{totalPoolDebtLabel}</p>
              <p className="walnut-meta">Encrypted pool utilization</p>
            </div>
          </div>
        </GlassPanel>
      </div>

      {!protocol.permit.hasPermit && (
        <GlassPanel className="walnut-card walnut-alert-warning border-amber-300/40 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="walnut-label">Setup Required</p>
              <p className="mt-2 text-sm text-foreground">
                Enable private access once to decrypt balances and use confidential actions.
              </p>
            </div>
            <Button
              size="sm"
              className="glass-button bg-accent text-accent-foreground hover:bg-accent/85"
              onClick={protocol.permit.requestPermitCreation}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Enable Private Access
            </Button>
          </div>
        </GlassPanel>
      )}

      <ProtocolAlerts protocol={protocol} />
      <LiquidationBadge liquidatable={protocol.liquidatable} />

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.85fr]">
        <GlassPanel className="walnut-card walnut-card-strong p-4 sm:p-5">
          <h2 className="font-display text-[clamp(1.35rem,1vw+1rem,2rem)] text-foreground">Actions</h2>
          <p className="mt-1 text-sm text-muted-foreground">Organized flows for each position change.</p>

          <Link
            href={primaryAction.href}
            className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-black/12 bg-white/88 px-4 py-3 transition-colors hover:border-black/20"
          >
            <div className="flex items-start gap-3">
              <div className="walnut-action-icon mt-0.5">
                <primaryAction.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[1.55rem] leading-none text-foreground">{primaryAction.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{primaryAction.hint}</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {secondaryActions.map((action) => {
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

        <GlassPanel className="walnut-card walnut-card-strong walnut-health-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="walnut-health-gauge-wrap justify-start">
              <div
                className="walnut-health-gauge"
                style={{
                  background: `conic-gradient(rgba(17, 17, 17, 0.82) ${healthGaugePercent}%, rgba(17, 17, 17, 0.12) ${healthGaugePercent}% 100%)`,
                }}
              >
                <div className="walnut-health-gauge-core">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Risk</span>
                  <span className="walnut-health-score mt-1 text-foreground">
                    {showDecrypted && healthFactorValue !== undefined
                      ? `${Math.max(
                          0,
                          Math.min(
                            HEALTH_FACTOR_SCORE_MAX,
                            Number(healthFactorValue) / Number(HEALTH_FACTOR_SCALE)
                          )
                        ).toFixed(1)}/${HEALTH_FACTOR_SCORE_MAX}`
                      : "--"}
                  </span>
                </div>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="walnut-label">Health Factor</p>
              <p className="mt-2 text-sm text-muted-foreground">Target range above 1.50</p>
              <p className="mt-2 text-xs text-muted-foreground">Show values to view status</p>
            </div>

            <span className={`walnut-status-chip ${healthStatusTone}`}>{healthStatusLabel}</span>
          </div>

          <div className="mt-4 rounded-xl border border-black/10 bg-white/90 px-3 py-2">
            <p className="walnut-label">Current</p>
            <p className="mt-1 font-mono text-lg text-foreground">{healthFactorDisplay}</p>
          </div>

          <div className="mt-4">
            <p className="mb-2 walnut-label">Risk Meter</p>
            <div className="walnut-kpi-track">
              <div className="walnut-kpi-fill" style={{ width: `${healthGaugePercent}%` }} />
            </div>
          </div>
        </GlassPanel>
      </div>

      <SystemStatusPanel protocol={protocol} />
    </div>
  );
}
