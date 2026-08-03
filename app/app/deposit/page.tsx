"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import type { Address } from "viem";
import { Encryptable } from "@cofhe/sdk";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";
import { useTokenBalances } from "@/hooks/use-token-balances";
import { useToast } from "@/components/walnut/toast-provider";
import { wagmiConfig } from "@/lib/web3-config";
import {
  walnutChainId,
  walnutLendingAbi,
  walnutContractAddress as WALNUT_LENDING_ADDRESS,
  walnutMockUsdcAddress as MOCK_USDC_ADDRESS,
  walnutOracleAddress as ORACLE_ADDRESS,
} from "@/lib/walnut-contract";

const targetChainName =
  wagmiConfig.chains.find((chain) => chain.id === walnutChainId)?.name ??
  `Chain ${walnutChainId}`;

const SUPPORTED_TOKENS = [
  { address: MOCK_USDC_ADDRESS, symbol: "USDC", name: "USD Coin", decimals: 6 },
  { address: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73" as Address, symbol: "WETH", name: "Wrapped Ethereum", decimals: 18 },
  { address: "0x152b0df80135c63b4cb1fbe00ddce7e9a8ffcb04" as Address, symbol: "LINK", name: "Chainlink Token", decimals: 18 },
] as const;

function TokenBadge({ symbol, name }: { symbol: string; name?: string }) {
  // Reuse same token images as the dashboard (CoinGecko CDN), fallback to local /tokens/{symbol}.png
  const TOKEN_IMAGES: Record<string, string> = {
    USDC: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png",
    cUSDC: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png",
    WETH: "https://assets.coingecko.com/coins/images/2518/standard/weth.png",
    LINK: "https://assets.coingecko.com/coins/images/877/large/chainlink.png",
  };
  const src = TOKEN_IMAGES[symbol] ?? `/tokens/${symbol.toLowerCase()}.png`;
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    // reset error state when source changes so the badge will retry loading
    setImgError(false);
  }, [src]);

  // debug info (dev only)
  if (process.env.NODE_ENV === 'development') console.debug(`[TokenBadge] symbol=${symbol} src=${src} imgError=${imgError}`);
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-sm hover:scale-105 transition-transform cursor-pointer overflow-hidden bg-slate-100 border border-slate-200">
        {!imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`${symbol} logo`} onError={() => setImgError(true)} className="w-full h-full object-cover" />
        ) : (
          <div className="text-xs font-bold text-slate-500">{symbol.slice(0, 3)}</div>
        )}
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-900">{symbol}</div>
        <div className="text-xs text-muted-foreground">{name}</div>
      </div>
    </div>
  );
}

function TokenDropdown({ value, onChange, className }: { value: Address; onChange: (a: Address) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (e.target instanceof Node && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selected = SUPPORTED_TOKENS.find((t) => t.address.toLowerCase() === value.toLowerCase()) ?? SUPPORTED_TOKENS[0];

  return (
    <div ref={ref} className={`${className} relative`}>
      <button type="button" onClick={() => setOpen((s) => !s)} className="w-full flex items-center justify-between gap-3 p-2 border rounded shadow-sm bg-white">
        <div className="flex items-center gap-3">
          <TokenBadge symbol={selected.symbol} name={selected.name} />
        </div>
        <div className="text-sm text-muted-foreground">▾</div>
      </button>

      {open && (
        <div className="absolute z-40 mt-2 w-full rounded border bg-white shadow-lg">
          {SUPPORTED_TOKENS.map((t) => (
            <button
              key={t.address}
              onClick={() => { onChange(t.address); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-3"
            >
              <TokenBadge symbol={t.symbol} name={t.name} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const ERC20_ABI = [
  { inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], name: "approve", outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], name: "allowance", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "decimals", outputs: [{ name: "", type: "uint8" }], stateMutability: "view", type: "function" },
] as const;

// WALNUT_V2_ABI removed in favor of imported walnutLendingAbi

const ORACLE_ABI = [
  { inputs: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }], name: "getUSDValue", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
] as const;

type DepositStep = "idle" | "approve_pending" | "approve_confirmed" | "deposit_pending" | "deposit_confirmed" | "error";

function assertSuccessReceipt(receipt: { status?: "success" | "reverted" }) {
  if (receipt.status && receipt.status !== "success") throw new Error("Transaction reverted on-chain.");
}

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

  const tokenInfo = useMemo(() => {
    const fromBalances = tokenBalances.find((t) => t.token.toLowerCase() === selectedToken.toLowerCase());
    if (fromBalances) return fromBalances;
    const fromSupported = SUPPORTED_TOKENS.find((t) => t.address.toLowerCase() === selectedToken.toLowerCase());
    if (fromSupported) return { token: fromSupported.address, symbol: fromSupported.symbol, decimals: fromSupported.decimals, balance: 0n };
    return undefined;
  }, [tokenBalances, selectedToken]);

  const parsedAmount = useMemo(() => {
    if (!amount || !/^\d+(\.\d+)?$/.test(amount)) return 0n;
    try {
      const decimals = tokenInfo?.decimals ?? 6;
      const parts = amount.split('.');
      const integerPart = parts[0] || '0';
      const decimalPart = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals);
      return BigInt(integerPart + decimalPart);
    } catch { return 0n; }
  }, [amount, tokenInfo]);

  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({ address: selectedToken, abi: ERC20_ABI, functionName: 'allowance', args: [account.address ?? '0x0000000000000000000000000000000000000000', WALNUT_LENDING_ADDRESS], query: { enabled: Boolean(account.address) } });

  const { data: usdValue } = useReadContract({ address: ORACLE_ADDRESS, abi: ORACLE_ABI, functionName: 'getUSDValue', args: [selectedToken, parsedAmount], query: { enabled: parsedAmount > 0n } });

  const formattedUsdValue = useMemo(() => {
    if (!usdValue || usdValue === 0n) return '$0.00';
    const value = Number(usdValue) / 1e6;
    return `$${value.toFixed(2)}`;
  }, [usdValue]);

  const needsApproval = useMemo(() => {
    if (parsedAmount === 0n) return false;
    if (!currentAllowance) return true;
    return currentAllowance < parsedAmount;
  }, [currentAllowance, parsedAmount]);

  const { writeContractAsync: approveAsync } = useWriteContract();
  const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({ hash: approveTxHash as `0x${string}` | undefined });
  const { writeContractAsync: depositAsync } = useWriteContract();
  const { isLoading: isDepositConfirming } = useWaitForTransactionReceipt({ hash: depositTxHash as `0x${string}` | undefined });

  const handleDeposit = async () => {
    if (!account.address || parsedAmount === 0n) return;
    try {
      // Get current gas price from network
      const gasPrice = await publicClient?.getGasPrice();
      const maxFeePerGas = gasPrice ? (gasPrice * 150n) / 100n : undefined; // 50% buffer
      const maxPriorityFeePerGas = gasPrice ? (gasPrice * 10n) / 100n : undefined; // 10% of base as tip
      
      if (needsApproval) {
        setDepositStep('approve_pending');
        setErrorMessage(null);
        
        let approveGasLimit;
        try {
          const estimatedGas = await publicClient?.estimateContractGas({
            address: selectedToken as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [WALNUT_LENDING_ADDRESS, parsedAmount],
            account: account.address,
          });
          if (estimatedGas) {
            approveGasLimit = (estimatedGas * 130n) / 100n; // 30% buffer
          }
        } catch (e) {
          console.warn("Approve gas estimation failed", e);
        }

        const approveHash = await approveAsync({ 
          address: selectedToken, 
          abi: ERC20_ABI, 
          functionName: 'approve', 
          args: [WALNUT_LENDING_ADDRESS, parsedAmount],
          maxFeePerGas,
          maxPriorityFeePerGas,
          gas: approveGasLimit
        });
        setApproveTxHash(approveHash);
        addToast({ variant: 'pending', message: 'Approving tokens...' });
        if (publicClient) {
          const receipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
          assertSuccessReceipt(receipt);
        }
        setDepositStep('approve_confirmed');
        await refetchAllowance();
      }

      setDepositStep('deposit_pending');

      let encryptedAmountVal;
      try {
        const [encAmount] = await protocol.encryptor.encryptInputsAsync({
          items: [Encryptable.uint128(parsedAmount)],
          account: account.address,
          chainId: walnutChainId,
        });
        encryptedAmountVal = encAmount;
      } catch (err) {
        console.error("FHE Encryption failed", err);
        throw new Error("Collateral encryption failed. Please make sure your wallet supports FHE encryption.");
      }
      
      let depositGasLimit;
      try {
        const estimatedGas = await publicClient?.estimateContractGas({
          address: WALNUT_LENDING_ADDRESS,
          abi: walnutLendingAbi,
          functionName: 'deposit',
          args: [selectedToken, encryptedAmountVal as any],
          account: account.address,
        });
        if (estimatedGas) {
          depositGasLimit = (estimatedGas * 130n) / 100n; // 30% buffer
        }
      } catch (e) {
        console.warn("Deposit gas estimation failed", e);
        // Fallback to a very high safe value for FHE transactions if estimation reverts completely
        depositGasLimit = 15000000n;
      }

      const hash = await depositAsync({ 
        address: WALNUT_LENDING_ADDRESS, 
        abi: walnutLendingAbi, 
        functionName: 'deposit', 
        args: [selectedToken, encryptedAmountVal as any],
        maxFeePerGas,
        maxPriorityFeePerGas,
        gas: depositGasLimit
      });
      setDepositTxHash(hash);
      addToast({ variant: 'pending', message: 'Deposit submitted...' });
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        assertSuccessReceipt(receipt);
        // Sync decryption to execute ERC20 transfer and update collateral on-chain
        await protocol.syncDecryptResultsFromReceipt('deposit', receipt as any);
      }
      setDepositStep('deposit_confirmed');
      addToast({ variant: 'success', message: `Successfully deposited ${amount} ${tokenInfo?.symbol ?? 'USDC'} as collateral.` });
      await refreshBalances();
      await protocol.refreshBalances();
      setAmount('');
      setTimeout(() => setDepositStep('idle'), 2500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deposit failed';
      setErrorMessage(message);
      setDepositStep('error');
      addToast({ variant: 'error', message });
    }
  };

  const handleCancel = () => { setDepositStep('idle'); setApproveTxHash(null); setDepositTxHash(null); setErrorMessage(null); };

  const isProcessing = depositStep === 'approve_pending' || depositStep === 'deposit_pending' || isApproveConfirming || isDepositConfirming;
  const canSubmit = parsedAmount > 0n && !isProcessing && depositStep !== 'deposit_confirmed';

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Add Collateral</h1>
        <p className="text-sm text-muted-foreground">Deposit ERC20 tokens as collateral.</p>
      </header>

      <div className="border rounded-lg p-4">
        <div className="mb-3 text-sm font-medium">Status: Ready to deposit — {targetChainName}</div>

        <div className="grid gap-4 md:grid-cols-3">
          <section className="md:col-span-2 space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase text-muted-foreground">Select Token</label>
              <TokenDropdown className="mt-2 w-full" value={selectedToken} onChange={(addr: Address) => setSelectedToken(addr)} />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-muted-foreground">Amount</label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" className="mt-2 w-full" />
              <div className="text-xs text-muted-foreground mt-1">Wallet: {tokenInfo ? (Number(tokenInfo.balance) / 10 ** tokenInfo.decimals).toFixed(2) : '0.00'} {tokenInfo?.symbol}</div>
            </div>

            <div className="flex gap-2">
              {[100,500,1000,5000].map((v) => (
                <button key={v} onClick={() => setAmount(String(v))} disabled={isProcessing} className="px-3 py-1 border rounded">{v}</button>
              ))}
            </div>

            {depositStep !== 'idle' && (
              <div className="p-3 border rounded">
                <div className="font-medium">Transaction Progress</div>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    {depositStep === 'approve_pending' || isApproveConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : (depositStep === 'approve_confirmed' || depositStep === 'deposit_pending' || depositStep === 'deposit_confirmed' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <div className="h-4 w-4 rounded-full border" />)}
                    <div>1. Approve Tokens {approveTxHash && (<a href={`https://sepolia.arbiscan.io/tx/${approveTxHash}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600">View</a>)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {depositStep === 'deposit_pending' || isDepositConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : (depositStep === 'deposit_confirmed' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <div className="h-4 w-4 rounded-full border" />)}
                    <div>2. Deposit {depositTxHash && (<a href={`https://sepolia.arbiscan.io/tx/${depositTxHash}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600">View</a>)}</div>
                  </div>
                  {errorMessage && <div className="text-sm text-red-700">{errorMessage}</div>}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={handleDeposit} disabled={!canSubmit} className="px-4 py-2 bg-black text-white rounded">{needsApproval ? 'Approve & Deposit' : 'Deposit'}</button>
              {depositStep === 'error' && <button onClick={handleCancel} className="px-4 py-2 border rounded">Cancel</button>}
            </div>
          </section>

          <aside className="space-y-3">
            <div className="p-3 border rounded">
              <div className="text-xs font-mono uppercase text-muted-foreground">USD Value</div>
              <div className="font-mono text-lg font-semibold mt-2">{formattedUsdValue}</div>
            </div>

            <div className="p-3 border rounded">
              <div className="text-xs font-mono uppercase text-muted-foreground">Token Balance</div>
              <div className="font-mono text-lg font-semibold mt-2">{tokenInfo ? (Number(tokenInfo.balance) / 10 ** tokenInfo.decimals).toFixed(2) : '0.00'}</div>
            </div>

            <div className="p-3 border rounded">
              <div className="text-xs font-mono uppercase text-muted-foreground">Status</div>
              <div className="mt-2 text-sm">{depositStep === 'idle' && needsApproval && 'Approval required'}{depositStep === 'idle' && !needsApproval && parsedAmount > 0n && 'Ready to deposit'}</div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
