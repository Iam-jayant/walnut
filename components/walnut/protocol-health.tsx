"use client";

import { Globe, ShieldCheck, Wallet } from "lucide-react";

import { GlassPanel } from "@/components/walnut/glass-panel";
import type { WalnutProtocolState } from "@/hooks/use-walnut-protocol";
import { wagmiConfig } from "@/lib/web3-config";
import { walnutChainId } from "@/lib/walnut-contract";

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

const targetChainName =
  wagmiConfig.chains.find((chain) => chain.id === walnutChainId)?.name ??
  `Chain ${walnutChainId}`;

export function ProtocolAlerts({ protocol }: ProtocolHealthProps) {
  const alerts: AlertItem[] = [];

  if (protocol.isConnectionTransient) {
    alerts.push({ key: "wallet-reconnect", message: "Restoring wallet session...", tone: "info" });
  }

  if (!protocol.isWalletReady && !protocol.isConnectionTransient) {
    alerts.push({ key: "wallet", message: "Connect your wallet to continue.", tone: "warning" });
  }

  if (protocol.isWalletReady && !protocol.isConnectionTransient && !protocol.isOnTargetChain) {
    alerts.push({
      key: "network",
      message: `Wrong network. Please switch to ${targetChainName}.`,
      tone: "error",
    });
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
  const statusItems = [
    {
      key: "wallet",
      label: "Wallet",
      value: protocol.isConnectionTransient
        ? "Reconnecting"
        : statusLabel(protocol.isWalletReady, "Connected", "Disconnected"),
      ok: protocol.isWalletReady,
      icon: Wallet,
    },
    {
      key: "network",
      label: "Network",
      value: protocol.isConnectionTransient
        ? "Detecting"
        : statusLabel(protocol.isOnTargetChain, targetChainName, "Wrong network"),
      ok: protocol.isConnectionTransient ? true : protocol.isOnTargetChain,
      icon: Globe,
    },
    {
      key: "access",
      label: "Private Access",
      value: statusLabel(protocol.permit.hasPermit && protocol.permit.isPermitValid, "Ready", "Not ready"),
      ok: protocol.permit.hasPermit && protocol.permit.isPermitValid,
      icon: ShieldCheck,
    },
  ] as const;

  return (
    <GlassPanel className="walnut-card">
      <p className="walnut-label">Status</p>
      <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
        {statusItems.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.key} className={`walnut-progress walnut-status-tile ${statusClass(item.ok)}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <p className="mt-2 font-medium">{item.value}</p>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}
