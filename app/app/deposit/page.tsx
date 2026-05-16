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
  // Note: USDT, WBTC addresses are placeholders in deployment script
  // I will Uncomment when real testnet addresses are available during mainnet (I declare this - Jayant)
  // {
  //   address: "0xf7b2f7B8B4E3c6E5e3c3E5e3c3E5e3c3E5e3c3E5" as Address,
  //   symbol: "USDT",
  //   name: "Tether USD",
  //   decimals: 6,
  // },
  // {
  //   address: "0xf7b2f7B8B4E3c6E5e3c3E5e3c3E5e3c3E5e3c3E6" as Address,
  //   symbol: "WBTC",
  //   name: "Wrapped Bitcoin",
  //   decimals: 8,
  // },
  // {
  //   address: "0xf7b2f7B8B4E3c6E5e3c3E5e3c3E5e3c3E5e3c3E7" as Address,
  //   symbol: "LINK",
  //   name: "Chainlink",
  //   decimals: 18,
  // },
] as const;

// ERC20 ABI (minimal)
const ERC20_ABI = [
  {
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// WalnutV2 ABI (minimal)
const WALNUT_V2_ABI = [
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "deposit",
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

type DepositStep = "idle" | "approve_pending" | "approve_confirmed" | "deposit_pending" | "deposit_confirmed" | "error";

export default function DepositPage() {
  const account = useAccount();
  const publicClient = usePublicClient();
  const { addToast } = useToast();
  const protocol = useWalnutProtocol();
  const { tokenBalances, refreshBalances } = useTokenBalances();

  const [selectedToken, setSelectedToken] = useState<Address>(MOCK_USDC_ADDRESS);
  const [amount, setAmount] = useState("");
  const [depositStep, setDepositStep] = useState<DepositStep>("idle");
  const [approveTxHash, setApproveTxHash] = useState<string | null>(null);
  const [depositTxHash, setDepositTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Get token info
  const tokenInfo = useMemo(() => {
    // First try to find from wallet balances
    const fromBalances = tokenBalances.find((t) => t.token.toLowerCase() === selectedToken.toLowerCase());
    if (fromBalances) return fromBalances;
    
    // Fallback to supported tokens list
    const fromSupported = SUPPORTED_TOKENS.find((t) => t.address.toLowerCase() === selectedToken.toLowerCase());
    if (fromSupported) {
      return {
        token: fromSupported.address,
        symbol: fromSupported.symbol,
        decimals: fromSupported.decimals,
        balance: 0n,
      };
    }
    
    return undefined;
  }, [tokenBalances, selectedToken]);

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

  // Check current allowance
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: selectedToken,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account.address ?? "0x0000000000000000000000000000000000000000", WALNUT_V2_ADDRESS],
    query: {
      enabled: Boolean(account.address),
    },
  });

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

  // Check if approval is needed
  const needsApproval = useMemo(() => {
    if (parsedAmount === 0n) return false;
    if (!currentAllowance) return true; // Need approval if allowance is undefined
    return currentAllowance < parsedAmount;
  }, [currentAllowance, parsedAmount]);

  // Approve contract
  const { writeContractAsync: approveAsync } = useWriteContract();
  const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({
    hash: approveTxHash as `0x${string}` | undefined,
  });

  // Deposit contract
  const { writeContractAsync: depositAsync } = useWriteContract();
  const { isLoading: isDepositConfirming } = useWaitForTransactionReceipt({
    hash: depositTxHash as `0x${string}` | undefined,
  });

  // Handle approve
  const handleApprove = async () => {
    if (!account.address || parsedAmount === 0n) return;

    try {
      setDepositStep("approve_pending");
      setErrorMessage(null);

      // Fetch current gas price with buffer
      const gasPrice = await publicClient?.getGasPrice();
      const bufferedMaxFeePerGas = gasPrice ? (gasPrice * 150n) / 100n : undefined; // +50% buffer
      const maxPriorityFeePerGas = 1000000n; // 0.001 gwei tip

      const hash = await approveAsync({
        address: selectedToken,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [WALNUT_V2_ADDRESS, parsedAmount],
        chain: arbitrumSepolia,
        account: account.address,
        gas: 100000n, // Explicit gas limit for approval
        maxFeePerGas: bufferedMaxFeePerGas,
        maxPriorityFeePerGas,
      });

      setApproveTxHash(hash);
      addToast({ variant: "pending", message: "Approve transaction submitted..." });

      // Wait for confirmation
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      setDepositStep("approve_confirmed");
      addToast({ variant: "success", message: "Approval confirmed! Proceeding to deposit..." });

      // Refetch allowance
      await refetchAllowance();

      // Automatically proceed to deposit
      setTimeout(() => {
        void handleDeposit();
      }, 500);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Approval failed";
      setErrorMessage(message);
      setDepositStep("error");
      addToast({ variant: "error", message });
    }
  };

  // Handle deposit (with auto-approval if needed)
  const handleDeposit = async () => {
    if (!account.address || parsedAmount === 0n) return;

    try {
      // Fetch current gas price with buffer to avoid race conditions
      const gasPrice = await publicClient?.getGasPrice();
      const bufferedMaxFeePerGas = gasPrice ? (gasPrice * 150n) / 100n : undefined; // +50% buffer
      const maxPriorityFeePerGas = 1000000n; // 0.001 gwei tip

      // Check if approval is needed first
      if (needsApproval) {
        setDepositStep("approve_pending");
        setErrorMessage(null);

        const approveHash = await approveAsync({
          address: selectedToken,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [WALNUT_V2_ADDRESS, parsedAmount],
          chain: arbitrumSepolia,
          account: account.address,
          gas: 100000n, // Explicit gas limit for approval
          maxFeePerGas: bufferedMaxFeePerGas,
          maxPriorityFeePerGas,
        });

        setApproveTxHash(approveHash);
        addToast({ variant: "pending", message: "Approving tokens..." });

        // Wait for approval confirmation
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }

        setDepositStep("approve_confirmed");
        addToast({ variant: "success", message: "Approval confirmed! Proceeding to deposit..." });

        // Refetch allowance
        await refetchAllowance();

        // Small delay to ensure state updates
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Fetch gas price again for deposit (in case it changed)
      const depositGasPrice = await publicClient?.getGasPrice();
      const depositBufferedMaxFeePerGas = depositGasPrice ? (depositGasPrice * 150n) / 100n : undefined;

      // Now proceed with deposit
      setDepositStep("deposit_pending");
      setErrorMessage(null);

      const hash = await depositAsync({
        address: WALNUT_V2_ADDRESS,
        abi: WALNUT_V2_ABI,
        functionName: "deposit",
        args: [selectedToken, parsedAmount],
        chain: arbitrumSepolia,
        account: account.address,
        gas: 500000n, // Explicit gas limit for deposit
        maxFeePerGas: depositBufferedMaxFeePerGas,
        maxPriorityFeePerGas,
      });

      setDepositTxHash(hash);
      addToast({ variant: "pending", message: "Deposit transaction submitted..." });

      // Wait for confirmation
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      setDepositStep("deposit_confirmed");
      addToast({ variant: "success", message: "Deposit confirmed!" });

      // Refresh balances
      await refreshBalances();
      await protocol.refreshBalances();

      // Reset form
      setAmount("");
      setApproveTxHash(null);
      setDepositTxHash(null);

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setDepositStep("idle");
      }, 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Deposit failed";
      setErrorMessage(message);
      setDepositStep("error");
      addToast({ variant: "error", message });
    }
  };

  // Handle user cancellation
  const handleCancel = () => {
    setDepositStep("idle");
    setApproveTxHash(null);
    setDepositTxHash(null);
    setErrorMessage(null);
  };

  // Determine button state
  const isProcessing = depositStep === "approve_pending" || depositStep === "deposit_pending" || isApproveConfirming || isDepositConfirming;
  const canSubmit = parsedAmount > 0n && !isProcessing && depositStep !== "deposit_confirmed";

  return (
    <div className="space-y-6">
      <GlassPanel className="walnut-hero">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Deposit Collateral</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Add Collateral</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Deposit real ERC20 tokens as collateral. Approve tokens first, then deposit to your Walnut position.
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
              <p className="walnut-label">Deposit Studio</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Select token, enter amount, approve, and deposit.
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
            <label htmlFor="deposit-amount" className="mb-2 block text-sm text-foreground">
              Amount
            </label>
            <Input
              id="deposit-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
              className="h-12 border-black/10 bg-white text-lg text-foreground placeholder:text-muted-foreground/80"
              disabled={isProcessing}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Balance: {tokenInfo ? (Number(tokenInfo.balance) / 10 ** tokenInfo.decimals).toFixed(2) : "0.00"} {tokenInfo?.symbol}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { label: "100", value: "100" },
              { label: "500", value: "500" },
              { label: "1000", value: "1000" },
              { label: "5000", value: "5000" },
            ].map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant="outline"
                className="glass-chip"
                onClick={() => setAmount(option.value)}
                disabled={isProcessing}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {/* Transaction Status */}
          {depositStep !== "idle" && (
            <div className="rounded-lg border border-black/10 bg-white/50 p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Transaction Progress</p>
              
              {/* Approve Step */}
              <div className="flex items-center gap-3">
                {depositStep === "approve_pending" || isApproveConfirming ? (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                ) : depositStep === "approve_confirmed" || depositStep === "deposit_pending" || depositStep === "deposit_confirmed" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : depositStep === "error" && approveTxHash ? (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                )}
                <div className="flex-1">
                  <p className="text-sm text-foreground">1. Approve Tokens</p>
                  {approveTxHash && (
                    <a
                      href={`https://sepolia.arbiscan.io/tx/${approveTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline"
                    >
                      View on Arbiscan
                    </a>
                  )}
                </div>
              </div>

              {/* Deposit Step */}
              <div className="flex items-center gap-3">
                {depositStep === "deposit_pending" || isDepositConfirming ? (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                ) : depositStep === "deposit_confirmed" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : depositStep === "error" && depositTxHash ? (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                )}
                <div className="flex-1">
                  <p className="text-sm text-foreground">2. Deposit to Walnut</p>
                  {depositTxHash && (
                    <a
                      href={`https://sepolia.arbiscan.io/tx/${depositTxHash}`}
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

          <div className="flex flex-wrap gap-2">
            <Button
              className="glass-button bg-accent text-accent-foreground hover:bg-accent/85"
              onClick={handleDeposit}
              disabled={!canSubmit}
            >
              {needsApproval ? `Approve & Deposit` : `Deposit`}
            </Button>
            {(depositStep === "error") && (
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
            <p className="walnut-meta">Real-time USD value of deposit amount</p>
          </GlassPanel>

          <GlassPanel className="walnut-card walnut-card-strong walnut-kpi-card">
            <p className="walnut-label">Token Balance</p>
            <p className="walnut-value">
              {tokenInfo ? (Number(tokenInfo.balance) / 10 ** tokenInfo.decimals).toFixed(2) : "0.00"}
            </p>
            <p className="walnut-meta">Your wallet balance of {tokenInfo?.symbol}</p>
          </GlassPanel>

          <GlassPanel className="walnut-card">
            <p className="walnut-label">Status</p>
            <p className="mt-2 text-sm text-foreground">
              {depositStep === "idle" && needsApproval && "Approval required before deposit"}
              {depositStep === "idle" && !needsApproval && parsedAmount > 0n && "Ready to deposit"}
              {depositStep === "idle" && parsedAmount === 0n && "Enter amount to continue"}
              {depositStep === "approve_pending" && "Approving tokens..."}
              {depositStep === "approve_confirmed" && "Approval confirmed!"}
              {depositStep === "deposit_pending" && "Depositing to Walnut..."}
              {depositStep === "deposit_confirmed" && "Deposit successful!"}
              {depositStep === "error" && "Transaction failed"}
            </p>
          </GlassPanel>
        </div>
      </div>

      <SystemStatusPanel protocol={protocol} />
    </div>
  );
}
