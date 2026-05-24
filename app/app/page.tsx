"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  HandCoins,
  RefreshCcw,
  ShieldCheck,
  Bell,
  HelpCircle,
  Activity,
  ArrowRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/walnut/glass-panel";
import { LiquidationBadge } from "@/components/walnut/liquidation-badge";
import { ProtocolAlerts } from "@/components/walnut/protocol-health";
import { LoanHealthChart } from "@/components/dashboard/loan-health";
import { DisconnectedState } from "@/components/onboarding/disconnected-state";
import { PermitModal } from "@/components/onboarding/permit-modal";
import { useWalnutProtocol } from "../../hooks/use-walnut-protocol";
import { useTokenBalances } from "../../hooks/use-token-balances";
import {
  BASIS_POINTS_SCALE,
  HEALTH_FACTOR_AT_RISK_THRESHOLD,
  HEALTH_FACTOR_SAFE_THRESHOLD,
  HEALTH_FACTOR_SCORE_MAX,
  HEALTH_FACTOR_SCALE,
} from "@/lib/protocol-constants";

const USDC_DECIMALS = 1_000_000;
const ENCRYPTION_MASK = "••••"; // Smaller dots for encrypted values

// Token image mappings from CoinGecko CDN
const TOKEN_IMAGES: Record<string, string> = {
  USDC: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png",
  cUSDC: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png",
  WETH: "https://assets.coingecko.com/coins/images/2518/standard/weth.png",
};

const formatUSDC = (rawValue: bigint | number | string): string => {
  const num = typeof rawValue === "bigint" ? Number(rawValue) : Number(rawValue);
  return (num / USDC_DECIMALS).toFixed(2);
};

const toUSDCNumber = (rawValue: bigint | number | string): number => {
  const num = typeof rawValue === "bigint" ? Number(rawValue) : Number(rawValue);
  return num / USDC_DECIMALS;
};

export default function WalnutDashboardPage() {
  const account = useAccount();
  const [showDecrypted, setShowDecrypted] = useState(false);
  const [isRevealingValues, setIsRevealingValues] = useState(false);
  const [skipPermit, setSkipPermit] = useState(false);
  const [isCreatingPermit, setIsCreatingPermit] = useState(false);
  const protocol = useWalnutProtocol();
  const tokenBalances = useTokenBalances();
  
  // Determine which state to render
  const showDisconnected = !account.isConnected;
  const showPermitModal = account.isConnected && !protocol.permit.hasPermit && !skipPermit;
  const showDashboard = account.isConnected; // Always show dashboard when connected
  
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
    if (!showDecrypted) return ENCRYPTION_MASK;
    if (!protocol.canRead) return ENCRYPTION_MASK;
    if (protocol.collateralDecrypting || protocol.permit.isPermitInitializing) return "Loading...";
    if (typeof protocol.collateral.decrypted.data === "bigint") {
      return formatUSDC(protocol.collateral.decrypted.data);
    }
    return "—";
  }, [protocol.canRead, protocol.collateral.decrypted.data, protocol.collateralDecrypting, protocol.permit.isPermitInitializing, showDecrypted]);

  const debtLabel = useMemo(() => {
    if (!showDecrypted) return ENCRYPTION_MASK;
    if (!protocol.canRead) return ENCRYPTION_MASK;
    if (protocol.debtDecrypting || protocol.permit.isPermitInitializing) return "Loading...";
    if (typeof protocol.debt.decrypted.data === "bigint") {
      return formatUSDC(protocol.debt.decrypted.data);
    }
    return "—";
  }, [protocol.canRead, protocol.debt.decrypted.data, protocol.debtDecrypting, protocol.permit.isPermitInitializing, showDecrypted]);

  const totalPoolCollateralLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return ENCRYPTION_MASK;
    if (protocol.totalPoolCollateralDecrypting) return "Loading...";
    if (typeof protocol.totalPoolCollateral.decrypted.data === "bigint") {
      return formatUSDC(protocol.totalPoolCollateral.decrypted.data);
    }
    return "0.00";
  }, [protocol.canRead, protocol.totalPoolCollateral.decrypted.data, protocol.totalPoolCollateralDecrypting, showDecrypted]);

  const totalPoolDebtLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return ENCRYPTION_MASK;
    if (protocol.totalPoolDebtDecrypting) return "Loading...";
    if (typeof protocol.totalPoolDebt.decrypted.data === "bigint") {
      return formatUSDC(protocol.totalPoolDebt.decrypted.data);
    }
    return "0.00";
  }, [protocol.canRead, protocol.totalPoolDebt.decrypted.data, protocol.totalPoolDebtDecrypting, showDecrypted]);

  const healthFactorValue = protocol.healthFactorValue;

  const healthFactorLoading = Boolean(
    showDecrypted && protocol.canRead && protocol.healthFactorDecrypting
  );

  const healthFactorDisplay = useMemo(() => {
    if (!showDecrypted) return ENCRYPTION_MASK;
    if (healthFactorLoading) return "Loading...";
    
    const col = typeof collateralDecrypted === "bigint" ? toUSDCNumber(collateralDecrypted) : NaN;
    const debt = typeof debtDecrypted === "bigint" ? toUSDCNumber(debtDecrypted) : NaN;
    
    if (isNaN(col) || col === 0) return "N/A";
    if (isNaN(debt) || debt === 0) return "∞";
    
    const healthFactor = col / debt;
    return healthFactor.toFixed(2);
  }, [healthFactorLoading, collateralDecrypted, debtDecrypted, showDecrypted]);

  const healthGaugePercent = useMemo(() => {
    if (!showDecrypted || healthFactorLoading || healthFactorValue === undefined) return 14;
    const hf = Number(healthFactorValue) / Number(HEALTH_FACTOR_SCALE);
    if (!Number.isFinite(hf) || hf <= 0) return 8;
    return Math.max(8, Math.min(100, (hf / HEALTH_FACTOR_SCORE_MAX) * 100));
  }, [healthFactorLoading, healthFactorValue, showDecrypted]);

  const healthStatusLabel = useMemo(() => {
    if (!showDecrypted || healthFactorLoading || healthFactorValue === undefined) {
      return "--";
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
    // Available = collateral - debt (both must be decrypted first)
    if (!showDecrypted) return ENCRYPTION_MASK;
    if (!protocol.canRead) return ENCRYPTION_MASK;
    if (protocol.collateralDecrypting || protocol.debtDecrypting || protocol.permit.isPermitInitializing) return "Loading...";
    
    const collateralValue = protocol.collateral.decrypted.data;
    const debtValue = protocol.debt.decrypted.data;
    
    // Both values must exist to compute available
    if (typeof collateralValue !== "bigint" || typeof debtValue !== "bigint") return "—";
    
    // Compute available in JavaScript after both are decrypted
    const available = collateralValue > debtValue ? collateralValue - debtValue : 0n;
    return formatUSDC(available);
  }, [
    protocol.canRead,
    protocol.collateral.decrypted.data,
    protocol.debt.decrypted.data,
    protocol.collateralDecrypting,
    protocol.debtDecrypting,
    protocol.permit.isPermitInitializing,
    showDecrypted,
  ]);

  const utilizationPercent = useMemo(() => {
    const collateralValue = protocol.collateral.decrypted.data;
    const debtValue = protocol.debt.decrypted.data;
    if (typeof collateralValue !== "bigint" || typeof debtValue !== "bigint" || collateralValue <= 0n) return 0;
    const scaled = (debtValue * BASIS_POINTS_SCALE) / collateralValue;
    return Math.min(100, Number(scaled) / 100);
  }, [protocol.collateral.decrypted.data, protocol.debt.decrypted.data]);
  const poolUtilizationPercent = useMemo(() => {
    if (typeof protocol.utilizationRate !== "bigint") return 0;
    return Number(protocol.utilizationRate) / 100;
  }, [protocol.utilizationRate]);

  const readinessLabel = protocol.permit.isPermitInitializing 
    ? "Loading..." 
    : protocol.permit.hasPermit 
      ? "Private access ready" 
      : "Setup pending";
  const readinessTone = protocol.permit.isPermitInitializing
    ? "walnut-chip-pending"
    : protocol.permit.hasPermit
      ? "walnut-chip-ok"
      : "walnut-chip-pending";

  const showKpiValues = showDecrypted && protocol.canRead;
  // Utilization rate is NOT encrypted - always show it
  const utilizationLabel = `${poolUtilizationPercent.toFixed(2)}%`;
  const utilizationBarWidth = Math.max(8, poolUtilizationPercent);
  const collateralMetric = showDecrypted ? collateralLabel : ENCRYPTION_MASK;
  const debtMetric = showDecrypted ? debtLabel : ENCRYPTION_MASK;
  const availableMetric = availableCollateralLabel; // Already handles showDecrypted internally

  const creditTierLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return ENCRYPTION_MASK;
    if (protocol.creditTierLoading) return "Loading...";
    if (typeof protocol.creditTier === "bigint") {
      return `Tier ${protocol.creditTier.toString()}`;
    }
    return "N/A";
  }, [protocol.canRead, protocol.creditTier, protocol.creditTierLoading, showDecrypted]);

  const tierLtvLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return ENCRYPTION_MASK;
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

  // Helper function to format token amounts
  function formatTokenAmount(amount: bigint, decimals: number): string {
    const divisor = BigInt(10 ** decimals);
    const integerPart = amount / divisor;
    const fractionalPart = amount % divisor;
    const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
    // Show up to 2 decimal places
    const displayDecimals = Math.min(2, decimals);
    const truncatedFractional = fractionalStr.slice(0, displayDecimals);
    return `${integerPart}.${truncatedFractional}`;
  }

  // Helper function to format USD value (6 decimals)
  function formatUSDValue(usdValue: bigint | undefined): string {
    if (usdValue === undefined) return "N/A";
    return `$${formatTokenAmount(usdValue, 6)}`;
  }

  // Handle permit creation
  const handleCreatePermit = async () => {
    setIsCreatingPermit(true);
    try {
      await protocol.permit.requestPermitCreation();
    } finally {
      // Keep showing "Creating..." until permit is actually created
      // The modal will disappear when hasPermit becomes true
    }
  };

  // Reset creating state when permit is created
  // IMPORTANT: This useEffect must be BEFORE any conditional returns to follow Rules of Hooks
  useEffect(() => {
    if (protocol.permit.hasPermit && isCreatingPermit) {
      setIsCreatingPermit(false);
    }
  }, [protocol.permit.hasPermit, isCreatingPermit]);

  // STATE ROUTING
  if (showDisconnected) {
    return <DisconnectedState />;
  }

  // STATE 2 & Dashboard: Show dashboard with permit modal overlay if needed
  return (
    <>
      {/* Permit Modal Overlay - appears over dashboard when needed */}
      {showPermitModal && (
        <PermitModal
          onCreatePermit={handleCreatePermit}
          onSkip={() => setSkipPermit(true)}
          isCreating={isCreatingPermit}
        />
      )}
      
      <div className="space-y-6 animate-in fade-in duration-500 pb-12 w-full max-w-full">{/* Removed tour-metrics class */}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-sans text-[clamp(1.75rem,2vw+1rem,2.25rem)] font-semibold tracking-tight text-foreground">Private Lending Command Center</h1>
          <p className="text-[0.95rem] text-muted-foreground mt-2">One place for collateral, debt, health, and quick protocol actions.</p>
        </div>
        <div className="flex items-center gap-4 text-muted-foreground">
          <Bell className="w-5 h-5 cursor-pointer hover:text-foreground transition-colors" />
          <HelpCircle className="w-5 h-5 cursor-pointer hover:text-foreground transition-colors" />
        </div>
      </div>

      {/* Systems Operational Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between border border-black/10 rounded-xl bg-white/90 p-4 shadow-[0_4px_12px_rgba(0,0,0,0.06)] backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          <div>
            <div className="text-sm font-semibold text-foreground">All systems operational</div>
            <div className="text-xs text-muted-foreground">All protocols are functioning normally</div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4 sm:mt-0">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-9 px-4 rounded-full border-black/15 bg-white hover:bg-black/5 hover:border-black/25 transition-all font-medium"
            onClick={handleToggleValues}
            isLoading={isRevealingValues}
          >
            {showDecrypted ? "Hide Values" : "Show Values"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-9 px-4 rounded-full border-black/15 bg-white hover:bg-black/5 hover:border-black/25 transition-all font-medium"
            onClick={() => {
              void protocol.refreshBalances();
              if (showDecrypted) void protocol.fetchHealthFactor();
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      <ProtocolAlerts protocol={protocol} />
      <LiquidationBadge liquidatable={protocol.liquidatable} />

      {/* KPI Cards Layer */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border border-black/10 rounded-xl bg-linear-to-br from-white to-gray-50/50 p-5 shadow-[0_4px_16px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] flex flex-col justify-between hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all">
          <div className="flex items-start justify-between mb-2">
             <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/70">Total Supplied</div>
          </div>
          <div>
            <div className="font-mono text-[1.5rem] font-semibold text-foreground tracking-tight">
              {showDecrypted ? (
                typeof protocol.totalPoolCollateral.decrypted.data === 'bigint' 
                  ? `$${formatTokenAmount(protocol.totalPoolCollateral.decrypted.data, 6)}` 
                  : '$0.00'
              ) : ENCRYPTION_MASK}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-muted-foreground">Historical data unavailable</span>
            </div>
          </div>
        </div>
        
        <div className="border border-slate-200 rounded-xl bg-white p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between mb-2">
             <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/70">Total Borrowed</div>
          </div>
          <div>
            <div className="font-mono text-[1.5rem] font-semibold text-foreground tracking-tight">
              {showDecrypted ? (
                typeof protocol.totalPoolDebt.decrypted.data === 'bigint' 
                  ? `$${formatTokenAmount(protocol.totalPoolDebt.decrypted.data, 6)}` 
                  : '$0.00'
              ) : ENCRYPTION_MASK}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-muted-foreground">Historical data unavailable</span>
            </div>
          </div>
        </div>
        
        <div className="border border-slate-200 rounded-xl bg-white p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between mb-2">
             <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/70">Available</div>
          </div>
          <div>
            <div className="font-mono text-[1.5rem] font-semibold text-foreground tracking-tight">{availableMetric === ENCRYPTION_MASK || availableMetric === "Loading..." || availableMetric === "—" ? availableMetric : `$${availableMetric}`}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-muted-foreground">Historical data unavailable</span>
            </div>
          </div>
        </div>
        
        <div className="border border-slate-200 rounded-xl bg-white p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between mb-2">
             <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground/70">Borrow Utilization</div>
          </div>
          <div>
            <div className="font-mono text-[1.5rem] font-semibold text-foreground tracking-tight mb-2">{utilizationLabel}</div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-1.5 flex">
               <div className="bg-emerald-500 h-full rounded-l-full transition-all duration-1000" style={{ width: `${utilizationBarWidth}%` }} />
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <div className={`w-1.5 h-1.5 rounded-full ${
                utilizationBarWidth > 80 ? 'bg-red-400' :
                utilizationBarWidth > 50 ? 'bg-amber-400' :
                'bg-emerald-400'
              }`} />
              <span className="text-[11px] text-slate-500">
                {utilizationBarWidth > 80 ? 'High' :
                 utilizationBarWidth > 50 ? 'Moderate' :
                 'Low'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Balances, Vault Holdings, Loan Health */}
      <div className="grid lg:grid-cols-3 gap-4">
        
        {/* Wallet Balances */}
        <div className="border border-slate-200 rounded-xl bg-white p-5 shadow-sm overflow-hidden flex flex-col">{/* Removed tour-credit class */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold tracking-tight text-slate-900">Wallet Balances</h3>
          </div>
          
          <div className="space-y-4">
            {tokenBalances.tokenBalances.map((token) => (
              <div key={token.symbol} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-sm hover:scale-105 transition-transform cursor-pointer overflow-hidden bg-slate-100 border border-slate-200">
                    {TOKEN_IMAGES[token.symbol] ? (
                      <img 
                        src={TOKEN_IMAGES[token.symbol]} 
                        alt={token.symbol}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-xs font-bold text-slate-500">{token.symbol.slice(0, 2)}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{token.symbol}</div>
                    <div className="text-[11px] text-slate-500">{token.decimals} decimals</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-900">
                    {showDecrypted ? formatTokenAmount(token.balance, token.decimals) : ENCRYPTION_MASK}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {showDecrypted ? (
                      token.usdValueLoading ? 'Loading...' : 
                      token.usdValueError ? 'N/A' :
                      token.usdValue ? `$${formatTokenAmount(token.usdValue, 6)}` : '$0.00'
                    ) : ENCRYPTION_MASK}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Vault Holdings */}
        <div className="border border-slate-200 rounded-xl bg-white p-5 shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold tracking-tight text-slate-900">Vault Holdings</h3>
          </div>
          
          <div className="space-y-4">
            {tokenBalances.vaultHoldings.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p className="text-sm">No vault holdings yet</p>
                <p className="text-xs mt-2">Deposit collateral to get started</p>
              </div>
            ) : (
              tokenBalances.vaultHoldings.map((holding) => (
                <div key={holding.symbol} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-inner hover:scale-105 transition-transform cursor-pointer overflow-hidden bg-slate-100 border border-slate-200">
                      {TOKEN_IMAGES[holding.symbol] ? (
                        <img 
                          src={TOKEN_IMAGES[holding.symbol]} 
                          alt={holding.symbol}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-xs font-bold text-slate-500">{holding.symbol.slice(0, 2)}</div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{holding.symbol}</div>
                      <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded-sm w-fit">
                        <ShieldCheck className="w-3 h-3" /> Encrypted
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-900">
                      {showDecrypted ? formatTokenAmount(holding.amount, holding.decimals) : ENCRYPTION_MASK}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {showDecrypted ? (
                        holding.usdValue ? `$${formatTokenAmount(holding.usdValue, 6)}` : 'Collateral'
                      ) : ENCRYPTION_MASK}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Loan Health */}
        <div>{/* Removed tour-health wrapper */}
          <LoanHealthChart
            collateralUSD={typeof collateralDecrypted === "bigint" ? toUSDCNumber(collateralDecrypted) : 0}
            debtUSD={typeof debtDecrypted === "bigint" ? toUSDCNumber(debtDecrypted) : 0}
            maxLTV={typeof protocol.tierLTV === "bigint" ? Number(protocol.tierLTV) / 100 : 70}
            liquidationThreshold={85}
            showDecrypted={showDecrypted}
            isLoading={protocol.collateralDecrypting || protocol.debtDecrypting || protocol.tierLTVLoading}
          />
        </div>
      </div>

      {/* Row 3: Quick Actions */}
      <div className="grid lg:grid-cols-1 gap-4">{/* Removed tour-actions class */}
        
        {/* Quick Actions */}
        <div className="border border-slate-200 rounded-xl bg-white p-5 shadow-sm">
          <h3 className="font-bold tracking-tight text-slate-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Link href="/app/deposit" className="flex flex-col items-center justify-center py-6 px-4 border border-slate-100 bg-slate-50/80 rounded-xl hover:bg-emerald-50/50 hover:border-emerald-200 transition-all group">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm">
                <ArrowDownToLine className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-sm font-bold text-slate-900">Deposit</span>
            </Link>
            <Link href="/app/borrow" className="flex flex-col items-center justify-center py-6 px-4 border border-slate-100 bg-slate-50/80 rounded-xl hover:bg-indigo-50/50 hover:border-indigo-200 transition-all group">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm">
                <HandCoins className="w-5 h-5 text-indigo-600" />
              </div>
              <span className="text-sm font-bold text-slate-900">Borrow</span>
            </Link>
            <Link href="/app/withdraw" className="flex flex-col items-center justify-center py-6 px-4 border border-slate-100 bg-slate-50/80 rounded-xl hover:bg-orange-50/50 hover:border-orange-200 transition-all group">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm">
                <ArrowUpFromLine className="w-5 h-5 text-orange-600" />
              </div>
              <span className="text-sm font-bold text-slate-900">Withdraw</span>
            </Link>
            <Link href="/app/repay" className="flex flex-col items-center justify-center py-6 px-4 border border-slate-100 bg-slate-50/80 rounded-xl hover:bg-cyan-50/50 hover:border-cyan-200 transition-all group">
              <div className="w-12 h-12 rounded-full bg-cyan-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm">
                <RefreshCcw className="w-5 h-5 text-cyan-600" />
              </div>
              <span className="text-sm font-bold text-slate-900">Repay</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
