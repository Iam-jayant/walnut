"use client";

import { GlassPanel } from "@/components/walnut/glass-panel";
import { SystemStatusPanel } from "@/components/walnut/protocol-health";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";
import { Users, Lock } from "lucide-react";

export default function P2PPage() {
  const protocol = useWalnutProtocol();

  return (
    <div className="space-y-6">
      <GlassPanel className="walnut-hero">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">P2P Lending</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Planned for Production</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Peer-to-peer lending with encrypted loan terms is currently disabled while the protocol focuses on core token economics.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="walnut-status-chip walnut-chip-pending">
            <Lock className="mr-1 h-3 w-3" />
            Production Feature
          </span>
        </div>
      </GlassPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassPanel className="walnut-card walnut-card-strong p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-blue-100 p-3">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-xl text-foreground">P2P Loan Marketplace</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                The production release will introduce a decentralized peer-to-peer lending marketplace where lenders can post encrypted loan offers and borrowers can match them.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent" />
                  <span>Encrypted APR, size, and tenor</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent" />
                  <span>Automated loan matching</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent" />
                  <span>Private loan terms</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent" />
                  <span>Flexible interest rates</span>
                </li>
              </ul>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="walnut-card walnut-card-strong p-6">
          <h3 className="font-display text-xl text-foreground">Current Protocol Focus</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            The current release focuses on robust token economics with real ERC20 collateral, encrypted stablecoin borrowing, and time-based interest accrual.
          </p>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-medium text-emerald-800">✓ Real Token Deposits (WETH, USDC, LINK)</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-medium text-emerald-800">✓ Encrypted wUSDC Borrowing</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-medium text-emerald-800">✓ Chainlink Price Oracles</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-medium text-emerald-800">✓ Time-Based Interest (8% APR)</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-medium text-emerald-800">✓ Credit Tier System (0-4)</p>
            </div>
          </div>
        </GlassPanel>
      </div>

      <GlassPanel className="walnut-card p-6">
        <h3 className="font-display text-xl text-foreground">Why Later?</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          The P2P lending system requires additional infrastructure including:
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          <li className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            <span>Loan offer matching engine</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            <span>Lender pool management</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            <span>Interest distribution logic</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            <span>Loan term enforcement</span>
          </li>
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          The current release establishes the foundation with working token economics, allowing the P2P layer to build on top of a proven system.
        </p>
      </GlassPanel>

      <SystemStatusPanel protocol={protocol} />
    </div>
  );
}
