import type { ReactNode } from "react";

import { AppNav } from "@/components/walnut/app-nav";

export default function WalnutAppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden walnut-surface">
      <div className="walnut-aurora pointer-events-none" />
      <AppNav />
      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
