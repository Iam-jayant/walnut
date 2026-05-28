"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { Copy, ExternalLink, RefreshCw, Shield, KeyRound, Wallet, Server, Landmark, Percent, Heart, HelpCircle, CheckCircle2, Coins, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";
import { useToast, type ToastVariant } from "@/components/walnut/toast-provider";
import {
  walnutChainId,
  walnutContractAddress,
  walnutFherc20Address,
  walnutOracleAddress,
  walnutMockUsdcAddress,
} from "@/lib/walnut-contract";
import { wagmiConfig } from "@/lib/web3-config";

const WALNUT_LENDING_ADDRESS = walnutContractAddress;
const FHERC20_ADDRESS = walnutFherc20Address;
const ORACLE_ADDRESS = walnutOracleAddress;
const MOCK_USDC_ADDRESS = walnutMockUsdcAddress;


const targetChainName =
  wagmiConfig.chains.find((chain) => chain.id === walnutChainId)?.name ??
  `Chain ${walnutChainId}`;

function truncateAddress(address: string | undefined): string {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function copyToClipboard(text: string, label: string, addToast: (toast: { variant: ToastVariant; message: string }) => void) {
  navigator.clipboard.writeText(text);
  addToast({ variant: "success", message: `${label} copied to clipboard` });
}

export default function SettingsPage() {
  const account = useAccount();
  const protocol = useWalnutProtocol();
  const { addToast } = useToast();

  const permitHash = useMemo(() => {
    if (!protocol.permit.hasPermit || !protocol.permit.permitHash) return null;
    return protocol.permit.permitHash;
  }, [protocol.permit.hasPermit, protocol.permit.permitHash]);

  const tierLTVs = [
    { tier: 0, ltv: "70.00%", repayments: "0-2 repayments" },
    { tier: 1, ltv: "75.00%", repayments: "3-9 repayments" },
    { tier: 2, ltv: "80.00%", repayments: "10-24 repayments" },
    { tier: 3, ltv: "85.00%", repayments: "25-49 repayments" },
    { tier: 4, ltv: "90.00%", repayments: "50+ repayments" },
  ];

  const handleResetPermit = async () => {
    if (!protocol.permit.hasPermit) return;
    await protocol.permit.requestPermitCreation();
    addToast({ variant: "success", message: "Permit reset initiated" });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <header className="border-b border-slate-100 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your cryptographically secured permits, wallet connections, and review lending protocol parameters.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Left Column: Management */}
        <div className="space-y-6">
          {/* Wallet Information */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Wallet className="h-4.5 w-4.5 text-slate-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Wallet Connection</h2>
              <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-slate-500 uppercase">
                <span className={`h-1.5 w-1.5 rounded-full ${account.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                {account.isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Account Address</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl text-slate-800 truncate block w-full max-w-[240px]">
                    {account.address ? account.address : "Not connected"}
                  </code>
                  {account.address && (
                    <button
                      onClick={() => copyToClipboard(account.address!, "Address", addToast)}
                      className="p-2 hover:bg-slate-100 border border-slate-100 rounded-xl text-slate-500 hover:text-black transition"
                      title="Copy Address"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] uppercase font-semibold text-slate-400">Target Network</div>
                <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mt-1.5">
                  <Server className="h-3.5 w-3.5 text-slate-500" />
                  {targetChainName}
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-50 border px-1.5 py-0.5 rounded-md">ID: {walnutChainId}</span>
                </p>
              </div>
            </div>
          </section>

          {/* Permit Management */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <KeyRound className="h-4.5 w-4.5 text-slate-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Permit Configuration</h2>
              {protocol.permit.hasPermit ? (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                  Active
                </span>
              ) : (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-600/20">
                  Uninitialized
                </span>
              )}
            </div>

            <div className="space-y-4">
              {permitHash && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-semibold text-slate-400">Current Permit Hash</div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl text-slate-800 break-all flex-1">
                      {permitHash}
                    </code>
                    <button
                      onClick={() => copyToClipboard(permitHash, "Permit Hash", addToast)}
                      className="p-2 hover:bg-slate-100 border border-slate-100 rounded-xl text-slate-500 hover:text-black transition"
                      title="Copy Permit Hash"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 flex items-start gap-2.5 text-xs text-blue-800 leading-normal">
                <HelpCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <strong>What is an on-chain permit?</strong>
                  <p className="mt-1 text-blue-700">
                    A permit acts as your cryptographically signed authorization key. Because your lending balances, collateral, and debt levels are securely encrypted on-chain, your browser needs a valid permit to perform secure enclaves FHE decryption requests, revealing your actual dashboard figures.
                  </p>
                </div>
              </div>

              <div>
                {!protocol.permit.hasPermit ? (
                  <Button
                    onClick={protocol.permit.requestPermitCreation}
                    isLoading={protocol.permit.isPermitInitializing}
                    loadingText="Creating permit..."
                    className="bg-black text-white hover:bg-slate-800 rounded-xl px-5 py-2.5 text-sm font-medium transition"
                  >
                    Create Viewing Permit
                  </Button>
                ) : (
                  <Button
                    onClick={handleResetPermit}
                    variant="outline"
                    className="flex items-center gap-1.5 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2.5 text-sm font-medium transition"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reset & Request New Permit
                  </Button>
                )}
              </div>
            </div>
          </section>

          {/* Smart Contract Addresses */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Landmark className="h-4.5 w-4.5 text-slate-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Contract Deployments</h2>
            </div>

            <div className="space-y-3">
              {[
                { label: "Walnut Lending core", address: WALNUT_LENDING_ADDRESS },
                { label: "cUSDC Collateral Token (FHERC20)", address: FHERC20_ADDRESS },
                { label: "Encrypted Price Oracle", address: ORACLE_ADDRESS },
                { label: "Mock USDC Liquidity", address: MOCK_USDC_ADDRESS },
              ].map((contract) => (
                <div key={contract.label} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50/50 border border-slate-100 rounded-xl">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{contract.label}</div>
                    <code className="text-xs font-mono text-slate-800 break-all block">{contract.address || "Not configured"}</code>
                  </div>
                  {contract.address && (
                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <button
                        onClick={() => copyToClipboard(contract.address!, contract.label, addToast)}
                        className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-500 hover:text-black transition"
                        title="Copy address"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <a
                        href={`https://sepolia.arbiscan.io/address/${contract.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-500 hover:text-black transition"
                        title="View on Explorer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Parameters & Info */}
        <div className="space-y-6">
          {/* Protocol Parameters */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Shield className="h-4.5 w-4.5 text-slate-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Protocol Parameters</h2>
            </div>

            <div className="grid gap-3.5">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Borrow APR</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">8.00% compounding</p>
                </div>
                <Percent className="h-4 w-4 text-slate-400" />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Protocol Fee Rate</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">25.00%</p>
                </div>
                <Coins className="h-4 w-4 text-slate-400" />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Liquidation Threshold</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">1.05 health factor</p>
                </div>
                <Heart className="h-4 w-4 text-slate-400" />
              </div>
            </div>
          </section>

          {/* LTV & Repayment Tiers */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Sparkles className="h-4.5 w-4.5 text-slate-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Credit LTV Tiers</h2>
            </div>
            
            <p className="text-xs text-muted-foreground leading-normal">
              Your borrowing capacity dynamically adjusts based on on-chain repayment history. Timely settlements elevate your tier level.
            </p>

            <div className="border border-slate-150 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150">
                    <th className="text-left py-2.5 px-3.5 font-semibold text-slate-500 uppercase tracking-wider text-[9px]">Tier Level</th>
                    <th className="text-left py-2.5 px-3.5 font-semibold text-slate-500 uppercase tracking-wider text-[9px]">Max LTV Ratio</th>
                    <th className="text-left py-2.5 px-3.5 font-semibold text-slate-500 uppercase tracking-wider text-[9px]">Repayments Required</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tierLTVs.map((tier) => (
                    <tr key={tier.tier} className="hover:bg-slate-50/50 transition">
                      <td className="py-2.5 px-3.5 font-semibold text-slate-800">Tier {tier.tier}</td>
                      <td className="py-2.5 px-3.5 font-mono font-medium text-slate-900">{tier.ltv}</td>
                      <td className="py-2.5 px-3.5 text-muted-foreground">{tier.repayments}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
