"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { decodeEventLog } from "viem";
import { Coins, Receipt, ArrowLeftRight, Clock, ExternalLink, HelpCircle, Activity, ShieldAlert, Sparkles, CheckCircle2 } from "lucide-react";

import { walnutContractAddress, walnutLendingAbi } from "@/lib/walnut-contract";

const HISTORY_BLOCK_WINDOW = 120_000n;

type HistoryItem = {
  key: string;
  eventName: string;
  txHash: `0x${string}`;
  blockNumber: bigint;
  timestamp?: bigint;
};

function shortHash(hash: string) {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function formatTimestamp(timestamp: bigint | undefined) {
  if (!timestamp) return "Unknown time";
  return new Date(Number(timestamp) * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function getEventMeta(eventName: string) {
  switch (eventName) {
    case "Deposited":
    case "DepositSyncRequested":
      return {
        title: "Collateral Deposited",
        description: "Your FHE-encrypted collateral deposit request was submitted on-chain.",
        icon: Coins,
        colorClass: "bg-emerald-50 text-emerald-600 border-emerald-200/50",
        badge: "Deposit"
      };
    case "BorrowActiveSyncRequested":
    case "LoanOpened":
      return {
        title: "Principal Loan Borrowed",
        description: "Your FHE encrypted borrow request completed successfully.",
        icon: Coins,
        colorClass: "bg-blue-50 text-blue-600 border-blue-200/50",
        badge: "Borrow"
      };
    case "RepayStateSyncRequested":
    case "LoanRepaid":
    case "RepaymentSettlementIntent":
      return {
        title: "Encrypted Loan Repayment",
        description: "Your repayment transaction was processed and submitted to the FHE enclave.",
        icon: Receipt,
        colorClass: "bg-emerald-50 text-emerald-600 border-emerald-200/50",
        badge: "Repay"
      };
    case "Withdrawn":
    case "WithdrawSyncRequested":
      return {
        title: "Collateral Withdrawn",
        description: "Your collateral withdrawal request was submitted on-chain.",
        icon: ArrowLeftRight,
        colorClass: "bg-amber-50 text-amber-600 border-amber-200/50",
        badge: "Withdraw"
      };
    case "CreditCountSyncRequested":
    case "CreditTierUpdated":
      return {
        title: "Credit Reputation Synced",
        description: "Your confidential credit score tier was updated on-chain.",
        icon: Sparkles,
        colorClass: "bg-purple-50 text-purple-600 border-purple-200/50",
        badge: "Credit"
      };
    case "LoanRepayFailed":
    case "BorrowCancelled":
      return {
        title: "Operation Failed",
        description: "On-chain operation failed to settle or was cancelled.",
        icon: ShieldAlert,
        colorClass: "bg-rose-50 text-rose-600 border-rose-200/50",
        badge: "Failed"
      };
    default:
      return {
        title: eventName,
        description: "On-chain smart contract state sync transaction finalized.",
        icon: Sparkles,
        colorClass: "bg-slate-50 text-slate-600 border-slate-200/50",
        badge: "Event"
      };
  }
}

export default function HistoryPage() {
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const historyRows = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (a.blockNumber === b.blockNumber) return 0;
        return a.blockNumber > b.blockNumber ? -1 : 1;
      }),
    [items]
  );

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      if (!publicClient || !address) {
        if (active) setItems([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const latestBlock = await publicClient.getBlockNumber();
        const fromBlock = latestBlock > HISTORY_BLOCK_WINDOW ? latestBlock - HISTORY_BLOCK_WINDOW : 0n;
        const logs = await publicClient.getLogs({
          address: walnutContractAddress,
          fromBlock,
          toBlock: latestBlock,
        });

        const relevant = logs
          .map((log) => {
            try {
              const decoded = decodeEventLog({
                abi: walnutLendingAbi,
                data: log.data,
                topics: log.topics,
              });

              const rawArgs = decoded.args;
              const watchAddress = address.toLowerCase();
              const argValues = Array.isArray(rawArgs)
                ? rawArgs
                : rawArgs
                ? Object.values(rawArgs)
                : [];
              const participantValues = argValues
                .filter((value): value is string => typeof value === "string" && value.startsWith("0x"))
                .map((value) => value.toLowerCase());

              if (!participantValues.includes(watchAddress)) return null;

              return {
                key: `${log.transactionHash}-${log.logIndex?.toString() ?? "0"}`,
                eventName: decoded.eventName ?? "UnknownEvent",
                txHash: log.transactionHash,
                blockNumber: log.blockNumber,
              } satisfies HistoryItem;
            } catch {
              return null;
            }
          })
          .filter((item): item is HistoryItem => item !== null);

        const uniqueBlocks = [...new Set(relevant.map((item) => item.blockNumber.toString()))];
        const blockTimestampMap = new Map<string, bigint>();

        await Promise.all(
          uniqueBlocks.map(async (blockNumberString) => {
            const block = await publicClient.getBlock({ blockNumber: BigInt(blockNumberString) });
            blockTimestampMap.set(blockNumberString, block.timestamp);
          })
        );

        const enriched = relevant.map((item) => ({
          ...item,
          timestamp: blockTimestampMap.get(item.blockNumber.toString()),
        }));

        if (!active) return;
        setItems(enriched);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load history.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadHistory();
    const id = window.setInterval(() => {
      void loadHistory();
    }, 30_000);

    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [address, publicClient]);

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Activity Timeline</h1>
            <div className="group relative flex items-center justify-center">
              <HelpCircle className="h-5 w-5 text-muted-foreground hover:text-slate-900 cursor-help transition-colors" />
              <div className="absolute left-1/2 top-full mt-2 w-[340px] -translate-x-1/2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="rounded-xl border border-blue-100 bg-blue-50/95 backdrop-blur-sm p-4 text-xs leading-relaxed text-blue-800 shadow-xl relative">
                  <div className="absolute -top-[16px] left-1/2 -translate-x-1/2 border-[8px] border-transparent border-b-blue-100" />
                  <div className="absolute -top-[15px] left-1/2 -translate-x-1/2 border-[8px] border-transparent border-b-blue-50/95" />
                  <strong className="font-semibold block mb-1">How On-chain Activity works:</strong>
                  <p className="text-blue-700">
                    Because Walnut is a secure Fully Homomorphic Encryption (FHE) protocol, lending calculations are processed inside encrypted smart contract states. The timeline below monitors the Arbitrum Sepolia network event logs for cryptographic syncing actions (`BorrowActiveSyncRequested`, `RepayStateSyncRequested`, etc.) linked specifically to your wallet address.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time on-chain history and state sync timelines triggered by your encrypted lending actions.
          </p>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="border border-slate-200 rounded-2xl bg-white p-6 shadow-sm min-h-[400px] flex flex-col justify-between">
        {isLoading && historyRows.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <Clock className="h-10 w-10 text-slate-400 animate-spin" />
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Loading Activity</p>
            <p className="text-xs text-muted-foreground">Fetching verified smart contract events from block logs...</p>
          </div>
        ) : error ? (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-3 max-w-sm mx-auto">
            <ShieldAlert className="h-10 w-10 text-rose-500" />
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-rose-500">History Unavailable</p>
            <p className="text-xs text-muted-foreground leading-normal">{error}</p>
          </div>
        ) : historyRows.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-3 max-w-sm mx-auto">
            <CheckCircle2 className="h-10 w-10 text-slate-300" />
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">No Recent Activity</p>
            <p className="text-xs text-muted-foreground leading-normal">
              No recent lending or borrowing event logs were found for the connected wallet on-chain.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400 border-b border-slate-100 pb-2">Recent Transactions</h3>
            
            {/* Dotted Timeline track */}
            <div className="relative pl-6 border-l-2 border-dashed border-slate-100 ml-4 space-y-6">
              {historyRows.map((item) => {
                const meta = getEventMeta(item.eventName);
                const IconComponent = meta.icon;

                return (
                  <div key={item.key} className="relative group">
                    {/* Timeline Dot Anchor */}
                    <div className={`absolute -left-[37px] top-0.5 flex h-7 w-7 items-center justify-center rounded-full border bg-white shadow-sm transition group-hover:scale-105 ${meta.colorClass}`}>
                      <IconComponent className="h-3.5 w-3.5" />
                    </div>

                    {/* Timeline Event Card */}
                    <div className="rounded-2xl border border-slate-150 bg-white p-4 shadow-sm hover:border-slate-300 transition-all space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900">{meta.title}</p>
                          <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[9px] font-semibold text-slate-500 uppercase tracking-wider border border-slate-100">
                            {meta.badge}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono bg-slate-50 border px-1.5 py-0.5 rounded-md self-start sm:self-auto">
                          Block #{item.blockNumber.toString()}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground leading-normal">
                        {meta.description}
                      </p>

                      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <p className="text-[10px] text-slate-400 font-mono">
                          Timestamp: {formatTimestamp(item.timestamp)}
                        </p>
                        <a
                          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-black font-mono underline decoration-dotted transition"
                          href={`https://sepolia.arbiscan.io/tx/${item.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {shortHash(item.txHash)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
