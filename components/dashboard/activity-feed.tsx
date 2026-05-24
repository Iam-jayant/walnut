"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink } from "lucide-react";
import { walnutContractAddress } from "@/lib/walnut-contract";

interface ActivityEvent {
  type: "Deposited" | "Borrowed" | "RepaymentSettlementIntent" | "Withdrawn";
  timestamp: number;
  txHash: string;
  blockNumber: number;
  amount?: string;
}

export function ActivityFeed() {
  const { address } = useAccount();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setEvents([]);
      setLoading(false);
      return;
    }

    // TODO: Implement event fetching using wagmi's useWatchContractEvent or getLogs
    // For now, show empty state
    setLoading(false);
  }, [address]);

  if (loading) {
    return (
      <div className="rounded-lg border border-walnut-border bg-walnut-card p-6">
        <h3 className="text-lg font-semibold text-walnut-text mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-walnut-muted" />
              <div className="flex-1 h-4 bg-walnut-muted rounded" />
              <div className="w-20 h-4 bg-walnut-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-walnut-border bg-walnut-card p-6">
        <h3 className="text-lg font-semibold text-walnut-text mb-4">Recent Activity</h3>
        <div className="text-center py-8 text-walnut-muted">
          <p>No activity yet</p>
          <p className="text-sm mt-1">Your transactions will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-walnut-border bg-walnut-card p-6">
      <h3 className="text-lg font-semibold text-walnut-text mb-4">Recent Activity</h3>
      <div className="space-y-3">
        {events.map((event, index) => (
          <ActivityRow key={`${event.txHash}-${index}`} event={event} />
        ))}
      </div>
    </div>
  );
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const dotColor = getDotColor(event.type);
  const label = getEventLabel(event.type);

  return (
    <div className="flex items-center gap-3 py-2 hover:bg-walnut-hover rounded-lg px-2 -mx-2 transition-colors">
      <div className={`w-2 h-2 rounded-full ${dotColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-walnut-text">{label}</span>
          {event.amount && (
            <span className="text-xs text-walnut-muted">••••</span>
          )}
        </div>
        <div className="text-xs text-walnut-muted">
          {formatDistanceToNow(event.timestamp * 1000, { addSuffix: true })}
        </div>
      </div>
      <a
        href={`https://sepolia.arbiscan.io/tx/${event.txHash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-walnut-accent hover:text-walnut-accent-hover transition-colors"
        title="View on Arbiscan"
      >
        <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  );
}

function getDotColor(type: ActivityEvent["type"]): string {
  switch (type) {
    case "Deposited":
    case "Borrowed":
      return "bg-green-500";
    case "Withdrawn":
    case "RepaymentSettlementIntent":
      return "bg-red-500";
    default:
      return "bg-walnut-muted";
  }
}

function getEventLabel(type: ActivityEvent["type"]): string {
  switch (type) {
    case "Deposited":
      return "Deposited";
    case "Borrowed":
      return "Borrowed";
    case "RepaymentSettlementIntent":
      return "Repayment";
    case "Withdrawn":
      return "Withdrawn";
    default:
      return type;
  }
}
