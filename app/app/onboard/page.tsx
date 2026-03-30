"use client";

import { Copy, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GlassPanel } from "@/components/walnut/glass-panel";
import { walnutChainId } from "@/lib/walnut-contract";

const ONBOARD_KEY = "walnut_wave1_onboard_complete";

export default function OnboardPage() {
  const { address, isConnected } = useAccount();
  const [saved, setSaved] = useState(false);
  const [persisted, setPersisted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(ONBOARD_KEY);
    setPersisted(stored === "true");
  }, []);

  const permitFingerprint = useMemo(() => {
    if (!address) return "Connect wallet to generate";
    return `${address.slice(0, 10)}-${walnutChainId}-${address.slice(-6)}`;
  }, [address]);

  async function copyFingerprint() {
    if (!address) return;
    await navigator.clipboard.writeText(permitFingerprint);
  }

  function completeOnboarding() {
    if (!saved) return;
    window.localStorage.setItem(ONBOARD_KEY, "true");
    setPersisted(true);
  }

  return (
    <div className="space-y-6">
      <GlassPanel>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Onboarding</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Key & Permit Setup</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Walnut uses client-side encryption permits. Save this fingerprint so you can verify the same wallet and
          security context later.
        </p>
      </GlassPanel>

      <GlassPanel className="space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Permit Fingerprint</p>
        <div className="rounded-xl border border-black/10 bg-white p-4">
          <p className="break-all font-mono text-sm text-foreground">{permitFingerprint}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="glass-button" onClick={copyFingerprint} disabled={!isConnected}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Fingerprint
          </Button>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-white p-4">
          <Checkbox id="saved" checked={saved} onCheckedChange={(value) => setSaved(Boolean(value))} />
          <label htmlFor="saved" className="text-sm text-foreground">
            I saved this fingerprint and understand I must use the same wallet for decryption.
          </label>
        </div>

        <Button
          className="glass-button bg-accent text-accent-foreground hover:bg-accent/85"
          onClick={completeOnboarding}
          disabled={!saved || !isConnected}
        >
          <ShieldCheck className="mr-2 h-4 w-4" />
          Mark Onboarding Complete
        </Button>
      </GlassPanel>

      <GlassPanel className={persisted ? "border-emerald-300/40" : "border-amber-300/40"}>
        <p className="text-sm text-foreground">
          Status: {persisted ? "Completed for this browser profile." : "Pending completion in this browser profile."}
        </p>
      </GlassPanel>
    </div>
  );
}
