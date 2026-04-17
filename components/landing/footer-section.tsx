"use client";

import { ArrowUpRight } from "lucide-react";

const footerLinks = {
  Product: [
    { name: "Documentation", href: "https://docs.walnut.finance" },
    { name: "Github", href: "https://github.com/walnut-finance" },
    { name: "Status", href: "#" },
  ],
  Legal: [
    { name: "Privacy Policy", href: "#" },
    { name: "Terms of Service", href: "#" },
  ],
};

const socialLinks = [
  { name: "Twitter", href: "https://twitter.com/walnutfinance" },
  { name: "GitHub", href: "https://github.com/walnut-finance" },
  { name: "Discord", href: "#" },
];

export function FooterSection() {
  return (
    <footer className="relative border-t border-border">
      <div className="max-w-350 mx-auto px-6 lg:px-12">
        {/* Main Footer */}
        <div className="py-16 lg:py-24">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 lg:gap-16">
            {/* Brand Column */}
            <div className="col-span-2 md:col-span-1">
              <a href="#" className="inline-block mb-8">
                <span className="text-2xl font-display">Walnut</span>
              </a>

              <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-xs">
                Private lending, finally. Your financial information is yours alone.
              </p>

              {/* Social Links */}
              <div className="flex gap-4">
                {socialLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 group"
                  >
                    {link.name}
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </a>
                ))}
              </div>
            </div>

            {/* Link Columns */}
            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-6">{title}</h3>
                <ul className="space-y-3">
                  {links.map((link) => (
                    <li key={link.name}>
                      <a
                        href={link.href}
                        target={link.href.startsWith("http") ? "_blank" : undefined}
                        rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 group w-fit"
                      >
                        {link.name}
                        {link.href.startsWith("http") && (
                          <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Section */}
        <div className="py-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-xs text-muted-foreground">
            &copy; 2026 Walnut Protocol. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Built with privacy first.
          </p>
        </div>
      </div>
    </footer>
  );
}
