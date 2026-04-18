"use client";

import { useAccount } from "wagmi";

import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/walnut/glass-panel";
import { useWalnutPermit } from "@/components/walnut/permit-provider";

const ONBOARD_KEY = "walnut_wave1_onboard_complete";
const PERMIT_STORAGE_PREFIX = "walnut_active_permit_hash_";

export default function SettingsPage() {
  const { address, chain } = useAccount();
  const permit = useWalnutPermit();

  function clearLegacyOnboardingFlag() {
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
    <div className="space-y-6">
      <GlassPanel className="walnut-hero">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Settings</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Profile</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          View wallet status and use debug controls for local permit/session state.
        </p>
      </GlassPanel>

      <GlassPanel className="walnut-card">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="walnut-card">
            <dt className="walnut-label">Wallet</dt>
            <dd className="walnut-meta break-all font-mono text-foreground">{address ?? "Not connected"}</dd>
          </div>
          <div className="walnut-card">
            <dt className="walnut-label">Active Chain</dt>
            <dd className="walnut-meta font-mono text-foreground">{chain?.name ?? "Unknown"}</dd>
          </div>
        </dl>
      </GlassPanel>

      <GlassPanel className="walnut-alert walnut-alert-warning">
        <p className="text-sm text-foreground">Debug Controls</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Active permit: {permit.hasPermit ? "Present" : "Missing"}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" className="glass-button" onClick={permit.requestPermitCreation}>
            Re-request Permit
          </Button>
          <Button variant="outline" className="glass-button" onClick={clearCachedPermitSelection}>
            Clear Permit Cache
          </Button>
          <Button variant="outline" className="glass-button" onClick={clearLegacyOnboardingFlag}>
            Clear Legacy Onboarding Flag
          </Button>
        </div>
      </GlassPanel>
    </div>
  );
}
