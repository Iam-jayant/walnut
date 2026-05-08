"use client";

import { Github, Send } from "lucide-react";

const socialLinks = [
  { 
    name: "X", 
    href: "https://x.com/0xjayantxyz",
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    )
  },
  { 
    name: "GitHub", 
    href: "https://github.com/Iam-jayant/walnut",
    icon: <Github className="w-5 h-5" />
  },
  { 
    name: "Telegram", 
    href: "https://t.me/staticmelon",
    icon: <Send className="w-5 h-5" />
  },
];

export function FooterSection() {
  return (
    <footer className="relative bg-black text-white border-t border-white/10">
      <div className="max-w-7xl mx-auto px-6">
        {/* Main Footer */}
        <div className="py-16">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            {/* Brand Column */}
            <div>
              <a href="#" className="inline-block mb-6">
                <span className="text-3xl font-sans font-semibold">Walnut</span>
              </a>

              <p className="text-sm text-gray-400 leading-relaxed max-w-md mb-8">
                A confidential lending protocol built on Fhenix CoFHE. Your collateral, debt, and liquidation threshold stay encrypted on-chain.
              </p>

              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="px-2 py-1 bg-white/5 border border-white/10 rounded font-mono">
                  Arbitrum Sepolia
                </span>
                <span className="px-2 py-1 bg-white/5 border border-white/10 rounded font-mono">
                  FHE
                </span>
              </div>
            </div>

            {/* Links Column */}
            <div className="flex flex-col items-start md:items-end">
              <h3 className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-6">
                Connect
              </h3>
              
              {/* Social Links */}
              <div className="flex flex-col gap-4">
                {socialLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors group"
                  >
                    <span className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 group-hover:border-[#0AD9DC]/50 transition-all">
                      {link.icon}
                    </span>
                    <span className="text-sm font-medium">{link.name}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="py-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} Walnut Protocol. Built with privacy first.
          </p>
          <p className="text-xs text-gray-500 font-mono">
            Powered by Fhenix CoFHE
          </p>
        </div>
      </div>
    </footer>
  );
}
