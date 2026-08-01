"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, Activity } from "lucide-react";
import { parseAbiItem } from "viem";
import { walnutContractAddress } from "@/lib/walnut-contract";

interface ActivityEvent {
  type: "Deposited" | "LoanOpened" | "Repay" | "Withdrawn" | "WithdrawFailed";
  timestamp: number;
  txHash: string;
  blockNumber: number;
  status: "success" | "failed";
}

export function ActivityFeed() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address || !publicClient) {
      setEvents([]);
      setLoading(false);
      return;
    }

    const fetchEvents = async () => {
      try {
        const latestBlock = await publicClient.getBlockNumber();
        const fromBlock = latestBlock > 250000n ? latestBlock - 250000n : 0n;

        const [depositLogs, withdrawLogs, withdrawFinalizedLogs, loanOpenedLogs, repayLogs] = await Promise.all([
          publicClient.getLogs({
            address: walnutContractAddress,
            event: parseAbiItem("event Deposited(address indexed user, address indexed token)"),
            args: { user: address },
            fromBlock,
            toBlock: "latest"
          }).catch(() => []),
          publicClient.getLogs({
            address: walnutContractAddress,
            event: parseAbiItem("event Withdrawn(address indexed user, address indexed token)"),
            args: { user: address },
            fromBlock,
            toBlock: "latest"
          }).catch(() => []),
          publicClient.getLogs({
            address: walnutContractAddress,
            event: parseAbiItem("event WithdrawFinalized(address indexed user, address indexed token, bool approved)"),
            args: { user: address },
            fromBlock,
            toBlock: "latest"
          }).catch(() => []),
          publicClient.getLogs({
            address: walnutContractAddress,
            event: parseAbiItem("event LoanOpened(address indexed user, uint256 loanId, uint256 openedAt)"),
            args: { user: address },
            fromBlock,
            toBlock: "latest"
          }).catch(() => []),
          publicClient.getLogs({
            address: walnutContractAddress,
            event: parseAbiItem("event RepaymentSettlementIntent(address indexed user, uint256 loanId)"),
            args: { user: address },
            fromBlock,
            toBlock: "latest"
          }).catch(() => [])
        ]);

        const failedWithdraws = withdrawFinalizedLogs
          .filter(l => l.args.approved === false)
          .map(l => ({ ...l, type: "WithdrawFailed" as const, status: "failed" as const }));

        const allLogs = [
          ...depositLogs.map(l => ({ ...l, type: "Deposited" as const, status: "success" as const })),
          ...withdrawLogs.map(l => ({ ...l, type: "Withdrawn" as const, status: "success" as const })),
          ...failedWithdraws,
          ...loanOpenedLogs.map(l => ({ ...l, type: "LoanOpened" as const, status: "success" as const })),
          ...repayLogs.map(l => ({ ...l, type: "Repay" as const, status: "success" as const }))
        ];

        allLogs.sort((a, b) => {
          if (b.blockNumber !== a.blockNumber) {
            return Number(b.blockNumber - a.blockNumber);
          }
          return Number((b.transactionIndex ?? 0) - (a.transactionIndex ?? 0));
        });

        const recentLogs = allLogs.slice(0, 10);

        const uniqueBlocks = Array.from(new Set(recentLogs.map(l => l.blockNumber)));
        const blockTimeMap: Record<string, number> = {};

        await Promise.all(
          uniqueBlocks.map(async (blockNum) => {
            try {
              const block = await publicClient.getBlock({ blockNumber: blockNum });
              blockTimeMap[blockNum.toString()] = Number(block.timestamp);
            } catch (e) {
              blockTimeMap[blockNum.toString()] = Math.floor(Date.now() / 1000);
            }
          })
        );

        const parsedEvents: ActivityEvent[] = recentLogs.map((log) => {
          return {
            type: log.type,
            timestamp: blockTimeMap[log.blockNumber.toString()] || Math.floor(Date.now() / 1000),
            txHash: log.transactionHash ?? "",
            blockNumber: Number(log.blockNumber),
            status: log.status
          };
        });

        setEvents(parsedEvents);
      } catch (err) {
        console.error("Failed to fetch activity logs:", err);
      } finally {
        setLoading(false);
      }
    };

    void fetchEvents();
    const id = setInterval(fetchEvents, 15000);
    return () => clearInterval(id);
  }, [address, publicClient]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-600 animate-pulse" />
          Recent Activity
        </h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-slate-200" />
              <div className="flex-1 h-4 bg-slate-100 rounded" />
              <div className="w-12 h-4 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-600" />
          Recent Activity
        </h3>
        <div className="text-center py-8 text-slate-500">
          <p className="text-xs font-semibold">No activity yet</p>
          <p className="text-[10px] mt-1">Your transactions will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4 text-slate-600" />
        Recent Activity
      </h3>
      <div className="space-y-3">
        {events.map((event, index) => (
          <ActivityRow key={`${event.txHash}-${index}`} event={event} />
        ))}
      </div>
    </div>
  );
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const dotColor = event.status === "failed" ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" : getDotColor(event.type);
  const label = event.status === "failed" ? `${getEventLabel(event.type)} (Failed)` : getEventLabel(event.type);

  return (
    <div className="flex items-center gap-3 py-2 hover:bg-slate-50/50 rounded-lg px-2 -mx-2 transition-colors">
      <div className={`w-2 h-2 rounded-full ${dotColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold ${event.status === "failed" ? "text-rose-600" : "text-slate-800"}`}>{label}</span>
          <span className="text-xs font-mono text-slate-600 font-semibold bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
            🔒 Encrypted
          </span>
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5">
          {formatDistanceToNow(event.timestamp * 1000, { addSuffix: true })}
        </div>
      </div>
      <a
        href={`https://sepolia.arbiscan.io/tx/${event.txHash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-slate-400 hover:text-black transition-colors"
        title="View on Arbiscan"
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

function getDotColor(type: ActivityEvent["type"]): string {
  switch (type) {
    case "Deposited":
      return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]";
    case "LoanOpened":
      return "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]";
    case "Withdrawn":
      return "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]";
    case "Repay":
      return "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]";
    case "WithdrawFailed":
      return "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]";
    default:
      return "bg-slate-400";
  }
}

function getEventLabel(type: ActivityEvent["type"]): string {
  switch (type) {
    case "Deposited":
      return "Deposited Collateral";
    case "LoanOpened":
      return "Borrowed Loan";
    case "Repay":
      return "Repaid Debt";
    case "Withdrawn":
      return "Withdrawn Collateral";
    case "WithdrawFailed":
      return "Withdrawal Failed";
    default:
      return type;
  }
}
