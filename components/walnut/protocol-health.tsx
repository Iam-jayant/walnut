"use client";

import { GlassPanel } from "@/components/walnut/glass-panel";
import type { WalnutProtocolState } from "@/hooks/use-walnut-protocol";

type ProtocolHealthProps = {
  protocol: WalnutProtocolState;
};

type AlertItem = {
  key: string;
  message: string;
  tone: "error" | "warning" | "info";
};

function toneToClassName(tone: AlertItem["tone"]) {
  if (tone === "error") return "border-destructive/50 text-destructive";
  if (tone === "warning") return "border-amber-300/40 text-foreground";
  return "border-black/10 text-muted-foreground";
}

export function ProtocolAlerts({ protocol }: ProtocolHealthProps) {
  const alerts: AlertItem[] = [];

  if (!protocol.isConnected) {
    alerts.push({ key: "wallet", message: "Connect wallet to use Walnut private actions.", tone: "warning" });
  }

  if (protocol.isConnected && !protocol.isOnTargetChain) {
    alerts.push({ key: "network", message: "Wrong network. Switch to Sepolia.", tone: "error" });
  }

  if (!protocol.canUseContract) {
    alerts.push({
      key: "contract",
      message: "Contract address missing. Set NEXT_PUBLIC_WALNUT_CONTRACT_ADDRESS.",
      tone: "error",
    });
  }

  if (protocol.permit.isPermitInitializing) {
    alerts.push({ key: "permit-init", message: "Creating private access permit...", tone: "info" });
  }

  if (!protocol.permit.isPermitInitializing && !protocol.permit.hasPermit) {
    alerts.push({ key: "permit-missing", message: "Private access not enabled.", tone: "warning" });
  }

  if (protocol.permit.permitError) {
    alerts.push({
      key: "permit-error",
      message: `Permit creation failed. Try again. (${protocol.permit.permitError})`,
      tone: "error",
    });
  }

  if (protocol.hasDecryptPending) {
    alerts.push({ key: "decrypting", message: "Decrypting balances...", tone: "info" });
  }

  if (protocol.hasDecryptError) {
    alerts.push({ key: "decrypt-error", message: "Decrypt failed. Refresh or recreate permit.", tone: "error" });
  }

  if (!alerts.length) return null;

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <GlassPanel key={alert.key} className={toneToClassName(alert.tone)}>
          <p className="text-sm">{alert.message}</p>
        </GlassPanel>
      ))}
    </div>
  );
}

function statusLabel(ok: boolean, okText: string, badText: string) {
  return ok ? okText : badText;
}

function statusClass(ok: boolean) {
  return ok ? "text-emerald-700" : "text-amber-700";
}

export function SystemStatusPanel({ protocol }: ProtocolHealthProps) {
  return (
    <GlassPanel>
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">System Status</p>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <p className={statusClass(protocol.isConnected)}>
          Wallet: {statusLabel(protocol.isConnected, "Connected", "Disconnected")}
        </p>
        <p className={statusClass(protocol.isOnTargetChain)}>
          Network: {statusLabel(protocol.isOnTargetChain, "Sepolia", "Wrong network")}
        </p>
        <p className={statusClass(protocol.permit.hasPermit && protocol.permit.isPermitValid)}>
          Permit: {statusLabel(protocol.permit.hasPermit && protocol.permit.isPermitValid, "Ready", "Missing or invalid")}
        </p>
        <p className={statusClass(protocol.contractReachable)}>
          Contract: {statusLabel(protocol.contractReachable, "Reachable", "Unavailable")}
        </p>
      </div>
    </GlassPanel>
  );
}
