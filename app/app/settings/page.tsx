"use client";

import { useState } from "react";
import { useAccount } from "wagmi";

import { Button } from "@/components/ui/button";
import { ProtocolAlerts, SystemStatusPanel } from "@/components/walnut/protocol-health";
import { useWalnutPermit } from "@/components/walnut/permit-provider";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";

const ONBOARD_KEY = "walnut_wave1_onboard_complete";
const PERMIT_STORAGE_PREFIX = "walnut_active_permit_hash_";

export default function SettingsPage() {
  const { address, chain } = useAccount();
  const permit = useWalnutPermit();
  const protocol = useWalnutProtocol();

  function clearOnboardingFlag() {
    window.localStorage.removeItem(ONBOARD_KEY);
  }

  function clearCachedPermitSelection() {
    const keysToRemove: string[] = [];

    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(PERMIT_STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  }

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          View wallet status and debug controls for permit and session state.
        </p>
      </header>

      <ProtocolAlerts protocol={protocol} />

      <div className="border rounded-lg p-4">
        <div className="grid gap-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Wallet Address</p>
            <p className="mt-2 text-sm font-mono text-foreground break-all">{address ?? "Not connected"}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Active Chain</p>
            <p className="mt-2 text-sm font-mono text-foreground">{chain?.name ?? "Unknown"}</p>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Planned for Production</p>
              <h2 className="mt-2 text-xl font-semibold text-foreground">ENS Aggregation</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                ENS wallet linking and collateral aggregation are planned for the production release.
              </p>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-blue-900">
                This feature is currently disabled. The current release focuses on the core lending protocol with FHE token economics.
              </p>
            </div>
          </section>

          <aside className="grid gap-4 self-start">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Production Feature</p>
              <p className="mt-2 text-lg font-semibold text-foreground">Aggregated Collateral</p>
              <p className="mt-1 text-sm text-muted-foreground">ENS aggregation feature</p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Linked Wallets</p>
              <p className="mt-2 text-sm text-muted-foreground">
                ENS wallet linking is planned for the production release.
              </p>
            </div>
          </aside>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Debug Controls</p>
          <p className="mt-2 text-xs text-amber-700">
            Active permit: {permit.hasPermit ? "Present" : "Missing"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              className="px-4 py-2 rounded-xl border border-slate-200"
              onClick={permit.requestPermitCreation}
            >
              Re-request Permit
            </Button>
            <Button 
              variant="outline" 
              className="px-4 py-2 rounded-xl border border-slate-200"
              onClick={clearCachedPermitSelection}
            >
              Clear Permit Cache
            </Button>
            <Button 
              variant="outline" 
              className="px-4 py-2 rounded-xl border border-slate-200"
              onClick={clearOnboardingFlag}
            >
              Clear Onboarding Flag
            </Button>
          </div>
        </div>
      </div>

      <SystemStatusPanel protocol={protocol} />
    </div>
  );
}
