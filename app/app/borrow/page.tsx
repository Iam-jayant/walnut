"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProtocolAlerts } from "@/components/walnut/protocol-health";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";
import { useTokenBalances } from "@/hooks/use-token-balances";

function toNumber(value: unknown) {
  if (typeof value === "bigint") return Number(value);
  return 0;
}

const parseUSDCInput = (value: string): bigint => {
  if (!value || !/^\d+(\.\d+)?$/.test(value)) return 0n;
  const [whole = "0", fraction = ""] = value.split(".");
  return BigInt(`${whole}${fraction.padEnd(6, "0").slice(0, 6)}`);
};

const formatUSDC = (rawValue: bigint | number | string): string => {
  const num = typeof rawValue === "bigint" ? Number(rawValue) : Number(rawValue);
  return (num / 1_000_000).toFixed(2);
};

const HIDDEN_VALUE = "••••••";
const HIDDEN_PREVIEW = "••••";

export default function BorrowPage() {
  const [amount, setAmount] = useState("");
  const [showDecrypted, setShowDecrypted] = useState(false);
  const [borrowInFlight, setBorrowInFlight] = useState(false);
  const [isRevealingDebt, setIsRevealingDebt] = useState(false);
  const protocol = useWalnutProtocol();
  const { refreshBalances } = useTokenBalances();

  const pendingBorrow = borrowInFlight || protocol.isEncrypting;
  const pendingDecrypt = showDecrypted && protocol.debtDecrypting;

  const collateral = useMemo(() => toNumber(protocol.collateral.decrypted.data), [protocol.collateral.decrypted.data]);
  const currentDebt = useMemo(() => toNumber(protocol.debt.decrypted.data), [protocol.debt.decrypted.data]);
  const currentDebtBigint = useMemo(() => {
    if (typeof protocol.debt.decrypted.data === "bigint") return protocol.debt.decrypted.data;
    return 0n;
  }, [protocol.debt.decrypted.data]);

  const typedAmount = useMemo(() => {
    return parseUSDCInput(amount);
  }, [amount]);

  const projectedDebt = useMemo(() => currentDebtBigint + typedAmount, [currentDebtBigint, typedAmount]);
  const amountNumber = Number(typedAmount);
  const newDebt = currentDebt + amountNumber;

  const creditTier = typeof protocol.creditTier === "bigint" ? Number(protocol.creditTier) : 0;
  const tierLtvBps = typeof protocol.tierLTV === "bigint" ? Number(protocol.tierLTV) : 7000;
  const tierLtvPercent = tierLtvBps / 100;

  const maxBorrowAmount = useMemo(() => {
    if (collateral <= 0) return 0;
    return Math.floor((collateral * tierLtvBps) / 10000);
  }, [collateral, tierLtvBps]);

  const ltvRatio = collateral > 0 ? Math.min(999, (newDebt / collateral) * 100) : 0;
  const canRenderRiskPreview = showDecrypted && protocol.canRead && !protocol.debtDecrypting && collateral > 0;
  const previewLtv = canRenderRiskPreview ? `${ltvRatio.toFixed(2)}%` : HIDDEN_PREVIEW;

  const previewHealthFactor = useMemo(() => {
    if (!canRenderRiskPreview || newDebt <= 0) return HIDDEN_PREVIEW;
    const healthFactorRaw = (collateral * 10000) / newDebt;
    const healthFactorClamped = Math.min(healthFactorRaw, 100000);
    return (healthFactorClamped / 10000).toFixed(2);
  }, [canRenderRiskPreview, collateral, newDebt]);

  const exceedsLTV = canRenderRiskPreview ? ltvRatio > tierLtvPercent : false;
  const exceedsMaxBorrow = amountNumber > maxBorrowAmount;
  // currentBorrowRate() on-chain is broken: it multiplies by totalBorrowed which is an FHE
  // ciphertext handle, producing garbage (e.g. 2.95e+30%). We replicate the contract formula
  // client-side: rate = 600 + (userDebt * 600 / totalDeposited) in basis points, / 100 for %.
  // Falls back to 6% base rate when values aren't available.
  const borrowAprPercent = useMemo(() => {
    const userDebt = protocol.debt?.decrypted?.data;
    const deposited = protocol.totalPoolCollateral?.decrypted?.data;
    if (typeof userDebt === "bigint" && typeof deposited === "bigint" && deposited > 0n) {
      const bps = 600n + (userDebt * 600n) / deposited;
      const pct = Number(bps) / 100;
      return pct > 0 && pct < 1000 ? pct : 6;
    }
    return 6; // base rate: 6% APR
  }, [protocol.debt?.decrypted?.data, protocol.totalPoolCollateral?.decrypted?.data]);

  // Active loans summary
  const activeLoanCount = protocol.activeLoans.length;
  const totalDebtUSDC = formatUSDC(protocol.totalActivePrincipal);

  const interestEstimates = useMemo(() => {
    if (!typedAmount || typedAmount === 0n) {
      return { days30: "0.00", days90: "0.00", year1: "0.00" };
    }
    const principal = Number(typedAmount) / 1_000_000;
    const aprDecimal = borrowAprPercent / 100;
    return {
      days30: (principal * aprDecimal * (30 / 365)).toFixed(2),
      days90: (principal * aprDecimal * (90 / 365)).toFixed(2),
      year1:  (principal * aprDecimal).toFixed(2),
    };
  }, [typedAmount, borrowAprPercent]);

  const debtLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return HIDDEN_VALUE;
    if (protocol.debtDecrypting && typeof protocol.debt.decrypted.data === "undefined") return "Loading...";
    if (typeof protocol.debt.decrypted.data === "bigint") return formatUSDC(protocol.debt.decrypted.data);
    return "0.00";
  }, [protocol.canRead, protocol.debt.decrypted.data, protocol.debtDecrypting, showDecrypted]);

  async function handleBorrow() {
    if (pendingBorrow || !amount) return;

    setBorrowInFlight(true);
    try {
      const success = await protocol.submitEncryptedAmount("borrow", amount);
      if (success) {
        setAmount("");
        await refreshBalances();
        void protocol.refetchActiveLoans();
      }
    } finally {
      setBorrowInFlight(false);
    }
  }

  async function handleToggleDebt() {
    const next = !showDecrypted;
    setShowDecrypted(next);
    if (next && protocol.canRead) {
      setIsRevealingDebt(true);
      try {
        await protocol.debt.decrypted.refetch();
      } finally {
        setIsRevealingDebt(false);
      }
    }
  }

  const projectedDebtLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return HIDDEN_VALUE;
    if (protocol.debtDecrypting && typeof protocol.debt.decrypted.data === "undefined") return "Loading...";
    return formatUSDC(projectedDebt);
  }, [projectedDebt, protocol.canRead, protocol.debtDecrypting, showDecrypted, protocol.debt.decrypted.data]);

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="pb-6 border-b border-black/10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-black rounded-md">Borrow cUSDC</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-xl rounded-md">
            Request a private loan with encrypted settlement.
          </p>
        </div>
      </div>

      <ProtocolAlerts protocol={protocol} />

      {/* Active loans banner */}
      {activeLoanCount > 0 && (
        <div className="rounded-md border border-black/10 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          You have <strong>{activeLoanCount}</strong> active loan{activeLoanCount !== 1 ? "s" : ""}.
          {protocol.totalActivePrincipal > 0n && (
            <> Total principal: <strong>${totalDebtUSDC}</strong> cUSDC.</>
          )}
          {" "}You can continue borrowing as long as collateral covers your total debt (LTV enforced by the protocol).
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-3 rounded-md">
        <section className="md:col-span-2 space-y-6 bg-white border border-black/10 p-6 rounded-md">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <h2 className="text-base font-bold text-black flex items-center gap-2 rounded-md">
               Borrow Studio
            </h2>
          </div>

          <div className="space-y-4 rounded-md">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="borrow-amount" className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 rounded-md">
                  Borrow Amount (cUSDC)
                </label>
                <div className="text-[10px] text-slate-400 font-medium">
                  Max: {canRenderRiskPreview ? formatUSDC(maxBorrowAmount) : HIDDEN_VALUE} cUSDC
                </div>
              </div>
              <Input
                id="borrow-amount"
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className="text-3xl font-semibold py-8 px-4 rounded-md border-black/10 focus-visible:ring-0 focus-visible:border-black/20 text-black placeholder:text-slate-300"
              />
              
              <div className="flex gap-2 mt-3">
                {[
                  { label: "$100", value: "100" },
                  { label: "$250", value: "250" },
                  { label: "$500", value: "500" },
                  { label: "$1000", value: "1000" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAmount(option.value)}
                    className="px-4 py-1.5 border border-black/10 bg-slate-50/50 rounded-md text-xs font-medium text-slate-600 hover:bg-black/5 hover:text-black transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {!pendingBorrow && (exceedsLTV || exceedsMaxBorrow) && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 mt-4">
                <p className="text-sm font-medium text-red-800">
                  {exceedsMaxBorrow
                    ? `This amount exceeds your maximum borrow limit of ${formatUSDC(maxBorrowAmount)} cUSDC. Please enter a lower amount.`
                    : `This amount is above the ${tierLtvPercent.toFixed(2)}% LTV limit. Please enter a lower amount.`}
                </p>
              </div>
            )}

            <div className="rounded-md border border-black/10 bg-slate-50 px-4 py-3 mt-4">
              <p className="text-xs text-slate-500 mb-2 font-medium">
                {`Your credit tier ${creditTier} allows up to ${tierLtvPercent.toFixed(2)}% LTV at ${borrowAprPercent.toFixed(2)}% APR.`}
              </p>
              {typedAmount > 0n && (
                <div className="text-xs text-slate-700 mt-2 pt-2 border-t border-black/10">
                  <div className="font-semibold mb-1">Interest Estimates:</div>
                  <div className="space-y-0.5 font-mono">
                    <div className="flex justify-between"><span>30 days:</span> <span>~${interestEstimates.days30}</span></div>
                    <div className="flex justify-between"><span>90 days:</span> <span>~${interestEstimates.days90}</span></div>
                    <div className="flex justify-between"><span>1 year:</span> <span>~${interestEstimates.year1}</span></div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              {!protocol.permit.hasPermit && (
                <Button
                  variant="outline"
                  className="w-full sm:w-auto h-12 rounded-md border-black/10 hover:bg-slate-50"
                  onClick={protocol.permit.requestPermitCreation}
                  isLoading={protocol.permit.isPermitInitializing}
                  loadingText="Enabling..."
                >
                  Enable Private Access
                </Button>
              )}
              <Button
                className="w-full sm:w-auto bg-black text-white hover:bg-black/90 font-bold h-12 text-[15px] rounded-md shadow-none flex-1"
                onClick={handleBorrow}
                isLoading={pendingBorrow}
                loadingText={protocol.isEncrypting ? "Encrypting..." : "Borrowing..."}
                disabled={!amount || pendingBorrow || exceedsLTV || exceedsMaxBorrow}
              >
                Borrow cUSDC
              </Button>
              <Button
                variant="outline"
                className="w-full sm:w-auto h-12 rounded-md border-black/10 hover:bg-slate-50"
                onClick={handleToggleDebt}
                isLoading={pendingDecrypt || isRevealingDebt}
                loadingText="Decrypting..."
              >
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span className="inline-flex h-4 w-4 items-center justify-center">
                    {showDecrypted ? (
                      <EyeOff className="h-4 w-4 text-slate-500" />
                    ) : (
                      <Eye className="h-4 w-4 text-slate-500" />
                    )}
                  </span>
                  <span>{showDecrypted ? "Hide Debt" : "Show Debt"}</span>
                </span>
              </Button>
            </div>
          </div>
        </section>

        <aside className="grid gap-6 self-start md:col-span-1">
          <div className="rounded-md">
            <div className="w-full">
              <div 
                className={`inline-flex w-full items-center justify-between gap-3 min-w-0 border rounded-md px-4 py-3 text-xs ${
                  pendingBorrow ? "bg-blue-50 border-blue-200 text-blue-700" :
                  (exceedsMaxBorrow || exceedsLTV) ? "bg-red-50 border-red-200 text-red-700" :
                  "bg-emerald-50 border-emerald-200 text-emerald-700"
                }`}
              >
                <div className={`inline-flex items-center gap-2 font-bold uppercase tracking-widest ${
                  pendingBorrow ? "text-blue-500" :
                  (exceedsMaxBorrow || exceedsLTV) ? "text-red-500" :
                  "text-emerald-600"
                }`}>
                  <span className={`inline-block h-2 w-2 rounded-sm animate-pulse ${
                    pendingBorrow ? "bg-blue-500" :
                    (exceedsMaxBorrow || exceedsLTV) ? "bg-red-500" :
                    "bg-emerald-500"
                  }`} />
                  <span>Status</span>
                </div>
                <div className="min-w-0 truncate font-semibold">
                  {pendingBorrow ? "Borrowing..." : !amount ? "Ready" : exceedsMaxBorrow ? `Exceeds max` : exceedsLTV ? `Above LTV` : "Ready to Borrow"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-black/10 bg-white p-5 space-y-4 shadow-none">
            <div className="flex items-center justify-between gap-3 border-b border-black/10 pb-3">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Credit Tier</div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-black border border-black/10 px-2 py-0.5 rounded-md">Encrypted</div>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-black">Tier {creditTier}</p>
              <p className="text-xs text-slate-400 font-medium">of 4</p>
            </div>
            
            <div className="grid gap-3 pt-2">
              <div className="flex justify-between items-center text-sm min-w-0">
                <span className="text-slate-500">Max LTV</span>
                <span className="font-mono text-black font-medium min-w-0 text-right truncate">{tierLtvPercent.toFixed(2)}%</span>
              </div>
              <div className="w-full h-px bg-black/5" />
              <div className="flex justify-between items-center text-sm min-w-0">
                <span className="text-slate-500">Borrow APR</span>
                <span className="font-mono text-black font-medium min-w-0 text-right truncate">{borrowAprPercent.toFixed(2)}%</span>
              </div>
              <div className="w-full h-px bg-black/5" />
              <div className="flex justify-between items-center text-sm min-w-0">
                <span className="text-slate-500">Max Borrow</span>
                <span className="font-mono text-black font-medium min-w-0 text-right truncate">
                  {canRenderRiskPreview ? `${formatUSDC(maxBorrowAmount)} cUSDC` : HIDDEN_VALUE}
                </span>
              </div>
              <div className="w-full h-px bg-black/5" />
              <div className="flex justify-between items-center text-sm min-w-0">
                <span className="text-slate-500">Active Loans</span>
                <span className="font-mono text-black font-medium min-w-0 text-right truncate">{activeLoanCount}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="p-5 border border-black/10 bg-white rounded-md shadow-none flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Current Debt</div>
            <div className="font-mono text-2xl font-bold text-black">{debtLabel}</div>
          </div>
          <div className="text-xs text-slate-400 mt-4 font-medium">Your current borrowed balance (cUSDC)</div>
        </div>
        
        <div className="p-5 border border-black/10 bg-white rounded-md shadow-none flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Projected Debt</div>
            <div className="font-mono text-2xl font-bold text-black">{projectedDebtLabel}</div>
          </div>
          <div className="text-xs text-slate-400 mt-4 font-medium">Estimated debt after this transaction</div>
        </div>
        
        <div className="p-5 border border-black/10 bg-white rounded-md shadow-none">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-4 border-b border-black/10 pb-2">Risk Preview</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">New LTV</div>
              <div className="font-mono text-lg font-bold text-black">{previewLtv}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Health Factor</div>
              <div className="font-mono text-lg font-bold text-black">{previewHealthFactor}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
