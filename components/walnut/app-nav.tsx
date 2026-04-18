"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccountModal, useConnectModal } from "@rainbow-me/rainbowkit";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const appLinks = [
  { label: "Dashboard", href: "/app" },
  { label: "Deposit", href: "/app/deposit" },
  { label: "Borrow", href: "/app/borrow" },
  { label: "Repay", href: "/app/repay" },
  { label: "Withdraw", href: "/app/withdraw" },
  { label: "Settings", href: "/app/settings" },
];

function trimAddress(address: string | undefined) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function AppNav() {
  const pathname = usePathname();
  const { address, isConnected, status } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const [mounted, setMounted] = useState(false);

  const primaryLinks = appLinks.slice(0, 5);
  const utilityLinks = appLinks.slice(5);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isWalletReady = Boolean(isConnected && address);
  const isReconnecting = status === "reconnecting" || (isConnected && !address);

  const walletLabel = isReconnecting ? "Reconnecting..." : trimAddress(address);

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-white/82 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-display text-xl tracking-tight text-foreground">
            Walnut
          </Link>
          <span className="hidden rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground md:inline">
            Private Lending
          </span>
        </div>

        <nav className="hidden items-center rounded-full border border-black/10 bg-white/90 p-1 lg:flex">
          {primaryLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-black/5 hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="mx-1 h-5 w-px bg-black/10" />
          {utilityLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-black/5 hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {mounted ? (
            <>
              <span className="hidden rounded-full border border-black/10 bg-white px-3 py-1 font-mono text-xs text-muted-foreground xl:inline">
                {walletLabel}
              </span>
              {isWalletReady ? (
                <Button variant="outline" className="glass-button" onClick={() => openAccountModal?.()}>
                  Manage Wallet
                </Button>
              ) : (
                <Button
                  className="bg-accent text-accent-foreground hover:bg-accent/85"
                  disabled={!openConnectModal || isReconnecting}
                  onClick={() => openConnectModal?.()}
                >
                  {isReconnecting ? "Reconnecting..." : "Connect Wallet"}
                </Button>
              )}
            </>
          ) : (
            <div className="h-10 w-32 animate-pulse rounded-md bg-gray-200" />
          )}
        </div>
      </div>

      <div className="border-t border-black/8 lg:hidden">
        <div className="mx-auto w-full max-w-6xl overflow-x-auto px-4 sm:px-6">
          <nav className="flex min-w-max items-center gap-2 py-2">
            {appLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "border border-black/10 bg-white/85 text-muted-foreground"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
