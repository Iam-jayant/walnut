"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "wagmi";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const appLinks = [
  { label: "Dashboard", href: "/app" },
  { label: "Onboard", href: "/app/onboard" },
  { label: "Deposit", href: "/app/deposit" },
  { label: "Borrow", href: "/app/borrow" },
  { label: "Repay", href: "/app/repay" },
  { label: "Demo", href: "/app/demo" },
  { label: "Settings", href: "/app/settings" },
];

function trimAddress(address: string | undefined) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function AppNav() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-display text-xl tracking-tight text-foreground">
            Walnut
          </Link>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          {appLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-black/5 hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-black/10 bg-white px-3 py-1 font-mono text-xs text-muted-foreground sm:inline">
            {trimAddress(address)}
          </span>
          {isConnected ? (
            <Button variant="outline" className="glass-button" onClick={() => disconnect()}>
              Disconnect
            </Button>
          ) : (
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/85"
              disabled={isConnecting || connectors.length === 0}
              onClick={() => connect({ connector: connectors[0] })}
            >
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
