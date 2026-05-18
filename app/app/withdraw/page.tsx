"use client";

import { useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import type { Address } from "viem";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassPanel } from "@/components/walnut/glass-panel";
import { ProtocolAlerts, SystemStatusPanel } from "@/components/walnut/protocol-health";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";
import { useTokenBalances } from "@/hooks/use-token-balances";
import { useToast } from "@/components/walnut/toast-provider";
import { wagmiConfig } from "@/lib/web3-config";
import { walnutChainId } from "@/lib/walnut-contract";

const targetChainName =
  wagmiConfig.chains.find((chain) => chain.id === walnutChainId)?.name ??
  `Chain ${walnutChainId}`;

// Contract addresses from environment
const WALNUT_V2_ADDRESS = process.env.NEXT_PUBLIC_V2_CONTRACT_ADDRESS as Address;
const MOCK_USDC_ADDRESS = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS as Address;
const ORACLE_ADDRESS = process.env.NEXT_PUBLIC_ORACLE_ADDRESS as Address;

// Supported tokens on Arbitrum Sepolia
const SUPPORTED_TOKENS = [
  {
    address: MOCK_USDC_ADDRESS,
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  {
    address: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73" as Address,
    symbol: "WETH",
    name: "Wrapped Ethereum",
    decimals: 18,
  },
  {
    address: "0x152b0df80135c63b4cb1fbe00ddce7e9a8ffcb04" as Address,
    symbol: "LINK",
    name: "Chainlink Token",
    decimals: 18,
  },
] as const;

// WalnutV2 ABI (minimal)
const WALNUT_V2_ABI = [
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// Oracle ABI (minimal)
const ORACLE_ABI = [
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "getUSDValue",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

type WithdrawStep = "idle" | "withdraw_pending" | "withdraw_confirmed" | "error";

function assertSuccessReceipt(receipt: { status?: "success" | "reverted" }) {
  if (receipt.status && receipt.status !== "success") {
    throw new Error("Transaction reverted on-chain.");
  }
}

export default function WithdrawPage() {
  const account = useAccount();
  const publicClient = usePublicClient();
  const { addToast } = useToast();
  const protocol = useWalnutProtocol();
  const { vaultHoldings, refreshBalances } = useTokenBalances();

  const [selectedToken, setSelectedToken] = useState<Address>(MOCK_USDC_ADDRESS);
  const [amount, setAmount] = useState("");
  const [withdrawStep, setWithdrawStep] = useState<WithdrawStep>("idle");
  const [withdrawTxHash, setWithdrawTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Get vault holding for selected token
  const vaultHolding = useMemo(() => {
    return vaultHoldings.find((h) => h.token.toLowerCase() === selectedToken.toLowerCase());
  }, [vaultHoldings, selectedToken]);

  // Get token info
  const tokenInfo = useMemo(() => {
    const fromSupported = SUPPORTED_TOKENS.find((t) => t.address.toLowerCase() === selectedToken.toLowerCase());
    if (fromSupported) {
      return {
        token: fromSupported.address,
        symbol: fromSupported.symbol,
        decimals: fromSupported.decimals,
        vaultBalance: vaultHolding?.amount ?? 0n,
      };
    }
    return undefined;
  }, [selectedToken, vaultHolding]);

  // Parse amount to bigint
  const parsedAmount = useMemo(() => {
    if (!amount || !/^\d+(\.\d+)?$/.test(amount)) return 0n;
    try {
      const decimals = tokenInfo?.decimals ?? 6;
      const parts = amount.split(".");
      const integerPart = parts[0] || "0";
      const decimalPart = (parts[1] || "").padEnd(decimals, "0").slice(0, decimals);
      return BigInt(integerPart + decimalPart);
    } catch {
      return 0n;
    }
  }, [amount, tokenInfo]);

  // Get USD value
  const { data: usdValue } = useReadContract({
    address: ORACLE_ADDRESS,
    abi: ORACLE_ABI,
    functionName: "getUSDValue",
    args: [selectedToken, parsedAmount],
    query: {
      enabled: parsedAmount > 0n,
    },
  });

  // Format USD value
  const formattedUsdValue = useMemo(() => {
    if (!usdValue || usdValue === 0n) return "$0.00";
    const value = Number(usdValue) / 1e6; // 6 decimals
    return `$${value.toFixed(2)}`;
  }, [usdValue]);

  // Check if amount exceeds vault balance
  const exceedsVaultBalance = useMemo(() => {
    if (!tokenInfo) return false;
    return parsedAmount > tokenInfo.vaultBalance;
  }, [parsedAmount, tokenInfo]);

  // Withdraw contract
  const { writeContractAsync: withdrawAsync } = useWriteContract();
  const { isLoading: isWithdrawConfirming } = useWaitForTransactionReceipt({
    hash: withdrawTxHash as `0x${string}` | undefined,
  });

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!account.address || parsedAmount === 0n || exceedsVaultBalance) return;

    try {
      setWithdrawStep("withdraw_pending");
      setErrorMessage(null);

      // Fetch current gas price with buffer
      const gasPrice = await publicClient?.getGasPrice();
      const bufferedMaxFeePerGas = gasPrice ? (gasPrice * 150n) / 100n : undefined; // +50% buffer
      const maxPriorityFeePerGas = 1000000n; // 0.001 gwei tip

      const hash = await withdrawAsync({
        address: WALNUT_V2_ADDRESS,
        abi: WALNUT_V2_ABI,
        functionName: "withdraw",
        args: [selectedToken, parsedAmount],
        chain: arbitrumSepolia,
        account: account.address,
        maxFeePerGas: bufferedMaxFeePerGas,
        maxPriorityFeePerGas,
      });

      setWithdrawTxHash(hash);
      addToast({ variant: "pending", message: "Withdraw transaction submitted..." });

      // Wait for confirmation
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        assertSuccessReceipt(receipt);
      }

      setWithdrawStep("withdraw_confirmed");
      addToast({ variant: "success", message: "Withdraw request submitted. CoFHE settlement pending." });

      // Refresh balances
      await refreshBalances();
      await protocol.refreshBalances();

      // Reset form
      setAmount("");
      setWithdrawTxHash(null);

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setWithdrawStep("idle");
      }, 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Withdraw failed";
      setErrorMessage(message);
      setWithdrawStep("error");
      addToast({ variant: "error", message });
    }
  };

  // Handle user cancellation
  const handleCancel = () => {
    setWithdrawStep("idle");
    setWithdrawTxHash(null);
    setErrorMessage(null);
  };

  // Determine button state
  const isProcessing = withdrawStep === "withdraw_pending" || isWithdrawConfirming;
  const canSubmit = parsedAmount > 0n && !isProcessing && withdrawStep !== "withdraw_confirmed" && !exceedsVaultBalance;

  return (
    <div className="space-y-6">
      <GlassPanel className="walnut-hero">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Withdraw Collateral</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Withdraw Available Funds</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Withdraw ERC20 tokens from your vault. Withdrawal must maintain safe LTV ratio.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="walnut-status-chip walnut-status-chip-ghost">Wave 4 Token Economics</span>
          <span className="walnut-status-chip walnut-status-chip-ghost">{targetChainName}</span>
        </div>
      </GlassPanel>

      <ProtocolAlerts protocol={protocol} />

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <GlassPanel className="walnut-card walnut-card-strong space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="walnut-label">Withdraw Studio</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Select token and enter amount to withdraw from your vault.
              </p>
            </div>
            <span className="walnut-status-chip walnut-status-chip-ghost">Real Tokens</span>
          </div>

          <div>
            <label htmlFor="token-select" className="mb-2 block text-sm text-foreground">
              Token
            </label>
            <select
              id="token-select"
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value as Address)}
              className="h-12 w-full rounded-md border border-black/10 bg-white px-3 text-base font-sans text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isProcessing}
            >
              {SUPPORTED_TOKENS.map((token) => (
                <option key={token.address} value={token.address} className="font-sans">
                  {token.symbol} - {token.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="withdraw-amount" className="mb-2 block text-sm text-foreground">
              Amount
            </label>
            <Input
              id="withdraw-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
              className="h-12 border-black/10 bg-white text-lg text-foreground placeholder:text-muted-foreground/80"
              disabled={isProcessing}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Vault Balance: {tokenInfo ? (Number(tokenInfo.vaultBalance) / 10 ** tokenInfo.decimals).toFixed(6) : "0.00"} {tokenInfo?.symbol}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { label: "25%", value: tokenInfo ? (tokenInfo.vaultBalance * 25n / 100n).toString() : "0" },
              { label: "50%", value: tokenInfo ? (tokenInfo.vaultBalance * 50n / 100n).toString() : "0" },
              { label: "75%", value: tokenInfo ? (tokenInfo.vaultBalance * 75n / 100n).toString() : "0" },
              { label: "Max", value: tokenInfo ? tokenInfo.vaultBalance.toString() : "0" },
            ].map((option) => {
              const displayValue = tokenInfo && option.value !== "0" 
                ? (Number(option.value) / 10 ** tokenInfo.decimals).toFixed(6)
                : "0";
              return (
                <Button
                  key={option.label}
                  size="sm"
                  variant="outline"
                  className="glass-chip"
                  onClick={() => setAmount(displayValue)}
                  disabled={isProcessing || option.value === "0"}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>

          {exceedsVaultBalance && (
            <div className="walnut-alert walnut-alert-danger">
              <p className="text-sm text-red-700">
                Amount exceeds vault balance. Enter a lower value.
              </p>
            </div>
          )}

          {/* Transaction Status */}
          {withdrawStep !== "idle" && (
            <div className="rounded-lg border border-black/10 bg-white/50 p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Transaction Progress</p>
              
              {/* Withdraw Step */}
              <div className="flex items-center gap-3">
                {withdrawStep === "withdraw_pending" || isWithdrawConfirming ? (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                ) : withdrawStep === "withdraw_confirmed" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : withdrawStep === "error" ? (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                )}
                <div className="flex-1">
                  <p className="text-sm text-foreground">Withdraw from Walnut</p>
                  {withdrawTxHash && (
                    <a
                      href={`https://sepolia.arbiscan.io/tx/${withdrawTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline"
                    >
                      View on Arbiscan
                    </a>
                  )}
                </div>
              </div>

              {errorMessage && (
                <div className="rounded-md bg-red-50 p-3">
                  <p className="text-sm text-red-800">{errorMessage}</p>
                </div>
              )}
            </div>
          )}

          <div className="walnut-progress">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Withdrawal Rule</p>
            <p className="mt-2 text-sm text-foreground">
              Withdrawal must maintain safe LTV ratio. Contract will reject if it would make position unsafe.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              className="glass-button bg-accent text-accent-foreground hover:bg-accent/85"
              onClick={handleWithdraw}
              disabled={!canSubmit}
            >
              Withdraw
            </Button>
            {withdrawStep === "error" && (
              <Button
                variant="outline"
                className="glass-button"
                onClick={handleCancel}
              >
                Cancel
              </Button>
            )}
          </div>
        </GlassPanel>

        <div className="grid gap-4">
          <GlassPanel className="walnut-card walnut-card-strong walnut-kpi-card">
            <p className="walnut-label">USD Value</p>
            <p className="walnut-value">{formattedUsdValue}</p>
            <p className="walnut-meta">Real-time USD value of withdrawal amount</p>
          </GlassPanel>

          <GlassPanel className="walnut-card walnut-card-strong walnut-kpi-card">
            <p className="walnut-label">Vault Balance</p>
            <p className="walnut-value">
              {tokenInfo ? (Number(tokenInfo.vaultBalance) / 10 ** tokenInfo.decimals).toFixed(6) : "0.00"}
            </p>
            <p className="walnut-meta">Your vault balance of {tokenInfo?.symbol}</p>
          </GlassPanel>

          <GlassPanel className="walnut-card">
            <p className="walnut-label">Status</p>
            <p className="mt-2 text-sm text-foreground">
              {withdrawStep === "idle" && parsedAmount > 0n && !exceedsVaultBalance && "Ready to withdraw"}
              {withdrawStep === "idle" && parsedAmount === 0n && "Enter amount to continue"}
              {withdrawStep === "idle" && exceedsVaultBalance && "Amount exceeds vault balance"}
              {withdrawStep === "withdraw_pending" && "Submitting withdrawal request..."}
              {withdrawStep === "withdraw_confirmed" && "Withdrawal request submitted"}
              {withdrawStep === "error" && "Transaction failed"}
            </p>
          </GlassPanel>
        </div>
      </div>

      <SystemStatusPanel protocol={protocol} />
    </div>
  );
}
