"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/walnut/glass-panel";
import {
  walnutChainId,
  walnutContractAddress,
  walnutRpcUrl,
} from "@/lib/walnut-contract";

const ONBOARD_KEY = "walnut_wave1_onboard_complete";

export default function SettingsPage() {
  const { address, chain } = useAccount();
  const [onboardComplete, setOnboardComplete] = useState(false);

  useEffect(() => {
    setOnboardComplete(window.localStorage.getItem(ONBOARD_KEY) === "true");
  }, []);

  function resetOnboarding() {
    window.localStorage.removeItem(ONBOARD_KEY);
    setOnboardComplete(false);
  }

  return (
    <div className="space-y-6">
      <GlassPanel>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Settings</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Environment & Profile</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Manage local app state and verify your active network configuration for the Wave 1 prototype.
        </p>
      </GlassPanel>

      <GlassPanel>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <dt className="text-muted-foreground">Wallet</dt>
            <dd className="mt-1 font-mono text-foreground break-all">{address ?? "Not connected"}</dd>
          </div>
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <dt className="text-muted-foreground">Active Chain</dt>
            <dd className="mt-1 font-mono text-foreground">{chain?.name ?? "Unknown"}</dd>
          </div>
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <dt className="text-muted-foreground">Target Chain ID</dt>
            <dd className="mt-1 font-mono text-foreground">{walnutChainId}</dd>
          </div>
          <div className="rounded-xl border border-black/10 bg-white p-4">
            <dt className="text-muted-foreground">Contract Address</dt>
            <dd className="mt-1 font-mono text-foreground break-all">{walnutContractAddress ?? "Not set"}</dd>
          </div>
          <div className="rounded-xl border border-black/10 bg-white p-4 sm:col-span-2">
            <dt className="text-muted-foreground">RPC URL</dt>
            <dd className="mt-1 font-mono text-foreground break-all">{walnutRpcUrl}</dd>
          </div>
        </dl>
      </GlassPanel>

      <GlassPanel className={onboardComplete ? "border-emerald-300/40" : "border-amber-300/40"}>
        <p className="text-sm text-foreground">
          Onboarding in this browser: {onboardComplete ? "Complete" : "Pending"}
        </p>
        <Button variant="outline" className="glass-button mt-4" onClick={resetOnboarding}>
          Reset Onboarding State
        </Button>
      </GlassPanel>
    </div>
  );
}
