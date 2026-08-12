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
      return {
        title: "Collateral Deposited",
        description: "Your FHE-encrypted collateral deposit request was submitted on-chain.",
        icon: Coins,
        colorClass: "bg-emerald-50 text-emerald-600 border-emerald-200/50",
        badge: "Deposit"
      };
    case "DepositSyncRequested":
      return {
        title: "Deposit Sync",
        description: "Intermediate FHE state sync for deposit.",
        icon: Activity,
        colorClass: "bg-slate-50 text-slate-600 border-slate-200/50",
        badge: "System"
      };
    case "LoanOpened":
      return {
        title: "Principal Loan Borrowed",
        description: "Your FHE encrypted borrow request completed successfully.",
        icon: Coins,
        colorClass: "bg-blue-50 text-blue-600 border-blue-200/50",
        badge: "Borrow"
      };
    case "BorrowActiveSyncRequested":
      return {
        title: "Borrow Sync",
        description: "Intermediate FHE state sync for borrow.",
        icon: Activity,
        colorClass: "bg-slate-50 text-slate-600 border-slate-200/50",
        badge: "System"
      };
    case "LoanRepaid":
    case "RepaymentSettlementIntent":
      return {
        title: "Encrypted Loan Repayment",
        description: "Your repayment transaction was processed and submitted to the FHE enclave.",
        icon: Receipt,
        colorClass: "bg-emerald-50 text-emerald-600 border-emerald-200/50",
        badge: "Repay"
      };
    case "RepayStateSyncRequested":
      return {
        title: "Repay Sync",
        description: "Intermediate FHE state sync for repay.",
        icon: Activity,
        colorClass: "bg-slate-50 text-slate-600 border-slate-200/50",
        badge: "System"
      };
    case "Withdrawn":
      return {
        title: "Collateral Withdrawn",
        description: "Your collateral withdrawal request was submitted on-chain.",
        icon: ArrowLeftRight,
        colorClass: "bg-amber-50 text-amber-600 border-amber-200/50",
        badge: "Withdraw"
      };
    case "WithdrawSyncRequested":
      return {
        title: "Withdraw Sync",
        description: "Intermediate FHE state sync for withdraw.",
        icon: Activity,
        colorClass: "bg-slate-50 text-slate-600 border-slate-200/50",
        badge: "System"
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
        badge: "System"
      };
  }
}

const TABS = ["All", "Deposits", "Borrows", "Repayments", "Withdraws"];

export default function HistoryPage() {
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("All");

  const historyRows = useMemo(() => {
    return [...items]
      .filter((item) => {
        const meta = getEventMeta(item.eventName);
        if (activeTab === "All") return meta.badge !== "System"; // Hide system events in All
        if (activeTab === "Deposits") return meta.badge === "Deposit";
        if (activeTab === "Borrows") return meta.badge === "Borrow";
        if (activeTab === "Repayments") return meta.badge === "Repay";
        if (activeTab === "Withdraws") return meta.badge === "Withdraw";
        return true;
      })
      .sort((a, b) => {
        if (a.blockNumber === b.blockNumber) return 0;
        return a.blockNumber > b.blockNumber ? -1 : 1;
      });
  }, [items, activeTab]);

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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Activity History</h1>
            <div className="group relative flex items-center justify-center">
              <HelpCircle className="h-5 w-5 text-muted-foreground hover:text-slate-900 cursor-help transition-colors" />
              <div className="absolute left-1/2 top-full mt-2 w-[340px] -translate-x-1/2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="rounded-xl border border-blue-100 bg-blue-50/95 backdrop-blur-sm p-4 text-xs leading-relaxed text-blue-800 shadow-xl relative">
                  <div className="absolute -top-[16px] left-1/2 -translate-x-1/2 border-[8px] border-transparent border-b-blue-100" />
                  <div className="absolute -top-[15px] left-1/2 -translate-x-1/2 border-[8px] border-transparent border-b-blue-50/95" />
                  <strong className="font-semibold block mb-1">How On-chain Activity works:</strong>
                  <p className="text-blue-700">
                    Because Walnut is a secure Fully Homomorphic Encryption (FHE) protocol, lending calculations are processed inside encrypted smart contract states. This table filters smart contract events linked directly to your wallet address.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time on-chain logs of your confidential lending activities.
          </p>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden min-h-[400px] flex flex-col">
        {/* Tabs */}
        <div className="flex items-center gap-2 bg-slate-50 border-b border-slate-200 p-3 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 border border-transparent"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1">
          {isLoading && items.length === 0 ? (
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
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">No {activeTab !== "All" ? activeTab : "Recent"} Activity</p>
              <p className="text-xs text-muted-foreground leading-normal">
                No verified logs matching this category were found for your wallet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="p-4 w-[280px]">Action</th>
                    <th className="p-4">Date & Time</th>
                    <th className="p-4 text-center">Block</th>
                    <th className="p-4 text-right">Transaction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyRows.map((item) => {
                    const meta = getEventMeta(item.eventName);
                    const IconComponent = meta.icon;

                    return (
                      <tr key={item.key} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${meta.colorClass}`}>
                              <IconComponent className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{meta.title}</p>
                              <p className="text-xs text-slate-500">{meta.badge} Event</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="text-sm text-slate-600 font-medium">
                            {formatTimestamp(item.timestamp)}
                          </p>
                        </td>
                        <td className="p-4 text-center">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-mono font-medium text-slate-600">
                            {item.blockNumber.toString()}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <a
                            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-mono transition"
                            href={`https://sepolia.arbiscan.io/tx/${item.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {shortHash(item.txHash)}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
