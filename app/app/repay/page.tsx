"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, DollarSign, Eye, EyeOff, Loader2, Landmark, Receipt, Hourglass, ChevronDown, Dna } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProtocolAlerts } from "@/components/walnut/protocol-health";
import { useWalnutProtocol, type LoanRecord } from "@/hooks/use-walnut-protocol";

const MICRO_USDC = 1_000_000n;
const HIDDEN_VALUE = "••••••";

type LoanStatus = "processing" | "unpaid" | "paid";

type LoanWithIndex = {
  loan: LoanRecord;
  loanIndex: number;
  displayNumber: number;
  status: LoanStatus;
};

const formatUSDC = (rawValue: bigint | number | string): string => {
  const value = typeof rawValue === "bigint" ? rawValue : BigInt(Math.max(0, Number(rawValue)));
  const whole = value / MICRO_USDC;
  const fraction = value % MICRO_USDC;
  return `${whole.toString()}.${fraction.toString().padStart(6, "0").slice(0, 2)}`;
};

const formatDate = (timestamp: bigint): string => {
  if (timestamp <= 0n) return "Date unavailable";
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const formatTimeSince = (openedAt: bigint): string => {
  if (openedAt <= 0n) return "";
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(openedAt));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

function estimateInterest(principal: bigint, openedAt: bigint): bigint {
  if (principal <= 0n || openedAt <= 0n) return 0n;
  const elapsed = BigInt(Math.max(0, Math.floor(Date.now() / 1000) - Number(openedAt)));
  const secondsPerYear = 31_536_000n;
  return (principal * 800n * elapsed) / (secondsPerYear * 10_000n);
}

function getLoanStatus(loan: LoanRecord): LoanStatus {
  if (loan.principalPending) return "processing";
  if (loan.active && loan.principal > 0n) return "unpaid";
  return "paid";
}

function statusBadge(status: LoanStatus) {
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
        Paid
      </span>
    );
  }
  if (status === "processing") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-600 ring-1 ring-amber-200">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading
      </span>
    );
  }
  // Unpaid
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-600/20">
      <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
      Unpaid
    </span>
  );
}

interface LoanCardProps {
  item: LoanWithIndex;
  onRepay: (item: LoanWithIndex, estimatedSettlementAmount: bigint) => Promise<void>;
  onRecover: (item: LoanWithIndex) => Promise<void>;
  repayingIndex: number | null;
  recoveringIndex: number | null;
  settlementPending: boolean;
  compact?: boolean;
}

function LoanCard({ item, onRepay, onRecover, repayingIndex, recoveringIndex, settlementPending, compact = false }: LoanCardProps) {
  const { loan, loanIndex, displayNumber, status } = item;
  const [isExpanded, setIsExpanded] = useState(false);
  
  const isRepaying = repayingIndex === loanIndex;
  const isRecovering = recoveringIndex === loanIndex;
  const isBusy = repayingIndex !== null || settlementPending;
  const isUnpaid = status === "unpaid";
  const isProcessing = status === "processing";
  const isPaid = status === "paid";

  const interest = useMemo(() => {
    if (!isUnpaid) return 0n;
    return estimateInterest(loan.principal, loan.openedAt);
  }, [isUnpaid, loan.principal, loan.openedAt]);

  const settlementAmount = loan.principal + interest;

  const principalLabel = isProcessing ? "Loading..." : isPaid && loan.principal === 0n ? "Paid" : `$${formatUSDC(loan.principal)}`;
  const interestLabel = isProcessing ? "—" : isPaid ? "$0.00" : `$${formatUSDC(interest)}`;
  const totalLabel = isProcessing ? "—" : isPaid ? "Paid" : `$${formatUSDC(settlementAmount)}`;

  async function handleRepay(e: React.MouseEvent) {
    e.stopPropagation();
    if (!isUnpaid || isBusy) return;
    await onRepay(item, settlementAmount);
  }

  async function handleRecover(e: React.MouseEvent) {
    e.stopPropagation();
    if (!isProcessing || isBusy || isRecovering) return;
    await onRecover(item);
  }

  if (compact) {
    return (
      <article
        onClick={() => setIsExpanded(!isExpanded)}
        className="rounded-md border border-black/10 bg-white p-3 transition-all opacity-70 hover:opacity-100 cursor-pointer hover:border-black/10 select-none"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-500">
              #{displayNumber}
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Loan {displayNumber}</p>
              <p className="text-[10px] text-muted-foreground">{formatDate(loan.openedAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {statusBadge(status)}
            <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
          </div>
        </div>
        {!isProcessing && (
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>Principal</span>
            <span className="font-mono font-medium text-foreground">{principalLabel}</span>
          </div>
        )}

        {/* Accordion expand-down transition */}
        <div
          className={`grid transition-all duration-300 ease-in-out ${
            isExpanded ? "grid-rows-[1fr] opacity-100 mt-2.5" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="rounded-md bg-slate-50 border border-black/10 p-2.5 text-[11px] space-y-1.5 text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-400">On-chain Loan ID</span>
                <span className="font-mono font-medium text-black">#{loan.loanId.toString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Start Date</span>
                <span className="text-black">{formatDate(loan.openedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status</span>
                <span className="text-emerald-700 font-semibold font-medium">Fully Settled</span>
              </div>
              <div className="pt-2 border-t border-black/10 text-[10px] text-slate-400 leading-normal">
                This loan has been fully repaid. All interest calculations are finalized, and the collateral has been released/adjusted.
              </div>
            </div>
          </div>
        </div>
      </article>
    );
  }

  // Full card for unpaid/processing loans
  return (
    <article
      onClick={() => setIsExpanded(!isExpanded)}
      className="rounded-md border border-black/10 bg-white p-5 shadow-none transition-all hover:border-black/10 cursor-pointer select-none"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-sm font-bold text-black">
            #{displayNumber}
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">Loan {displayNumber}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Opened {formatDate(loan.openedAt)}
              {loan.openedAt > 0n ? ` (${formatTimeSince(loan.openedAt)})` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {statusBadge(status)}
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
        </div>
      </div>

      {/* Metrics row */}
      <div className="mt-4 grid grid-cols-3 gap-2 rounded-md bg-slate-50 p-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Principal</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{principalLabel}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Est. Interest</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{interestLabel}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Total Due</p>
          <p className={`mt-1 text-sm font-semibold ${isPaid ? "text-slate-400" : "text-foreground"}`}>{totalLabel}</p>
        </div>
      </div>

      {isUnpaid && (
        <div className="mt-3 rounded-md border border-black/10 bg-slate-50 p-3 text-xs text-muted-foreground">
          <div className="flex justify-between gap-4">
            <span>Principal (cUSDC)</span>
            <span className="font-mono text-foreground">{formatUSDC(loan.principal)}</span>
          </div>
          <div className="flex justify-between gap-4 mt-1">
            <span>Estimated interest (8% APR)</span>
            <span className="font-mono text-foreground">{formatUSDC(interest)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-4 border-t border-black/10 pt-2 font-semibold text-foreground">
            <span>Amount to repay</span>
            <span className="font-mono">{formatUSDC(settlementAmount)} cUSDC</span>
          </div>
        </div>
      )}

      {isProcessing && (
        <p className="mt-3 text-xs text-slate-500">
          Loan details are finalizing on-chain. You can retry loading them now — this will not borrow again.
        </p>
      )}

      <div className="mt-4">
        {isUnpaid ? (
          <Button
            type="button"
            className="w-full rounded-md bg-black py-2 text-white hover:bg-slate-800"
            onClick={handleRepay}
            isLoading={isRepaying}
            loadingText="Repaying..."
            disabled={isBusy}
          >
            Repay ${formatUSDC(settlementAmount)} cUSDC
          </Button>
        ) : isProcessing ? (
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-md py-2"
            onClick={handleRecover}
            isLoading={isRecovering}
            loadingText="Loading details..."
            disabled={isBusy}
          >
            Retry loading details
          </Button>
        ) : null}
      </div>

      {/* Accordion details panel */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isExpanded ? "grid-rows-[1fr] opacity-100 mt-4" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="rounded-md bg-slate-50 border border-black/10 p-4 text-xs space-y-3 text-slate-600">
            <div className="grid grid-cols-2 gap-y-2">
              <span className="text-slate-400">On-chain Loan ID</span>
              <span className="text-right font-mono font-medium text-black">#{loan.loanId.toString()}</span>
              
              <span className="text-slate-400">Interest Calculation</span>
              <span className="text-right text-black">8.00% APR Compounding</span>

              <span className="text-slate-400">Start Date</span>
              <span className="text-right text-black">{formatDate(loan.openedAt)}</span>

              <span className="text-slate-400">Time Elapsed</span>
              <span className="text-right text-black font-medium text-black">
                {loan.openedAt > 0n ? formatTimeSince(loan.openedAt) : "N/A"}
              </span>

              <span className="text-slate-400">Privacy Status</span>
              <span className="text-right text-black font-medium">FHE Encrypted Debt</span>
            </div>
            
            <div className="pt-2.5 border-t border-black/10 text-[11px] text-slate-400 leading-normal">
              This loan is active on the Arbitrum Sepolia network. The debt value is encrypted on-chain via Fully Homomorphic Encryption (FHE). Interest accrues dynamically and is settled automatically upon repayment.
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function RepayPage() {
  const [repayingIndex, setRepayingIndex] = useState<number | null>(null);
  const [recoveringIndex, setRecoveringIndex] = useState<number | null>(null);
  const [showEncryptedDebt, setShowEncryptedDebt] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const protocol = useWalnutProtocol();

  const settlementPending = protocol.repaySettlementState === "settlement_pending";
  const pendingDecrypt = showEncryptedDebt && protocol.debtDecrypting;

  useEffect(() => {
    if (protocol.repaySettlementState === "settlement_processing") {
      setCountdown(70);
    } else {
      setCountdown(null);
    }
  }, [protocol.repaySettlementState]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      // Auto-sync loan structures once FHE settles
      void protocol.refetchActiveLoans();
      void protocol.refetchLoans();
      void protocol.refetchHasActiveLoan();
      setCountdown(null);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, protocol]);

  const loans = useMemo<LoanWithIndex[]>(() => {
    return protocol.allLoans.map((loan, loanIndex) => ({
      loan,
      loanIndex,
      displayNumber: loanIndex + 1,
      status: getLoanStatus(loan),
    }));
  }, [protocol.allLoans]);

  const unpaidLoans = useMemo(() => loans.filter((item) => item.status === "unpaid"), [loans]);
  const processingLoans = useMemo(() => loans.filter((item) => item.status === "processing"), [loans]);
  const paidLoans = useMemo(() => loans.filter((item) => item.status === "paid"), [loans]);
  const activeLoans = useMemo(() => [...unpaidLoans, ...processingLoans], [unpaidLoans, processingLoans]);

  const totalUnpaidPrincipal = useMemo(
    () => unpaidLoans.reduce((total, item) => total + item.loan.principal, 0n),
    [unpaidLoans]
  );
  const totalUnpaidDue = useMemo(
    () => unpaidLoans.reduce((total, item) => total + item.loan.principal + estimateInterest(item.loan.principal, item.loan.openedAt), 0n),
    [unpaidLoans]
  );

  const debtLabel = useMemo(() => {
    if (!protocol.canRead) return HIDDEN_VALUE;
    if (!showEncryptedDebt) return HIDDEN_VALUE;
    if (protocol.debtDecrypting) return "Loading...";
    if (typeof protocol.debt.decrypted.data === "bigint") return formatUSDC(protocol.debt.decrypted.data);
    return "0.00";
  }, [protocol.canRead, protocol.debt.decrypted.data, protocol.debtDecrypting, showEncryptedDebt]);

  async function handleRepay(item: LoanWithIndex, estimatedSettlementAmount: bigint) {
    if (repayingIndex !== null || settlementPending || estimatedSettlementAmount <= 0n) return;
    setRepayingIndex(item.loanIndex);
    try {
      const quote = await protocol.getLoanSettlementQuote(item.loan.principal, item.loan.openedAt);
      const settlementAmount = quote.repaymentAmount > estimatedSettlementAmount ? quote.repaymentAmount : estimatedSettlementAmount + 1n;
      const whole = settlementAmount / MICRO_USDC;
      const fraction = settlementAmount % MICRO_USDC;
      const amountStr = `${whole.toString()}.${fraction.toString().padStart(6, "0")}`;
      const success = await protocol.submitEncryptedAmount("repay", amountStr, undefined, item.loanIndex, quote);
      if (success) {
        void protocol.refetchActiveLoans();
        void protocol.refetchLoans();
        void protocol.refetchHasActiveLoan();
      }
    } finally {
      setRepayingIndex(null);
    }
  }

  async function handleRecover(item: LoanWithIndex) {
    if (recoveringIndex !== null || repayingIndex !== null || settlementPending) return;
    setRecoveringIndex(item.loanIndex);
    try {
      await protocol.recoverPendingLoanPrincipal(item.loanIndex, item.loan.loanId, item.loan.openedAt);
    } finally {
      setRecoveringIndex(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="pb-6 border-b border-black/10">
        <h1 className="text-3xl font-bold tracking-tight text-black">Repay Loans</h1>
        <p className="mt-2 text-sm text-slate-500 max-w-xl">
          Review active and paid loans. Repay any outstanding debt below.
        </p>
      </div>

      <ProtocolAlerts protocol={protocol} />

      <div className="grid gap-6 md:grid-cols-3 items-start">
        {/* Main Panel */}
        <section className="md:col-span-2">
          <div className="bg-white border border-black/10 rounded-md p-6 space-y-8 shadow-none">
            
            {/* Top Debt Summary */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-black border border-black/20 rounded-md p-5 space-y-5">
              <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                {/* Left: total debt */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full border border-white/20 bg-slate-800 flex items-center justify-center font-bold text-white shadow-sm text-[11px] tracking-wide">
                    cUSDC
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Total Outstanding Debt</p>
                    <p className="text-3xl font-bold tracking-tight text-white">
                      ${formatUSDC(totalUnpaidDue)}
                      <span className="ml-1.5 text-base font-normal text-slate-400">cUSDC</span>
                    </p>
                  </div>
                </div>

                {/* Right: decrypt button */}
                <div className="flex flex-col sm:items-end pt-1">
                  <Button
                    variant="outline"
                    className="bg-white/10 border-white/10 text-white hover:bg-white/20 hover:text-white font-medium rounded-md h-9 px-4 text-xs shadow-none inline-flex items-center gap-2 transition-colors"
                    onClick={async () => {
                      setShowEncryptedDebt((v) => !v);
                      if (!showEncryptedDebt && protocol.canRead) {
                        await protocol.debt.decrypted.refetch();
                      }
                    }}
                  >
                    {showEncryptedDebt ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {showEncryptedDebt ? "Hide Debt" : "Decrypt Debt"}
                  </Button>
                </div>
              </div>

              {/* Stats Row */}
              <div className="relative z-10 flex gap-6 text-sm pt-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Unpaid Loans</p>
                  <p className="font-bold text-white text-lg">{unpaidLoans.length}</p>
                </div>
                <div className="h-10 w-px bg-white/10" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Unpaid Principal</p>
                  <p className="font-bold text-white text-lg">${formatUSDC(totalUnpaidPrincipal)}</p>
                </div>
              </div>

              {/* Encrypted debt row */}
              <div className="relative z-10 flex items-center gap-3 rounded-md bg-black/40 border border-white/5 px-4 py-3">
                <DollarSign className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="text-xs font-medium text-slate-300">On-chain encrypted debt</span>
                <span className="ml-auto font-mono font-semibold text-white text-sm">
                  {pendingDecrypt ? (
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
                    </span>
                  ) : showEncryptedDebt && typeof protocol.debt.decrypted.data === "bigint" ? (
                    <span>{formatUSDC(protocol.debt.decrypted.data)} cUSDC</span>
                  ) : (
                    <span className="tracking-[0.25em] text-slate-400">•••••• cUSDC</span>
                  )}
                </span>
              </div>
            </div>

            {/* Active Loans List */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between ml-1">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Active Loans</h2>
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 border border-black/5">
                  {activeLoans.length}
                </span>
              </div>

              {activeLoans.length === 0 ? (
                <div className="rounded-md border border-black/5 bg-slate-50 p-6 text-center">
                  <CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-slate-400" />
                  <p className="text-sm font-semibold text-black">No active loans</p>
                  <p className="mt-1 text-xs text-slate-500">All loans are settled. Great work.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeLoans.map((item) => (
                    <LoanCard
                      key={`${item.loanIndex}-${item.loan.loanId.toString()}`}
                      item={item}
                      onRepay={handleRepay}
                      onRecover={handleRecover}
                      repayingIndex={repayingIndex}
                      recoveringIndex={recoveringIndex}
                      settlementPending={settlementPending}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Settlement History */}
            {(protocol.repayTxHash || protocol.settlementTxHash || protocol.repaySettlementState !== "idle") && (
              <div className="space-y-4 pt-2 border-t border-black/10 mt-6 pt-6">
                <div className="flex items-center justify-between ml-1">
                  <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Settlement History</h2>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {protocol.repayTxHash && (
                    <div className="rounded-md border border-black/10 bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Repayment Tx</p>
                      <a
                        className="mt-1 block font-mono text-xs text-black underline decoration-dotted hover:text-black"
                        href={`https://sepolia.arbiscan.io/tx/${protocol.repayTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {protocol.repayTxHash.slice(0, 10)}...{protocol.repayTxHash.slice(-8)}
                      </a>
                      <span className="mt-2 inline-flex items-center gap-1 rounded-md border border-black/10 bg-white px-2 py-0.5 text-[10px] text-slate-600">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Confirmed
                      </span>
                    </div>
                  )}

                  {protocol.settlementTxHash && (
                    <div className="rounded-md border border-black/10 bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Interest Settlement Tx</p>
                      <a
                        className="mt-1 block font-mono text-xs text-black underline decoration-dotted hover:text-black"
                        href={`https://sepolia.arbiscan.io/tx/${protocol.settlementTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {protocol.settlementTxHash.slice(0, 10)}...{protocol.settlementTxHash.slice(-8)}
                      </a>
                      <span className="mt-2 inline-flex items-center gap-1 rounded-md border border-black/10 bg-white px-2 py-0.5 text-[10px] text-slate-600">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Settled
                      </span>
                    </div>
                  )}
                </div>

                {/* Settlement state banners */}
                {protocol.repaySettlementState === "settlement_processing" && (
                  <div className="flex items-start gap-3 rounded-md border border-black/10 bg-slate-50 p-4">
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 animate-spin" />
                    <div>
                      <p className="text-xs font-semibold text-black">
                        {countdown !== null && countdown > 0 
                          ? `Settling interest on-chain... (will be paid in ${countdown}s)`
                          : "Interest settlement processing..."}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                        Your repayment succeeded. The interest settlement is confirming in the background. The dashboard will automatically update once finalized.
                      </p>
                    </div>
                  </div>
                )}

                {protocol.repaySettlementState === "settlement_confirmed" && (
                  <div className="flex items-start gap-3 rounded-md border border-black/10 bg-emerald-50 p-4">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div>
                      <p className="text-xs font-semibold text-emerald-800">Fully settled</p>
                      <p className="mt-1 text-[11px] text-emerald-600/80 leading-relaxed">
                        Repayment and interest settlement are both confirmed. The loan should now appear under Paid Loans.
                      </p>
                    </div>
                  </div>
                )}

                {protocol.repaySettlementState === "settlement_failed" && (
                  <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <div>
                      <p className="text-xs font-semibold text-red-800">Settlement failed</p>
                      <p className="mt-1 text-[11px] text-red-700/80 leading-relaxed">
                        {protocol.repaySettlementError ?? "The interest settlement encountered an error. Please retry."}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-3 bg-white text-black border-black/10 rounded-md shadow-none px-4 py-2 text-xs"
                        onClick={() => void protocol.retryRepaySettlement()}
                      >
                        Retry Settlement
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Sidebar */}
        <aside className="space-y-6">
          <div className="rounded-md bg-white border border-black/10 shadow-none">
            <div className="p-4 border-b border-black/10 flex items-center justify-between">
              <h4 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Paid Loans</h4>
              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 border border-black/5">
                {paidLoans.length}
              </span>
            </div>
            
            <div className="p-4 space-y-4">
              {paidLoans.length === 0 ? (
                <div className="text-center text-xs text-slate-500 py-2">
                  Paid loans will appear here after repayment.
                </div>
              ) : (
                <div className="space-y-2">
                  {paidLoans.map((item) => (
                    <LoanCard
                      key={`${item.loanIndex}-${item.loan.loanId.toString()}`}
                      item={item}
                      onRepay={handleRepay}
                      onRecover={handleRecover}
                      repayingIndex={repayingIndex}
                      recoveringIndex={recoveringIndex}
                      settlementPending={settlementPending}
                      compact
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
