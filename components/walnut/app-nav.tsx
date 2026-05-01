"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccountModal, useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownLink, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Navigation structure with icons
const navigationGroups = {
  portfolio: [
    { 
      label: "Deposit", 
      href: "/app/deposit", 
      description: "Add collateral",
      icon: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
      )
    },
    { 
      label: "Withdraw", 
      href: "/app/withdraw", 
      description: "Remove assets",
      icon: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14" />
        </svg>
      )
    },
  ],
  loans: [
    { 
      label: "Borrow", 
      href: "/app/borrow", 
      description: "Take a loan",
      icon: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <path d="M9 12h6" />
        </svg>
      )
    },
    { 
      label: "Repay", 
      href: "/app/repay", 
      description: "Pay back debt",
      icon: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      )
    },
  ],
  more: [
    { 
      label: "Liquidation", 
      href: "/app/liquidation", 
      description: "Manage liquidations",
      icon: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    { 
      label: "P2P", 
      href: "/app/p2p", 
      description: "Peer-to-peer lending",
      icon: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      )
    },
    { 
      label: "History", 
      href: "/app/history", 
      description: "Transaction history",
      icon: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )
    },
    { 
      label: "Settings", 
      href: "/app/settings", 
      description: "App preferences",
      icon: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24" />
        </svg>
      )
    },
  ],
};

// Flat list for mobile
const allLinks = [
  { label: "Dashboard", href: "/app" },
  ...navigationGroups.portfolio,
  ...navigationGroups.loans,
  ...navigationGroups.more,
];

function trimAddress(address: string | undefined) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-60">
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function AppNav() {
  const pathname = usePathname();
  const { address, isConnected, status } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();

  const isWalletReady = Boolean(isConnected && address);
  const isReconnecting = status === "reconnecting" || (isConnected && !address);

  const walletLabel = isReconnecting ? "Reconnecting..." : trimAddress(address);

  const isInGroup = (group: typeof navigationGroups.portfolio) => {
    return group.some((link) => pathname === link.href);
  };

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-white/82 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <Link href="/" className="font-display text-xl tracking-tight text-foreground">
            Walnut
          </Link>
          <span className="hidden rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground md:inline">
            Private Lending
          </span>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 rounded-full border border-black/10 bg-white/90 p-1 lg:flex">
          {/* Dashboard */}
          <Link
            href="/app"
            className={cn(
              "rounded-full px-3 py-1.5 text-sm transition-colors",
              pathname === "/app"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-black/5 hover:text-foreground"
            )}
          >
            Dashboard
          </Link>

          {/* Portfolio Dropdown */}
          <DropdownMenu
            trigger={
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition-colors",
                  isInGroup(navigationGroups.portfolio)
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-black/5 hover:text-foreground"
                )}
              >
                Portfolio
                <ChevronDownIcon />
              </span>
            }
          >
            {navigationGroups.portfolio.map((link) => (
              <DropdownLink key={link.href} href={link.href} description={link.description} icon={<link.icon />}>
                {link.label}
              </DropdownLink>
            ))}
          </DropdownMenu>

          {/* Loans Dropdown */}
          <DropdownMenu
            trigger={
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition-colors",
                  isInGroup(navigationGroups.loans)
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-black/5 hover:text-foreground"
                )}
              >
                Loans
                <ChevronDownIcon />
              </span>
            }
          >
            {navigationGroups.loans.map((link) => (
              <DropdownLink key={link.href} href={link.href} description={link.description} icon={<link.icon />}>
                {link.label}
              </DropdownLink>
            ))}
          </DropdownMenu>

          {/* More Dropdown */}
          <DropdownMenu
            trigger={
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition-colors",
                  isInGroup(navigationGroups.more)
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-black/5 hover:text-foreground"
                )}
              >
                More
                <ChevronDownIcon />
              </span>
            }
          >
            {navigationGroups.more.map((link) => (
              <DropdownLink key={link.href} href={link.href} description={link.description} icon={<link.icon />}>
                {link.label}
              </DropdownLink>
            ))}
          </DropdownMenu>
        </nav>

        {/* Wallet Section */}
        <div className="flex items-center gap-2">
          {isWalletReady ? (
            <DropdownMenu
              align="right"
              trigger={
                <span className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-black/5">
                  {walletLabel}
                  <ChevronDownIcon />
                </span>
              }
            >
              <DropdownItem onClick={handleCopyAddress} icon={<CopyIcon />}>
                Copy Address
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem onClick={() => openAccountModal?.()} icon={<LogoutIcon />}>
                Manage Wallet
              </DropdownItem>
            </DropdownMenu>
          ) : (
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/85"
              disabled={!openConnectModal || isReconnecting}
              onClick={() => openConnectModal?.()}
            >
              {isReconnecting ? "Reconnecting..." : "Connect Wallet"}
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="border-t border-black/8 lg:hidden">
        <div className="mx-auto w-full max-w-6xl overflow-x-auto px-4 sm:px-6">
          <nav className="flex min-w-max items-center gap-2 py-2">
            {allLinks.map((link) => {
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
