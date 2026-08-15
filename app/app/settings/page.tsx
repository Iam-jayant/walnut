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
    <div className="space-y-6 max-w-7xl pb-12">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-black">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your cryptographically secured permits, wallet connections, and protocol parameters.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Left Column: Management */}
        <div className="space-y-6">
          {/* Wallet Information */}
          <section className="bg-white border border-black/10 rounded-md p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-black/5 pb-4">
              <Wallet className="h-4.5 w-4.5 text-slate-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Wallet Connection</h2>
              <span className="ml-auto flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase">
                <span className={`h-1.5 w-1.5 rounded-full ${account.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                {account.isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Account Address</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono bg-slate-50 border border-black/5 px-3 py-2 rounded-md text-slate-700 truncate block w-full max-w-[240px]">
                    {account.address ? account.address : "Not connected"}
                  </code>
                  {account.address && (
                    <button
                      onClick={() => copyToClipboard(account.address!, "Address", addToast)}
                      className="p-2 hover:bg-slate-100 border border-black/5 rounded-md text-slate-400 hover:text-black transition-colors"
                      title="Copy Address"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Target Network</div>
                <p className="text-sm font-semibold text-slate-800 flex items-center gap-2 pt-1">
                  <Server className="h-4 w-4 text-slate-400" />
                  {targetChainName}
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-50 border border-black/5 px-1.5 py-0.5 rounded-md">ID: {walnutChainId}</span>
                </p>
              </div>
            </div>
          </section>

          {/* Permit Management */}
          <section className="bg-white border border-black/10 rounded-md p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-black/5 pb-4">
              <KeyRound className="h-4.5 w-4.5 text-slate-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Privacy & Security Permit</h2>
              {protocol.permit.hasPermit ? (
                <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 border border-emerald-200/50">
                  Active
                </span>
              ) : (
                <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 border border-amber-200/50">
                  Uninitialized
                </span>
              )}
            </div>

            <div className="space-y-5">
              <div className="rounded-md border border-blue-100 bg-blue-50/50 p-4 flex items-start gap-3 text-xs text-blue-900 leading-relaxed">
                <HelpCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <strong className="block mb-1">On-Chain Encryption Permit</strong>
                  <p className="text-blue-700/80">
                    A permit acts as your cryptographically signed authorization key. Because your lending balances, collateral, and debt levels are securely encrypted on-chain, your browser needs a valid permit to perform secure enclaves FHE decryption requests.
                  </p>
                </div>
              </div>

              {permitHash && (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Current Permit Hash</div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-slate-50 border border-black/5 px-3 py-2 rounded-md text-slate-700 break-all flex-1">
                      {permitHash}
                    </code>
                    <button
                      onClick={() => copyToClipboard(permitHash, "Permit Hash", addToast)}
                      className="p-2 hover:bg-slate-100 border border-black/5 rounded-md text-slate-400 hover:text-black transition-colors"
                      title="Copy Permit Hash"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2">
                {!protocol.permit.hasPermit ? (
                  <Button
                    onClick={protocol.permit.requestPermitCreation}
                    isLoading={protocol.permit.isPermitInitializing}
                    loadingText="Creating permit..."
                    className="bg-black text-white hover:bg-slate-800 rounded-md px-5 h-9 text-xs font-semibold shadow-none transition-colors"
                  >
                    Create Viewing Permit
                  </Button>
                ) : (
                  <Button
                    onClick={handleResetPermit}
                    variant="outline"
                    className="flex items-center gap-2 rounded-md border-black/10 text-slate-700 hover:bg-slate-50 hover:text-black px-4 h-9 text-xs font-semibold shadow-none transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reset & Request New Permit
                  </Button>
                )}
              </div>
            </div>
          </section>

          {/* Smart Contract Addresses */}
          <section className="bg-white border border-black/10 rounded-md p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-black/5 pb-4">
              <Landmark className="h-4.5 w-4.5 text-slate-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Contract Deployments</h2>
            </div>

            <div className="space-y-3">
              {[
                { label: "Walnut Lending core", address: WALNUT_LENDING_ADDRESS },
                { label: "cUSDC Collateral Token (FHERC20)", address: FHERC20_ADDRESS },
                { label: "Encrypted Price Oracle", address: ORACLE_ADDRESS },
                { label: "Mock USDC Liquidity", address: MOCK_USDC_ADDRESS },
              ].map((contract) => (
                <div key={contract.label} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 border border-black/5 rounded-md">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{contract.label}</div>
                    <code className="text-xs font-mono text-slate-700 break-all block">{contract.address || "Not configured"}</code>
                  </div>
                  {contract.address && (
                     <div className="flex items-center gap-1.5 self-start sm:self-center">
                      <button
                        onClick={() => copyToClipboard(contract.address!, contract.label, addToast)}
                        className="p-1.5 hover:bg-slate-200/50 rounded-md text-slate-400 hover:text-black transition-colors"
                        title="Copy address"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <a
                        href={`https://sepolia.arbiscan.io/address/${contract.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-slate-200/50 rounded-md text-slate-400 hover:text-black transition-colors"
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
          <section className="bg-white border border-black/10 rounded-md p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-black/5 pb-4">
              <Shield className="h-4.5 w-4.5 text-slate-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Protocol Parameters</h2>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 border border-black/5 rounded-md flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Borrow APR</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">8.00% compounding</p>
                </div>
                <Percent className="h-4 w-4 text-slate-300" />
              </div>

              <div className="p-3 bg-slate-50 border border-black/5 rounded-md flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Protocol Fee Rate</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">25.00%</p>
                </div>
                <Coins className="h-4 w-4 text-slate-300" />
              </div>

              <div className="p-3 bg-slate-50 border border-black/5 rounded-md flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Liquidation Threshold</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">1.05 health factor</p>
                </div>
                <Heart className="h-4 w-4 text-slate-300" />
              </div>
            </div>
          </section>

          {/* LTV & Repayment Tiers */}
          <section className="bg-white border border-black/10 rounded-md p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-black/5 pb-4">
              <Sparkles className="h-4.5 w-4.5 text-slate-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Credit LTV Tiers</h2>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed">
              Your borrowing capacity dynamically adjusts based on on-chain repayment history. Timely settlements elevate your tier level.
            </p>

            <div className="border border-black/5 rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-black/5">
                    <th className="text-left py-3 px-4 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Tier Level</th>
                    <th className="text-left py-3 px-4 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Max LTV Ratio</th>
                    <th className="text-left py-3 px-4 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Repayments Req</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {tierLTVs.map((tier) => (
                   <tr key={tier.tier} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-700">Tier {tier.tier}</td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">{tier.ltv}</td>
                      <td className="py-3 px-4 text-slate-500">{tier.repayments}</td>
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
