"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";
import { useToast, type ToastVariant } from "@/components/walnut/toast-provider";
import { walnutChainId } from "@/lib/walnut-contract";
import { wagmiConfig } from "@/lib/web3-config";

const WALNUT_LENDING_ADDRESS = process.env.NEXT_PUBLIC_WALNUT_LENDING_ADDRESS;
const FHERC20_ADDRESS = process.env.NEXT_PUBLIC_FHERC20_ADDRESS;
const ORACLE_ADDRESS = process.env.NEXT_PUBLIC_ORACLE_ADDRESS;
const MOCK_USDC_ADDRESS = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS;

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
    { tier: 0, ltv: "70.00%", repayments: "0-2" },
    { tier: 1, ltv: "75.00%", repayments: "3-9" },
    { tier: 2, ltv: "80.00%", repayments: "10-24" },
    { tier: 3, ltv: "85.00%", repayments: "25-49" },
    { tier: 4, ltv: "90.00%", repayments: "50+" },
  ];

  const handleResetPermit = async () => {
    if (!protocol.permit.hasPermit) return;
    
    // Request a new permit creation (this will replace the old one)
    await protocol.permit.requestPermitCreation();
    addToast({ variant: "success", message: "Permit reset initiated" });
  };

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your wallet, permits, and view protocol information.</p>
      </header>

      {/* Wallet Info Section */}
      <section className="border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">Wallet Information</h2>
        
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-xs font-mono uppercase text-muted-foreground">Connected Address</div>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono bg-slate-100 px-3 py-2 rounded border">
                {account.address ? account.address : "Not connected"}
              </code>
              {account.address && (
                <button
                  onClick={() => copyToClipboard(account.address!, "Address", addToast)}
                  className="p-2 hover:bg-slate-100 rounded transition-colors"
                  title="Copy address"
                >
                  <Copy className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-mono uppercase text-muted-foreground">Connection Status</div>
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${account.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm">{account.isConnected ? "Connected" : "Disconnected"}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-mono uppercase text-muted-foreground">Network</div>
            <div className="text-sm">{targetChainName}</div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-mono uppercase text-muted-foreground">Chain ID</div>
            <div className="text-sm font-mono">{walnutChainId}</div>
          </div>
        </div>
      </section>

      {/* Permit Management Section */}
      <section className="border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">Permit Management</h2>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-mono uppercase text-muted-foreground">Permit Status</div>
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${protocol.permit.hasPermit ? 'bg-green-500' : 'bg-amber-500'}`} />
              <span className="text-sm">
                {protocol.permit.hasPermit ? "Active" : "Not created"}
              </span>
            </div>
          </div>

          {permitHash && (
            <div className="space-y-2">
              <div className="text-xs font-mono uppercase text-muted-foreground">Permit Hash</div>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono bg-slate-100 px-3 py-2 rounded border break-all">
                  {truncateAddress(permitHash)}
                </code>
                <button
                  onClick={() => copyToClipboard(permitHash, "Permit hash", addToast)}
                  className="p-2 hover:bg-slate-100 rounded transition-colors"
                  title="Copy permit hash"
                >
                  <Copy className="h-4 w-4" />
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
                className="bg-black text-white hover:bg-slate-900"
              >
                Create Permit
              </Button>
            ) : (
              <Button
                onClick={handleResetPermit}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reset Permit
              </Button>
            )}
          </div>

          <div className="text-xs text-muted-foreground bg-slate-50 p-3 rounded border">
            <strong>What is a permit?</strong> A permit allows you to decrypt your encrypted balances and positions. 
            It's required to view your collateral, debt, and other private information on the dashboard.
          </div>
        </div>
      </section>

      {/* Network Info Section */}
      <section className="border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">Network Information</h2>
        
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-xs font-mono uppercase text-muted-foreground">Network Name</div>
            <div className="text-sm">{targetChainName}</div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-mono uppercase text-muted-foreground">Chain ID</div>
            <div className="text-sm font-mono">{walnutChainId}</div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-mono uppercase text-muted-foreground">Block Explorer</div>
            <a
              href="https://sepolia.arbiscan.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              Arbiscan <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </section>

      {/* Protocol Constants Section */}
      <section className="border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">Protocol Constants</h2>
        
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs font-mono uppercase text-muted-foreground">Borrow APR</div>
              <div className="text-sm font-mono">6.00% - 12.00%</div>
              <div className="text-xs text-muted-foreground">Dynamic rate based on utilization</div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-mono uppercase text-muted-foreground">Protocol Fee</div>
              <div className="text-sm font-mono">25%</div>
              <div className="text-xs text-muted-foreground">Of total interest paid</div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-mono uppercase text-muted-foreground">Liquidation Threshold</div>
              <div className="text-sm font-mono">1.05</div>
              <div className="text-xs text-muted-foreground">Health factor below this triggers liquidation</div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-mono uppercase text-muted-foreground">Minimum Health Factor</div>
              <div className="text-sm font-mono">1.05</div>
              <div className="text-xs text-muted-foreground">Required to maintain position</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-mono uppercase text-muted-foreground">Credit Tier LTV Limits</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-semibold">Tier</th>
                    <th className="text-left py-2 px-3 font-semibold">Max LTV</th>
                    <th className="text-left py-2 px-3 font-semibold">Repayments Required</th>
                  </tr>
                </thead>
                <tbody>
                  {tierLTVs.map((tier) => (
                    <tr key={tier.tier} className="border-b last:border-0">
                      <td className="py-2 px-3 font-mono">Tier {tier.tier}</td>
                      <td className="py-2 px-3 font-mono">{tier.ltv}</td>
                      <td className="py-2 px-3 text-muted-foreground">{tier.repayments}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Contract Addresses Section */}
      <section className="border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">Contract Addresses</h2>
        
        <div className="space-y-3">
          {[
            { label: "WalnutLending", address: WALNUT_LENDING_ADDRESS },
            { label: "cUSDC (FHERC20)", address: FHERC20_ADDRESS },
            { label: "Price Oracle", address: ORACLE_ADDRESS },
            { label: "Mock USDC", address: MOCK_USDC_ADDRESS },
          ].map((contract) => (
            <div key={contract.label} className="flex items-center justify-between gap-4 p-3 bg-slate-50 rounded border">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="text-xs font-mono uppercase text-muted-foreground">{contract.label}</div>
                <code className="text-sm font-mono break-all">{contract.address || "Not configured"}</code>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {contract.address && (
                  <>
                    <button
                      onClick={() => copyToClipboard(contract.address!, contract.label, addToast)}
                      className="p-2 hover:bg-slate-200 rounded transition-colors"
                      title="Copy address"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <a
                      href={`https://sepolia.arbiscan.io/address/${contract.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-slate-200 rounded transition-colors"
                      title="View on Arbiscan"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
