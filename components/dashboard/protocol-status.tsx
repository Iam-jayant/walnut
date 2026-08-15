"use client";

import { useAccount, useBlockNumber } from "wagmi";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";
import { walnutChainId } from "@/lib/walnut-contract";

export function ProtocolStatus() {
  const { isConnected, chain } = useAccount();
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const protocol = useWalnutProtocol();

  const walletStatus = isConnected ? "connected" : "disconnected";
  const networkStatus = chain?.id === walnutChainId ? "correct" : "wrong";
  const permitStatus = protocol.permit.hasPermit ? "ready" : protocol.permit.isPermitInitializing ? "loading" : "none";
  
  const isHealthy = isConnected && chain?.id === walnutChainId;
  const oracleStatus = !isHealthy 
    ? "operational" 
    : protocol.currentBorrowRate === 0n && protocol.utilizationRate === 0n && !protocol.currentBorrowRateLoading
    ? "degraded"
    : "operational";

  const encryptionStatus = !isHealthy 
    ? "operational" 
    : protocol.hasDecryptError 
    ? "degraded" 
    : "operational";

  const showSidebar = isConnected && protocol.permit.hasPermit;

  return (
    <div className="fixed bottom-0 left-64 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-8 py-2.5 z-40 transition-all duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
        <div className="flex flex-wrap items-center gap-6">
          <StatusItem
            label="Wallet"
            status={walletStatus === "connected" ? "good" : "bad"}
            value={protocol.account.address ? `${protocol.account.address.slice(0, 6)}...${protocol.account.address.slice(-4)}` : "Disconnected"}
          />
          <StatusItem
            label="Network"
            status={networkStatus === "correct" ? "good" : "bad"}
            value={chain?.name || "Unsupported Network"}
          />
          <StatusItem
            label="Private Access"
            status={permitStatus === "ready" ? "good" : permitStatus === "loading" ? "warn" : "bad"}
            value={permitStatus === "ready" ? "Active" : permitStatus === "loading" ? "Loading" : "None"}
          />
          <StatusItem
            label="Oracle"
            status={oracleStatus === "operational" ? "good" : "warn"}
            value={oracleStatus === "operational" ? "Chainlink (Live)" : "Chainlink (Degraded)"}
          />
          <StatusItem
            label="Encryption"
            status={encryptionStatus === "operational" ? "good" : "warn"}
            value={encryptionStatus === "operational" ? "CoFHE (Active)" : "CoFHE (Stalled)"}
          />
        </div>
        {blockNumber && (
          <div className="text-slate-400 font-mono text-[10px] hidden sm:block">
            Block: #{blockNumber.toString()}
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
      ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
      : status === "warn"
      ? "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]"
      : "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]";

  return (
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span className="text-slate-500 font-medium">{label}:</span>
      <span className="text-slate-800 font-semibold">{value}</span>
    </div>
  );
}
