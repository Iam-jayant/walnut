import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Blocks,
  EyeOff,
  Gauge,
  HandCoins,
  Layers3,
  LockKeyhole,
  Network,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { Navigation } from "@/components/landing/navigation";
import { FooterSection } from "@/components/landing/footer-section";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Vision - Walnut Protocol",
  description:
    "Why Walnut believes private credit is the next major onchain category, and how encrypted lending can attract users, capital, and applications.",
};

const pillars = [
  {
    icon: EyeOff,
    title: "Privacy is a distribution advantage",
    body:
      "Most onchain lending leaks every balance, liquidation point, and borrowing habit. Walnut turns privacy into a reason to join, stay, and build.",
  },
  {
    icon: Gauge,
    title: "Better UX creates better retention",
    body:
      "When users can borrow without broadcasting their risk profile, the product feels safer, more premium, and closer to how real credit should work.",
  },
  {
    icon: Users,
    title: "Products grow when more people can say yes",
    body:
      "Walnut is designed for traders, founders, funds, power users, and teams that want onchain leverage without public financial exposure.",
  },
  {
    icon: Blocks,
    title: "The app is only the first surface",
    body:
      "The long game is infrastructure: a lending core, encrypted stable balances, private settlement, and developer primitives other products can plug into.",
  },
];

const expansionCards = [
  {
    icon: LockKeyhole,
    title: "Private credit becomes a category",
    body:
      "Walnut makes encrypted borrowing legible to everyday users. The moment private lending feels usable, a new class of DeFi products can form around it.",
  },
  {
    icon: HandCoins,
    title: "Capital stops behaving like a public performance",
    body:
      "Borrowers should not need to expose collateral size, debt utilization, or changing health factors just to access liquidity onchain.",
  },
  {
    icon: ShieldCheck,
    title: "Risk stays computable without becoming visible",
    body:
      "Collateral checks, interest, and credit tiers can still run continuously. Walnut proves the protocol can enforce discipline without exposing the user.",
  },
  {
    icon: Network,
    title: "Apps get a cleaner foundation to integrate",
    body:
      "Wallets, interfaces, structured credit products, and private treasury tooling can build on Walnut without reinventing encrypted accounting from scratch.",
  },
  {
    icon: Layers3,
    title: "Every new primitive compounds the story",
    body:
      "Encrypted collateral, private debt, sealed-bid liquidations, permit-based decryption, and wallet linking are not isolated features. They form a full private credit stack.",
  },
  {
    icon: Sparkles,
    title: "The product is built to feel ahead of the market",
    body:
      "Walnut is not trying to make old lending prettier. It is trying to make private, programmable credit feel like the obvious next default.",
  },
];

const momentumPoints = [
  "Confidential positions give users a reason to move meaningful activity onchain.",
  "A clearer product story helps Walnut attract curious users, builders, and ecosystem partners.",
  "Developer-facing primitives widen the surface area for integration and secondary distribution.",
  "Each successful use case strengthens the broader case for private financial infrastructure.",
];

const roadmapPhases = [
  {
    phase: "Phase 1",
    title: "Mainnet launch",
    timeline: "Q3 2025",
    items: [
      "Deploy on Arbitrum One with real USDC after independent security audit",
      "Replace MockUSDC with Circle's production contract (address swap, zero code changes)",
      "Switch to Chainlink mainnet price feeds",
      "Multisig ownership for all admin functions",
      "Bug bounty program"
    ]
  },
  {
    phase: "Phase 2",
    title: "Token expansion",
    timeline: "Q3–Q4 2025",
    items: [
      "Add WBTC, WETH, DAI, USDT as supported collateral",
      "Integrate additional Chainlink feeds as they become available on mainnet",
      "Tiered collateral factors per token (ETH: 80% LTV, BTC: 75%, stablecoins: 90%)",
      "Isolated lending markets per collateral type"
    ]
  },
  {
    phase: "Phase 3",
    title: "Multichain",
    timeline: "Q4 2025",
    items: [
      "Deploy on Base, Optimism, and Polygon as CoFHE coprocessor expands",
      "Unified position management across chains",
      "Cross-chain collateral bridging (encrypted balances portable across deployments)"
    ]
  },
  {
    phase: "Phase 4",
    title: "Lender yield and protocol economics",
    timeline: "Q1 2026",
    items: [
      "Lender deposit pools go live — suppliers earn 6% base APY (currently only borrow side exists)",
      "Liquidity mining: early depositors earn protocol fee share for bootstrapping TVL",
      "Referral system: users who bring verified borrowers earn a cut of their interest — privately tracked on-chain via encrypted counters",
      "Sealed yield distribution: lender earnings settled privately via Privara, same as borrower interest today",
      "Protocol treasury accumulates 2% spread between borrow APR (8%) and supply APY (6%)"
    ]
  },
  {
    phase: "Phase 5",
    title: "Institutional rails",
    timeline: "Q2 2026",
    items: [
      "Permissioned pools for institutional depositors with KYC gating",
      "Auditor permits for compliance teams (pool solvency visible, individual positions never)",
      "Private credit lines for DAOs and protocols",
      "Whitelist-based under-collateralized lending for verified institutional borrowers"
    ]
  },
  {
    phase: "Phase 6",
    title: "Full privacy stack",
    timeline: "Q3 2026",
    items: [
      "Client-side amount encryption for true collateral confidentiality (removes trivial encryption constraint)",
      "Private liquidation notifications — borrowers receive encrypted alerts before health factor breach",
      "Zero-knowledge identity layer for credit scoring without wallet linking"
    ]
  }
];

const budgetItems = [
  { area: "Security audit", amount: 80000, suffix: "", description: "Independent audit by Trail of Bits or Spearbit — mandatory before mainnet" },
  { area: "Legal and compliance", amount: 60000, suffix: "", description: "Protocol structure, jurisdiction, regulatory clarity for lending products" },
  { area: "Core team", amount: 300000, suffix: " / yr", description: "2 engineers + 1 business co-founder salaries (18-month runway)" },
  { area: "User acquisition", amount: 120000, suffix: "", description: "Liquidity mining, referral rewards, community building" },
  { area: "Infrastructure", amount: 30000, suffix: " / yr", description: "RPC nodes, monitoring, DevOps, Vercel Pro" },
  { area: "Marketing and BD", amount: 80000, suffix: "", description: "Protocol partnerships, DeFi integrations, ecosystem presence" },
  { area: "Bug bounty", amount: 30000, suffix: "", description: "Immunefi program to surface vulnerabilities before they are exploited" },
];

export default function VisionPage() {
  return (
    <>
      <Navigation />
      <main className="relative min-h-screen overflow-hidden bg-[#fcfcfb] text-black">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.04)_1px,transparent_1px)] bg-[size:56px_56px] opacity-60" />
          <div className="absolute left-[-12rem] top-[8rem] h-[28rem] w-[28rem] rounded-full bg-[#0AD9DC]/15 blur-[120px]" />
          <div className="absolute right-[-8rem] top-[6rem] h-[24rem] w-[24rem] rounded-full bg-black/6 blur-[120px]" />
          <div className="absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95),transparent_70%)]" />
        </div>

        <section className="relative mx-auto max-w-7xl px-6 pt-34 pb-12 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-3 rounded-full border border-black/10 bg-white/85 px-4 py-2 text-[11px] font-mono uppercase tracking-[0.18em] text-black/55 shadow-[0_12px_30px_rgba(0,0,0,0.05)] backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0AD9DC]" />
                Future of private credit
              </div>

              <h1 className="max-w-4xl text-[clamp(2.7rem,11vw,5.75rem)] font-semibold leading-[0.94] tracking-tight text-black sm:text-[clamp(3rem,6vw,5.75rem)]">
                <span className="block">The future of</span>
                <span className="block">lending</span>
                <span className="mt-1 block text-[#0ABFC2] sm:hidden">should not</span>
                <span className="block text-[#0ABFC2] sm:hidden">be public</span>
                <span className="block text-[#0ABFC2] sm:hidden">by default.</span>
                <span className="mt-1 hidden text-[#0ABFC2] sm:block">should not be</span>
                <span className="hidden text-[#0ABFC2] sm:block">public by default.</span>
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-black/62">
                Walnut is the thesis that private credit can become one of the strongest user-acquisition
                stories in crypto. Better privacy creates better products, better products attract real users,
                and real users create the traction that turns infrastructure into a category.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-full bg-black px-7 text-sm font-semibold text-white hover:bg-black/90"
                >
                  <Link href="/app">
                    Launch Walnut
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-full border-black/12 bg-white/90 px-7 text-sm font-semibold hover:bg-white"
                >
                  <Link href="/docs">Read the docs</Link>
                </Button>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {[
                  ["Encrypted positions", "Collateral, debt, and risk signals stay private."],
                  ["Composable growth", "Built for apps, wallets, and protocol integrations."],
                  ["Category pull", "Private credit can widen who feels comfortable onchain."],
                ].map(([title, body]) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-black/10 bg-white/78 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.05)] backdrop-blur-sm"
                  >
                    <p className="text-sm font-semibold text-black">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-black/58">{body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_50%_25%,rgba(10,217,220,0.18),transparent_55%)] blur-2xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-black/10 bg-white/78 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.08)] backdrop-blur-xl">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-black/45">
                      Walnut system view
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-black">
                      Built for the next wave of onchain users
                    </h2>
                  </div>
                  <Image
                    src="/svg logo of walnut.svg"
                    alt="Walnut"
                    width={160}
                    height={90}
                    className="h-16.5 w-auto opacity-90"
                  />
                </div>

                <div className="mt-8 space-y-4">
                  {[
                    ["Private collateral", "Balances stay encrypted while the protocol still computes limits."],
                    ["Private debt", "Borrow activity remains useful to the app without becoming public data."],
                    ["Credit progression", "Reputation can compound without exposing financial history."],
                    ["Sealed liquidations", "Risk resolution happens without open, extractive bidding surfaces."],
                  ].map(([title, body], index) => (
                    <div
                      key={title}
                      className="rounded-2xl border border-black/10 bg-[#f8f8f6] p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0AD9DC]/14 text-xs font-semibold text-[#067f83]">
                          0{index + 1}
                        </div>
                        <p className="text-sm font-semibold text-black">{title}</p>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-black/56">{body}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-2xl border border-[#0AD9DC]/20 bg-[#0AD9DC]/8 px-4 py-3 text-sm leading-6 text-black/68">
                  The thesis is simple: if onchain finance feels safer and more dignified, more people will use it.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-7xl px-6 py-8 lg:px-10">
          <div className="rounded-[2rem] border border-black/10 bg-white/82 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.06)] backdrop-blur-sm lg:p-8">
            <div className="mb-8 max-w-2xl">
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-black/42">
                Why this matters
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-black">
                Walnut is not selling privacy as decoration. It is building growth around it.
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {pillars.map((item) => {
                const Icon = item.icon;

                return (
                  <article
                    key={item.title}
                    className="rounded-[1.5rem] border border-black/10 bg-[#fcfcfb] p-6 transition-transform duration-200 hover:-translate-y-1"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0AD9DC]/12 text-[#07898d]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-2xl font-semibold tracking-tight text-black">{item.title}</h3>
                    <p className="mt-3 text-base leading-7 text-black/60">{item.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-7xl px-6 py-8 lg:px-10">
          <div className="mb-8 max-w-3xl">
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-black/42">
              Product expansion
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-black">
              A vision page should feel like a product map, not a slogan wall.
            </h2>
            <p className="mt-4 text-base leading-7 text-black/60">
              Walnut already has the bones of a bigger platform story: private balances, risk computation,
              encrypted stable assets, settlement rails, and integration surfaces that can pull in more users over time.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {expansionCards.map((item) => {
              const Icon = item.icon;

              return (
                <article
                  key={item.title}
                  className="rounded-[1.6rem] border border-black/10 bg-white/82 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.05)] backdrop-blur-sm"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-2xl font-semibold tracking-tight text-black">{item.title}</h3>
                  <p className="mt-3 text-base leading-7 text-black/60">{item.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="relative mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <div className="rounded-[2rem] border border-black/10 bg-white/82 p-8 shadow-[0_24px_60px_rgba(0,0,0,0.06)] backdrop-blur-sm lg:p-12">
            <div className="grid gap-10 lg:grid-cols-[1fr_400px]">
              <div>
                <span className="inline-flex items-center gap-3 rounded-full border border-[#0ABFC2]/30 bg-[#0AD9DC]/10 px-4 py-2 text-[11px] font-mono uppercase tracking-[0.18em] text-[#067f83] font-semibold">
                  Walnut Beyond the Buildathon
                </span>
                <h2 className="mt-6 text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-[1.05] tracking-tight text-black">
                  From protocol experiment <span className="block text-[#0ABFC2]">to durable infrastructure</span>
                </h2>
                <p className="mt-6 text-lg leading-8 text-black/62">
                  Walnut started as a protocol experiment. It is becoming infrastructure.
                  The confidential DeFi lending market does not exist yet. Walnut is the earliest
                  production-grade attempt to build it on FHE. What follows is the roadmap to
                  turn that head start into a durable protocol.
                </p>
              </div>
              <div className="flex flex-col justify-center rounded-2xl border border-black/10 bg-[#f8f8f6] p-6">
                <p className="text-xs font-mono uppercase tracking-wider text-black/45 mb-4">Core Partners</p>
                <div className="space-y-4">
                  {[
                    "Built entirely on Fhenix CoFHE",
                    "Private settlement via Privara",
                    "Supported by key ecosystem infrastructure partners"
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#0AD9DC] shrink-0" />
                      <span className="text-sm font-medium text-black/70">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-7xl px-6 py-8 lg:px-10">
          <div className="mb-10">
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-black/42">
              Future Milestones
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-black">
              The Roadmap
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {roadmapPhases.map((phase) => (
              <div
                key={phase.phase}
                className="rounded-2xl border border-black/10 bg-white/78 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.04)] backdrop-blur-sm relative group hover:border-[#0ABFC2]/50 hover:shadow-[0_20px_50px_rgba(10,217,220,0.06)] transition-all duration-300 flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="inline-flex rounded-full border border-[#0ABFC2]/30 bg-[#0AD9DC]/10 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.16em] text-[#067f83] font-semibold">
                    {phase.phase}
                  </span>
                  <span className="text-[11px] font-mono text-black/45 font-semibold">
                    {phase.timeline}
                  </span>
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-black mb-4">
                  {phase.title}
                </h3>
                <ul className="space-y-3 flex-1">
                  {phase.items.map((item, idx) => (
                    <li key={idx} className="text-sm leading-6 text-black/58 flex items-start gap-2.5">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#0AD9DC] shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="relative mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,1.8fr)] lg:items-start">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-black/42">
                Capital Allocation
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-black">
                Investment Required
              </h2>
              <p className="mt-4 text-base leading-7 text-black/60">
                To realize this vision and achieve our first major milestones, we are seeking a seed round.
                This capital funds our primary operational, security, and growth runways.
              </p>
              <div className="mt-8 rounded-2xl border border-black/10 bg-[#f8f8f6] p-6">
                <h4 className="text-sm font-semibold text-black mb-2">Seed Funding Goal</h4>
                <p className="text-4xl font-bold tracking-tight text-[#067f83]">$700,000</p>
                <p className="mt-3 text-xs leading-5 text-black/54">
                  Provides an 18-month operational runway to Arbitrum mainnet launch, security certification, and first $10M TVL milestone.
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-black/10 bg-white/82 shadow-[0_24px_60px_rgba(0,0,0,0.04)] backdrop-blur-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-black/10 bg-[#f8f8f6]/50">
                      <th className="px-6 py-4 text-xs font-mono uppercase tracking-wider text-black/45 font-bold">Area</th>
                      <th className="px-6 py-4 text-xs font-mono uppercase tracking-wider text-black/45 font-bold text-right">Amount (USD)</th>
                      <th className="px-6 py-4 text-xs font-mono uppercase tracking-wider text-black/45 font-bold">What it funds</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {budgetItems.map((item) => (
                      <tr key={item.area} className="hover:bg-[#f8f8f6]/30 transition-colors">
                        <td className="px-6 py-4 text-sm font-semibold text-black">{item.area}</td>
                        <td className="px-6 py-4 text-sm font-mono text-black font-semibold text-right whitespace-nowrap">
                          ${item.amount.toLocaleString()}{item.suffix || ""}
                        </td>
                        <td className="px-6 py-4 text-sm text-black/60">{item.description}</td>
                      </tr>
                    ))}
                    <tr className="bg-gradient-to-r from-[#0AD9DC]/5 to-[#0ABFC2]/5 font-semibold">
                      <td className="px-6 py-5 text-base font-bold text-black">Total seed ask</td>
                      <td className="px-6 py-5 text-base font-mono text-black font-bold text-right">$700,000</td>
                      <td className="px-6 py-5 text-sm text-[#067f83] font-medium">18 months to mainnet + first $10M TVL milestone</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <div className="rounded-[2.25rem] border border-black/10 bg-black p-8 text-white shadow-[0_30px_80px_rgba(0,0,0,0.16)] lg:p-12 relative overflow-hidden">
            <div className="absolute right-[-10rem] top-[-10rem] h-[30rem] w-[30rem] rounded-full bg-[#0AD9DC]/10 blur-[120px] pointer-events-none" />
            <div className="relative z-10">
              <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.16em] text-[#0AD9DC] mb-6">
                For Investors
              </span>
              
              <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight text-white lg:text-4xl">
                    Addressing a $50 billion opaque market
                  </h2>
                  <p className="mt-6 text-base leading-7 text-white/70">
                    The DeFi lending market holds $50 billion in TVL today — all of it on transparent rails that leak position data to MEV bots and block institutional participation. Walnut addresses both.
                  </p>
                  <p className="mt-4 text-base leading-7 text-white/70">
                    A 1% capture of the existing lending market puts protocol TVL at $500 million. At a 2% annualized spread, that is $10 million in annual protocol revenue — profitable from the day TVL crosses $50 million, which is achievable within 12 months of mainnet launch with the right liquidity incentives.
                  </p>
                  <p className="mt-6 text-sm text-[#0AD9DC] font-semibold">
                    The first $700K gets Walnut through audit, onto mainnet, and to the point where the protocol earns more than it costs to run. Every dollar after that is growth.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  {[
                    { label: "DeFi Lending TVL", value: "$50B", text: "Transparent rails leak positions" },
                    { label: "1% Target Capture", value: "$500M", text: "Confidential institutional TVL" },
                    { label: "Annualized Spread", value: "2%", text: "Spread between borrow and supply" },
                    { label: "Annual Revenue Goal", value: "$10M", text: "At $500M TVL milestone" }
                  ].map((stat, idx) => (
                    <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-5">
                      <p className="text-xs font-mono uppercase tracking-wider text-white/40">{stat.label}</p>
                      <p className="mt-1 text-2xl font-bold tracking-tight text-[#0AD9DC]">{stat.value}</p>
                      <p className="text-xs text-white/60 mt-1">{stat.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <div className="rounded-[2rem] border border-black/10 bg-white/82 p-8 shadow-[0_22px_56px_rgba(0,0,0,0.05)] backdrop-blur-sm lg:p-12 text-center relative overflow-hidden">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#0AD9DC]/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="relative z-10 max-w-3xl mx-auto">
              <span className="inline-flex rounded-full border border-[#0ABFC2]/30 bg-[#0AD9DC]/10 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.16em] text-[#067f83] font-semibold mb-6">
                Join the Team
              </span>
              <h2 className="text-3xl font-semibold tracking-tight text-black lg:text-4xl">
                Co-founder Wanted
              </h2>
              <p className="mt-6 text-base leading-7 text-black/60">
                This protocol was designed and built solely by one developer. The technical foundation is complete.
                What it needs now is someone who understands go-to-market, institutional BD, and can turn a working protocol into a funded company.
              </p>
              <p className="mt-4 text-base leading-7 text-black/60">
                If you have experience in DeFi growth, protocol economics, or fintech sales and believe private on-chain lending is the next category — let's talk.
              </p>
              <p className="mt-8 text-xl font-bold text-[#067f83] bg-[#0AD9DC]/8 border border-[#0AD9DC]/20 px-6 py-3 rounded-2xl inline-block">
                $700K in seed funding and the right co-founder makes Walnut unstoppable.
              </p>
              
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-full bg-black px-7 text-sm font-semibold text-white hover:bg-black/90 w-full sm:w-auto"
                >
                  <a href="mailto:partners@walnut.finance">
                    Reach out via Email
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-full border-black/12 bg-white px-7 text-sm font-semibold hover:bg-white w-full sm:w-auto"
                >
                  <a href="https://twitter.com/walnut_fi" target="_blank" rel="noopener noreferrer">
                    Twitter @walnut_fi
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-7xl px-6 pt-8 pb-18 lg:px-10">
          <div className="overflow-hidden rounded-[2.25rem] border border-black/10 bg-white/84 shadow-[0_30px_80px_rgba(0,0,0,0.07)] backdrop-blur-sm">
            <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="p-8 lg:p-10">
                <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-black/42">
                  Closing thought
                </p>
                <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-black lg:text-4xl">
                  Walnut is building for the moment private finance stops feeling contradictory.
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-8 text-black/62">
                  The strongest future for Walnut is not just another lending front end. It is a product and
                  protocol layer that makes private financial behavior normal onchain, then benefits from every
                  new user and every new app that wants that experience.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 rounded-full bg-[#0ABFC2] px-7 text-sm font-semibold text-black hover:bg-[#0AD9DC]"
                  >
                    <Link href="/app">
                      Explore the product
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="h-12 rounded-full border-black/12 bg-white px-7 text-sm font-semibold hover:bg-[#f6f6f5]"
                  >
                    <Link href="/privacy">See the privacy architecture</Link>
                  </Button>
                </div>
              </div>

              <div className="relative flex min-h-[320px] items-center justify-center border-t border-black/10 bg-[#f7f7f5] p-8 lg:min-h-full lg:border-l lg:border-t-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(10,217,220,0.16),transparent_40%)]" />
                <div className="absolute h-[22rem] w-[22rem] rounded-full border border-black/8 opacity-60" />
                <div className="absolute h-[16rem] w-[16rem] rounded-full border border-black/10 opacity-70" />
                <div className="absolute h-[10rem] w-[10rem] rounded-full border border-[#0ABFC2]/30 opacity-90" />
                <div className="relative rounded-[1.75rem] border border-black/10 bg-white/86 p-6 text-center shadow-[0_24px_50px_rgba(0,0,0,0.06)]">
                  <Image
                    src="/svg logo of walnut.svg"
                    alt="Walnut Protocol"
                    width={160}
                    height={90}
                    className="mx-auto h-[52px] w-auto"
                  />
                  <p className="mt-5 text-[11px] font-mono uppercase tracking-[0.18em] text-black/42">
                    Private lending on Fhenix
                  </p>
                  <p className="mt-3 max-w-xs text-sm leading-7 text-black/62">
                    Built to prove that onchain credit can be useful, enforceable, and private at the same time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <FooterSection />
    </>
  );
}
