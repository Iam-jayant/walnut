"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { Check, Copy, ExternalLink, Share2 } from "lucide-react";
import mermaid from "mermaid";
import {
  walnutContractAddress,
  walnutFherc20Address,
  walnutOracleAddress,
  walnutMockUsdcAddress,
} from "@/lib/walnut-contract";

interface DocsContentProps {
  activeDoc: string;
}

const docFiles: Record<string, string> = {
  "getting-started": "/docs/getting-started.md",
  "fhe-explainer": "/docs/fhe-explainer.md",
  architecture: "/docs/architecture.md",
  security: "/docs/security.md",
  contracts: "/docs/contracts.md",
  "user-guide": "/docs/user-guide.md",
};

const gettingStartedContent = `# Getting Started with Walnut Protocol

Welcome to Walnut Protocol documentation. This guide will help you understand and integrate with our confidential lending protocol.

## What is Walnut?

Walnut is a confidential lending protocol built with Fully Homomorphic Encryption (FHE). Users deposit collateral and borrow an encrypted stablecoin while their position data remains encrypted on-chain.

## Quick Links

- **Live App**: [walnut-protocol.vercel.app](https://walnut-protocol.vercel.app)
- **GitHub**: [github.com/Iam-jayant/walnut](https://github.com/Iam-jayant/walnut)
- **Network**: Arbitrum Sepolia (Chain ID: 421614)

## Key Features

- **Encrypted Positions**: Collateral, debt, and health factors stored as encrypted \`euint128\` values
- **Multi-Loan Support**: Users can have multiple concurrent loans
- **Credit Tier System**: Encrypted repayment history unlocks better LTV ratios (70% -> 90%)
- **Permit-Based Decryption**: Users sign permits to decrypt their own data

## Documentation Structure

### Core Concepts

- **FHE Explainer**: Understanding Fully Homomorphic Encryption
- **Architecture**: System design and data flows
- **Security**: Threat model and security considerations

### Reference

- **Smart Contracts**: Complete contract specifications
- **User Guide**: Step-by-step usage instructions

## Contract Addresses

**Network**: Arbitrum Sepolia (Chain ID: 421614)

| Contract | Address |
|----------|---------|
| WalnutLending | \`${walnutContractAddress}\` |
| WalnutFHERC20 (cUSDC) | \`${walnutFherc20Address}\` |
| WalnutPriceOracle | \`${walnutOracleAddress}\` |
| MockUSDC | \`${walnutMockUsdcAddress}\` |

## Next Steps

1. Read the **FHE Explainer** to understand the cryptographic foundation
2. Review the **Architecture** to see how the system works
3. Check the **Security** documentation for threat model and best practices
4. Explore **Smart Contracts** for technical implementation details
5. Follow the **User Guide** for step-by-step usage instructions

## Need Help?

- **Discord**: Join our community
- **Twitter**: [@WalnutProtocol](https://twitter.com/WalnutProtocol)
- **GitHub Issues**: Report bugs or request features
`;

export function DocsContent({ activeDoc }: DocsContentProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedDoc, setCopiedDoc] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      themeVariables: {
        primaryColor: "#ecfdfb",
        primaryTextColor: "#111111",
        primaryBorderColor: "#22d3c8",
        lineColor: "#0f766e",
        secondaryColor: "#ffffff",
        tertiaryColor: "#f5f5f4",
        background: "#ffffff",
        mainBkg: "#ffffff",
        secondBkg: "#f5f5f4",
        textColor: "#111111",
        fontFamily: "Instrument Sans, system-ui, sans-serif",
        fontSize: "14px",
      },
    });

    if (!loading && content) {
      const renderMermaid = async () => {
        const mermaidElements = document.querySelectorAll(".mermaid");

        for (let i = 0; i < mermaidElements.length; i++) {
          const element = mermaidElements[i] as HTMLElement;
          const graphDefinition = element.textContent || "";

          try {
            const { svg } = await mermaid.render(`mermaid-${i}-${Date.now()}`, graphDefinition);
            element.innerHTML = svg;
          } catch (error) {
            console.error("Mermaid rendering error:", error);
            element.innerHTML = `<pre class="text-sm text-red-600">Error rendering diagram</pre>`;
          }
        }
      };

      setTimeout(renderMermaid, 100);
    }
  }, [loading, content]);

  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      try {
        if (activeDoc === "getting-started") {
          setContent(gettingStartedContent);
          return;
        }

        const filePath = docFiles[activeDoc];
        if (!filePath) {
          setContent("# Documentation not found\n\nThe requested documentation page could not be found.");
          return;
        }

        const response = await fetch(filePath);
        if (!response.ok) {
          throw new Error("Failed to load documentation");
        }

        setContent(await response.text());
      } catch (error) {
        console.error("Error loading documentation:", error);
        setContent("# Error loading documentation\n\nPlease try again later.");
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [activeDoc]);

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const copyForAI = async () => {
    try {
      await navigator.clipboard.writeText(`# Walnut Protocol Documentation\n\n${content}`);
      setCopiedDoc(true);
      setTimeout(() => setCopiedDoc(false), 2000);
    } catch (error) {
      console.error("Failed to copy documentation:", error);
    }
  };

  const shareDoc = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/docs`);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch (error) {
      console.error("Failed to share documentation:", error);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-4xl">
        <div className="mb-8 flex justify-end gap-2">
          <div className="h-10 w-28 animate-pulse rounded-lg bg-black/5" />
          <div className="h-10 w-24 animate-pulse rounded-lg bg-black/5" />
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-9 w-3/4 rounded bg-black/5" />
          <div className="h-4 w-full rounded bg-black/5" />
          <div className="h-4 w-5/6 rounded bg-black/5" />
          <div className="h-4 w-4/6 rounded bg-black/5" />
        </div>
      </div>
    );
  }

  return (
    <article className="w-full max-w-4xl">
      <div className="mb-8 flex flex-wrap justify-start gap-2 sm:justify-end">
        <button
          onClick={copyForAI}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-black/10 bg-white px-3 text-sm font-semibold text-black/55 shadow-sm transition-colors hover:text-black"
        >
          {copiedDoc ? <Check className="h-4 w-4 text-[#159c94]" /> : <Copy className="h-4 w-4" />}
          {copiedDoc ? "Copied" : "Copy for AI"}
        </button>
        <button
          onClick={shareDoc}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-black/10 bg-white px-3 text-sm font-semibold text-black/55 shadow-sm transition-colors hover:text-black"
        >
          {shared ? <Check className="h-4 w-4 text-[#159c94]" /> : <Share2 className="h-4 w-4" />}
          {shared ? "Shared" : "Share"}
        </button>
      </div>

      <div className="docs-article">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="mb-6 border-b border-black/10 pb-5 text-4xl font-bold tracking-tight text-black">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="mt-12 mb-4 text-2xl font-bold tracking-tight text-black">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="mt-8 mb-3 text-xl font-semibold text-black">{children}</h3>
            ),
            h4: ({ children }) => (
              <h4 className="mt-6 mb-2 text-lg font-semibold text-black">{children}</h4>
            ),
            p: ({ children }) => (
              <p className="mb-4 text-base leading-8 text-black/70">{children}</p>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                target={href?.startsWith("http") ? "_blank" : undefined}
                rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
                className="inline-flex items-center gap-1 font-semibold text-[#159c94] no-underline hover:text-black"
              >
                {children}
                {href?.startsWith("http") && <ExternalLink className="h-3 w-3" />}
              </a>
            ),
            code: ({ inline, className, children, ...props }: any) => {
              const match = /language-(\w+)/.exec(className || "");
              const codeString = String(children).replace(/\n$/, "");
              const language = match ? match[1] : "";

              if (language === "mermaid") {
                return (
                  <div className="my-8 overflow-x-auto rounded-lg border border-black/10 bg-white p-5 shadow-sm">
                    <div className="mermaid">{codeString}</div>
                  </div>
                );
              }

              return !inline && match ? (
                <div className="group relative my-6 overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
                  <button
                    onClick={() => copyToClipboard(codeString)}
                    className="absolute right-3 top-3 z-10 rounded-md border border-black/10 bg-white p-2 text-black/50 shadow-sm transition-colors hover:text-black"
                    title="Copy code"
                  >
                    {copiedCode === codeString ? (
                      <Check className="h-4 w-4 text-[#159c94]" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                  <SyntaxHighlighter
                    style={oneLight}
                    language={language}
                    PreTag="div"
                    customStyle={{
                      background: "transparent",
                      margin: 0,
                      padding: "1.25rem",
                      paddingRight: "4rem",
                    }}
                    codeTagProps={{
                      style: {
                        fontFamily: "var(--font-jetbrains), monospace",
                        fontSize: "0.86rem",
                        lineHeight: 1.75,
                      },
                    }}
                    {...props}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <code className="rounded border border-black/10 bg-black/[0.04] px-1.5 py-0.5 font-mono text-sm text-black">
                  {children}
                </code>
              );
            },
            ul: ({ children }) => (
              <ul className="mb-5 ml-5 list-disc space-y-2 text-black/70">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-5 ml-5 list-decimal space-y-2 text-black/70">{children}</ol>
            ),
            li: ({ children }) => <li className="pl-1 text-base leading-8">{children}</li>,
            blockquote: ({ children }) => (
              <blockquote className="my-6 rounded-r-lg border-l-4 border-[#22d3c8] bg-white px-5 py-4 shadow-sm">
                {children}
              </blockquote>
            ),
            table: ({ children }) => (
              <div className="my-6 overflow-x-auto rounded-lg border border-black/10 bg-white shadow-sm">
                <table className="min-w-full">{children}</table>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-black/[0.035]">{children}</thead>,
            th: ({ children }) => (
              <th className="border-b border-black/10 px-4 py-3 text-left text-sm font-bold text-black">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border-b border-black/[0.06] px-4 py-3 text-sm leading-7 text-black/70">
                {children}
              </td>
            ),
            hr: () => <hr className="my-8 border-black/10" />,
            strong: ({ children }) => <strong className="font-semibold text-black">{children}</strong>,
            em: ({ children }) => <em className="italic text-black/70">{children}</em>,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </article>
  );
}
