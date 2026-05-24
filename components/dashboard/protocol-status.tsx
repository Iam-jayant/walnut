"use client";

import { useAccount, useBlockNumber } from "wagmi";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";
import { walnutChainId } from "@/lib/walnut-contract";

export function ProtocolStatus() {
  const { address, isConnected, chain } = useAccount();
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const protocol = useWalnutProtocol();

  const walletStatus = isConnected ? "connected" : "disconnected";
  const networkStatus = chain?.id === walnutChainId ? "correct" : "wrong";
  const permitStatus = protocol.permit.hasPermit ? "ready" : protocol.permit.isPermitInitializing ? "loading" : "none";
  const oracleStatus = "operational"; // TODO: Add oracle health check
  const encryptionStatus = "operational"; // TODO: Add CoFHE health check

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-walnut-card border-t border-walnut-border px-4 py-2 z-40">
      <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
        <div className="flex items-center gap-6">
          <StatusItem
            label="Wallet"
            status={walletStatus === "connected" ? "good" : "bad"}
            value={address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected"}
          />
          <StatusItem
            label="Network"
            status={networkStatus === "correct" ? "good" : "bad"}
            value={chain?.name || "Unknown"}
          />
          <StatusItem
            label="Private Access"
            status={permitStatus === "ready" ? "good" : permitStatus === "loading" ? "warn" : "bad"}
            value={permitStatus === "ready" ? "Active" : permitStatus === "loading" ? "Loading" : "None"}
          />
          <StatusItem
            label="Oracle"
            status={oracleStatus === "operational" ? "good" : "bad"}
            value="Chainlink"
          />
          <StatusItem
            label="Encryption"
            status={encryptionStatus === "operational" ? "good" : "bad"}
            value="CoFHE"
          />
        </div>
        {blockNumber && (
          <div className="text-walnut-muted">
            Block: {blockNumber.toString()}
          </div>
        )}
      </div>
    </div>
  );
}

interface StatusItemProps {
  label: string;
  status: "good" | "warn" | "bad";
  value: string;
}

function StatusItem({ label, status, value }: StatusItemProps) {
  const dotColor =
    status === "good"
      ? "bg-green-500"
      : status === "warn"
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${dotColor}`} />
      <span className="text-walnut-muted">{label}:</span>
      <span className="text-walnut-text font-medium">{value}</span>
    </div>
  );
}
