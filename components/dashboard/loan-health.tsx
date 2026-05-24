"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface LoanHealthProps {
  collateralUSD: number;
  debtUSD: number;
  maxLTV: number;
  liquidationThreshold: number;
  showDecrypted: boolean;
  isLoading: boolean;
}

export function LoanHealthChart({
  collateralUSD,
  debtUSD,
  maxLTV,
  liquidationThreshold,
  showDecrypted,
  isLoading,
}: LoanHealthProps) {
  // Calculate metrics
  const currentLTV = useMemo(() => {
    if (collateralUSD === 0) return 0;
    return (debtUSD / collateralUSD) * 100;
  }, [collateralUSD, debtUSD]);

  const healthFactor = useMemo(() => {
    if (debtUSD === 0) return Infinity;
    const liquidationLTV = liquidationThreshold / 100;
    return (collateralUSD * liquidationLTV) / debtUSD;
  }, [collateralUSD, debtUSD, liquidationThreshold]);

  const utilizationPercent = useMemo(() => {
    if (maxLTV === 0) return 0;
    return Math.min(100, (currentLTV / maxLTV) * 100);
  }, [currentLTV, maxLTV]);

  // Determine health factor color
  const healthFactorColor = useMemo(() => {
    if (healthFactor === Infinity) return "text-slate-500";
    if (healthFactor > 1.5) return "text-emerald-600";
    if (healthFactor >= 1.05) return "text-amber-600";
    return "text-red-600";
  }, [healthFactor]);

  const healthFactorBgColor = useMemo(() => {
    if (healthFactor === Infinity) return "bg-slate-50";
    if (healthFactor > 1.5) return "bg-emerald-50";
    if (healthFactor >= 1.05) return "bg-amber-50";
    return "bg-red-50";
  }, [healthFactor]);

  // Chart data
  const chartData = useMemo(() => {
    const used = Math.min(utilizationPercent, 100);
    const available = Math.max(100 - used, 0);
    return [
      { name: "Used", value: used },
      { name: "Available", value: available },
    ];
  }, [utilizationPercent]);

  const COLORS = {
    used: healthFactor === Infinity ? "#94a3b8" : healthFactor > 1.5 ? "#10b981" : healthFactor >= 1.05 ? "#f59e0b" : "#ef4444",
    available: "#e2e8f0",
  };

  const healthFactorDisplay = healthFactor === Infinity ? "∞" : healthFactor.toFixed(2);
  const ENCRYPTION_MASK = "● ● ● ●";

  if (!showDecrypted) {
    return (
      <div className="border border-slate-200 rounded-xl bg-white p-5 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-4">
          Loan Health
        </h3>
        <div className="flex items-center justify-center h-48 text-muted-foreground">
          <div className="text-center">
            <div className="text-2xl mb-2">{ENCRYPTION_MASK}</div>
            <div className="text-sm">Show values to view loan health</div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="border border-slate-200 rounded-xl bg-white p-5 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-4">
          Loan Health
        </h3>
        <div className="flex items-center justify-center h-48 text-muted-foreground">
          <div className="text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-xl bg-white p-5 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-4">
        Loan Health
      </h3>

      <div className="grid md:grid-cols-[180px_1fr] gap-6 items-center">
        {/* Donut Chart */}
        <div className="relative mx-auto">
          <ResponsiveContainer width={180} height={180}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index === 0 ? COLORS.used : COLORS.available}
                    stroke="none"
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">
                {utilizationPercent.toFixed(0)}%
              </div>
              <div className="text-xs text-muted-foreground">Utilization</div>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="space-y-3">
          <div className={`rounded-xl ${healthFactorBgColor} p-3`}>
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium text-muted-foreground">Health Factor</span>
              <span className={`text-xl font-bold ${healthFactorColor}`}>
                {healthFactorDisplay}
              </span>
            </div>
            {healthFactor !== Infinity && healthFactor < 1.5 && (
              <p className="text-xs text-muted-foreground mt-1">
                {healthFactor < 1.05
                  ? "⚠️ Critical - Risk of liquidation"
                  : "⚠️ Warning - Consider repaying"}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="text-[10px] text-muted-foreground">Liquidation Threshold</div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5">
                {liquidationThreshold}%
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="text-[10px] text-muted-foreground">Current LTV</div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5">
                {currentLTV.toFixed(2)}%
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="text-[10px] text-muted-foreground">Max LTV</div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5">
                {maxLTV}%
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="text-[10px] text-muted-foreground">Collateral</div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5">
                ${collateralUSD.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
