"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { decodeEventLog } from "viem";

import { GlassPanel } from "@/components/walnut/glass-panel";
import { walnutContractAddress, walnutV2Abi } from "@/lib/walnut-contract";

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
  return new Date(Number(timestamp) * 1000).toLocaleString();
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
                abi: walnutV2Abi,
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
    <div className="space-y-6">
      <GlassPanel className="walnut-hero">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">History</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Activity Timeline</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Recent protocol activity pulled from Walnut on-chain events.
        </p>
      </GlassPanel>

      <GlassPanel className="walnut-card">
        {isLoading && historyRows.length === 0 ? (
          <>
            <p className="walnut-label">Loading Activity</p>
            <p className="mt-2 text-sm text-muted-foreground">Fetching on-chain events...</p>
          </>
        ) : error ? (
          <>
            <p className="walnut-label">History Unavailable</p>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </>
        ) : historyRows.length === 0 ? (
          <>
            <p className="walnut-label">No Activity Yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              No recent Walnut events were found for the connected wallet.
            </p>
          </>
        ) : (
          <div className="space-y-2">
            <p className="walnut-label">Recent Activity</p>
            {historyRows.map((item) => (
              <div key={item.key} className="walnut-progress">
                <p className="text-sm font-medium text-foreground">{item.eventName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatTimestamp(item.timestamp)} · Block {item.blockNumber.toString()}
                </p>
                <a
                  className="mt-1 inline-block text-xs text-accent underline"
                  href={`https://sepolia.arbiscan.io/tx/${item.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortHash(item.txHash)}
                </a>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
