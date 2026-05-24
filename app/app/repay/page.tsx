"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProtocolAlerts } from "@/components/walnut/protocol-health";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";

const formatUSDC = (rawValue: bigint | number | string): string => {
  const num = typeof rawValue === "bigint" ? Number(rawValue) : Number(rawValue);
  return (num / 1_000_000).toFixed(2);
};

const parseUSDCInput = (value: string): bigint => {
  if (!value || !/^\d+(\.\d+)?$/.test(value)) return 0n;
  const [whole = "0", fraction = ""] = value.split(".");
  return BigInt(`${whole}${fraction.padEnd(6, "0").slice(0, 6)}`);
};

export default function RepayPage() {
  const [amount, setAmount] = useState("");
  const [showDecrypted, setShowDecrypted] = useState(false);
  const [repayInFlight, setRepayInFlight] = useState(false);
  const protocol = useWalnutProtocol();
  const settlementPending = protocol.repaySettlementState === "settlement_pending";

  const pendingRepay = repayInFlight || protocol.isEncrypting || settlementPending;
  const pendingDecrypt = showDecrypted && protocol.debtDecrypting;

  const currentDebt = useMemo(() => {
    if (typeof protocol.debt.decrypted.data === "bigint") return protocol.debt.decrypted.data;
    return 0n;
  }, [protocol.debt.decrypted.data]);

  const typedAmount = useMemo(() => {
    return parseUSDCInput(amount);
  }, [amount]);

  const postRepayDebt = useMemo(() => {
    if (typedAmount >= currentDebt) return 0n;
    return currentDebt - typedAmount;
  }, [currentDebt, typedAmount]);

  const hasKnownDebt = showDecrypted && typeof protocol.debt.decrypted.data === "bigint";
  const isOverRepay = hasKnownDebt && typedAmount > currentDebt;

  const debtLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return "******";
    if (protocol.debtDecrypting) return "Loading...";
    if (typeof protocol.debt.decrypted.data === "bigint") {
      return formatUSDC(protocol.debt.decrypted.data);
    }
    return "0.00";
  }, [protocol.canRead, protocol.debt.decrypted.data, protocol.debtDecrypting, showDecrypted]);

  async function handleRepay() {
    if (pendingRepay || !amount) return;
    if (isOverRepay) return;

    setRepayInFlight(true);
    try {
      const success = await protocol.submitEncryptedAmount("repay", amount);

      if (success) {
        setAmount("");
      }
    } finally {
      setRepayInFlight(false);
    }
  }

  const projectedDebtLabel = useMemo(() => {
    if (!protocol.canRead || !showDecrypted) return "******";
    if (protocol.debtDecrypting) return "Loading...";
    return formatUSDC(postRepayDebt);
  }, [postRepayDebt, protocol.canRead, protocol.debtDecrypting, showDecrypted]);

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Repay Your Balance</h1>
        <p className="text-sm text-muted-foreground">
          Submit encrypted principal repayment and monitor status in one place.
        </p>
      </header>

      <ProtocolAlerts protocol={protocol} />

      <div className="border rounded-lg p-4">
        <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Repay Studio</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Complete principal repayment and private interest settlement in one flow.
                </p>
              </div>
              <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-700">
                Encrypted
              </div>
            </div>

            <div>
              <label htmlFor="repay-amount" className="mb-2 block text-sm text-foreground">
                Repay Amount
              </label>
              <Input
                id="repay-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className="h-12 border-black/10 bg-white text-lg text-foreground placeholder:text-muted-foreground/80"
              />
            </div>

          <div className="flex flex-wrap gap-2">
            {[
              { label: "50", value: "50" },
              { label: "100", value: "100" },
              { label: "250", value: "250" },
              { label: "500", value: "500" },
            ].map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant="outline"
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-foreground"
                onClick={() => setAmount(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Repayment Progress</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${
                    protocol.repaySettlementState === "repay_pending"
                      ? "bg-accent animate-pulse"
                      : protocol.repaySettlementState === "repay_confirmed" ||
                        protocol.repaySettlementState === "settlement_pending" ||
                        protocol.repaySettlementState === "settlement_confirmed"
                      ? "bg-emerald-500"
                      : "bg-muted"
                  }`}
                />
                <p className="text-sm text-foreground">
                  Step 1: Repay principal on-chain
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${
                    protocol.repaySettlementState === "settlement_pending"
                      ? "bg-accent animate-pulse"
                      : protocol.repaySettlementState === "settlement_confirmed"
                      ? "bg-emerald-500"
                      : protocol.repaySettlementState === "settlement_failed"
                      ? "bg-red-500"
                      : "bg-muted"
                  }`}
                />
                <p className="text-sm text-muted-foreground">Step 2: Private interest settlement</p>
              </div>
            </div>
          </div>

          {(protocol.repayTxHash || protocol.settlementTxHash) && (
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Transaction Hashes</p>
              <div className="mt-3 space-y-3 text-sm">
                {protocol.repayTxHash && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Repay transaction</p>
                    <a
                      className="text-accent underline"
                      href={`https://sepolia.arbiscan.io/tx/${protocol.repayTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {protocol.repayTxHash.slice(0, 10)}...{protocol.repayTxHash.slice(-8)}
                    </a>
                  </div>
                )}
                {protocol.settlementTxHash ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Interest settlement via Privara</p>
                    <a
                      className="text-accent underline"
                      href={`https://sepolia.arbiscan.io/tx/${protocol.settlementTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {protocol.settlementTxHash.slice(0, 10)}...{protocol.settlementTxHash.slice(-8)}
                    </a>
                    <p className="text-xs text-muted-foreground mt-1">Interest settled privately. Amount encrypted.</p>
                  </div>
                ) : protocol.repayTxHash && (
                  <div>
                    <p className="text-xs text-muted-foreground">No interest settlement (loan duration &lt; 60 seconds)</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!protocol.permit.hasPermit && (
              <Button
                variant="outline"
                className="px-4 py-2 rounded-xl border border-slate-200"
                onClick={protocol.permit.requestPermitCreation}
                isLoading={protocol.permit.isPermitInitializing}
                loadingText="Enabling..."
              >
                Enable Private Access
              </Button>
            )}
            <Button
              className="rounded-xl bg-black px-4 py-2 text-white hover:bg-slate-900"
              onClick={handleRepay}
              isLoading={pendingRepay}
              loadingText={
                protocol.isEncrypting
                  ? "Encrypting..."
                  : settlementPending
                  ? "Settling..."
                  : "Repaying..."
              }
              disabled={!amount || pendingRepay || isOverRepay}
            >
              Repay
            </Button>
            {protocol.repaySettlementState === "settlement_failed" && (
              <Button
                variant="outline"
                className="px-4 py-2 rounded-xl border border-slate-200"
                onClick={() => void protocol.retryRepaySettlement()}
              >
                Retry Private Settlement
              </Button>
            )}
            <Button
              variant="outline"
              className="px-4 py-2 rounded-xl"
              onClick={() => setShowDecrypted((value) => !value)}
              isLoading={pendingDecrypt}
              loadingText="Decrypting..."
            >
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <span className="inline-flex h-4 w-4 items-center justify-center">
                  {showDecrypted ? (
                    <EyeOff className="h-4 w-4 transition-all duration-200 ease-out rotate-0 scale-100" />
                  ) : (
                    <Eye className="h-4 w-4 transition-all duration-200 ease-out scale-100" />
                  )}
                </span>
                <span>{showDecrypted ? "Hide Debt" : "Show Debt"}</span>
              </span>
            </Button>
          </div>
        </section>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Outstanding Debt</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{debtLabel}</p>
            <p className="mt-1 text-sm text-muted-foreground">Current principal balance</p>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Projected Debt</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{projectedDebtLabel}</p>
            <p className="mt-1 text-sm text-muted-foreground">Estimated debt after this repayment confirms</p>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Status</p>
            <p className="mt-2 text-sm text-foreground">
              {isOverRepay
                ? "Repay amount cannot be greater than current debt."
                : protocol.repaySettlementState === "settlement_failed"
                ? protocol.repaySettlementError ?? "Repay succeeded, but private settlement failed."
                : protocol.repaySettlementState === "settlement_pending"
                ? "Repay confirmed. Waiting for private settlement confirmation..."
                : protocol.repaySettlementState === "settlement_confirmed"
                ? "Repay and private settlement both confirmed."
                : pendingRepay
                ? "Repayment transaction in progress..."
                : "Ready to submit principal repayment."}
            </p>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
