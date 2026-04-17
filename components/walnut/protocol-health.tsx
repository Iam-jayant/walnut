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
  if (tone === "error") return "walnut-alert walnut-alert-danger text-destructive";
  if (tone === "warning") return "walnut-alert walnut-alert-warning text-foreground";
  return "walnut-alert text-muted-foreground";
}

export function ProtocolAlerts({ protocol }: ProtocolHealthProps) {
  const alerts: AlertItem[] = [];

  if (!protocol.isConnected) {
    alerts.push({ key: "wallet", message: "Connect your wallet to continue.", tone: "warning" });
  }

  if (protocol.isConnected && !protocol.isOnTargetChain) {
    alerts.push({ key: "network", message: "Wrong network. Please switch to Sepolia.", tone: "error" });
  }

  if (!protocol.canUseContract) {
    alerts.push({
      key: "contract",
      message: "Walnut is not configured right now. Please try again later.",
      tone: "error",
    });
  }

  if (protocol.permit.isPermitInitializing) {
    alerts.push({ key: "permit-init", message: "Preparing secure access...", tone: "info" });
  }

  if (!protocol.permit.isPermitInitializing && !protocol.permit.hasPermit) {
    alerts.push({ key: "permit-missing", message: "Private access is not enabled yet.", tone: "warning" });
  }

  if (protocol.permit.permitError) {
    alerts.push({
      key: "permit-error",
      message: "Could not enable private access. Please try again.",
      tone: "error",
    });
  }

  if (protocol.hasDecryptPending) {
    alerts.push({ key: "decrypting", message: "Loading balances...", tone: "info" });
  }

  if (protocol.hasDecryptError) {
    alerts.push({ key: "decrypt-error", message: "Could not load balances. Refresh and try again.", tone: "error" });
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
    <GlassPanel className="walnut-card">
      <p className="walnut-label">Status</p>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <p className={`walnut-progress ${statusClass(protocol.isConnected)}`}>
          Wallet: {statusLabel(protocol.isConnected, "Connected", "Disconnected")}
        </p>
        <p className={`walnut-progress ${statusClass(protocol.isOnTargetChain)}`}>
          Network: {statusLabel(protocol.isOnTargetChain, "Sepolia", "Wrong network")}
        </p>
        <p className={`walnut-progress ${statusClass(protocol.permit.hasPermit && protocol.permit.isPermitValid)}`}>
          Private Access: {statusLabel(protocol.permit.hasPermit && protocol.permit.isPermitValid, "Ready", "Not ready")}
        </p>
      </div>
    </GlassPanel>
  );
}
