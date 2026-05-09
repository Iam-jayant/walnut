"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { name: "Home", href: "/" },
  { name: "Privacy", href: "/privacy" },
  { name: "Docs", href: "/docs" },
  { name: "Vision", href: "#" },
];

export function Navigation() {
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState("");
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Hide navbar on scroll down, show on scroll up
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);

      // Active section detection
      const sections = ["product", "how-it-works", "security"];
      const scrollPosition = window.scrollY + 200;

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(`#${section}`);
            break;
          }
        }
      }

      if (window.scrollY < 100) {
        setActiveSection("");
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    if (href === "/privacy") {
      return pathname === "/privacy";
    }
    if (href === "/docs") {
      return pathname === "/docs";
    }
    if (href.startsWith("#")) {
      return activeSection === href;
    }
    return false;
  };

  return (
    <nav 
      className={cn(
        "fixed top-0 left-0 right-0 z-50 h-24 flex items-center justify-center px-6 pointer-events-none transition-transform duration-500",
        isVisible ? "translate-y-0" : "-translate-y-full"
      )}
    >
      <div className="w-full max-w-7xl flex items-center justify-between pointer-events-auto">
        {/* LOGO */}
        <Link href="/" className="group flex items-center no-underline">
          <Image 
            src="/walnut logo.png" 
            alt="Walnut" 
            width={250} 
            height={100}
            className="h-8 w-auto"
            priority
          />
        </Link>

        {/* NAVIGATION PILL (CENTERED ABSOLUTELY) */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden lg:flex max-w-[calc(100%-640px)] items-center p-1.5 rounded-full bg-white/95 backdrop-blur-[32px] border border-black/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] gap-0.5">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            const isExternal = link.href.startsWith("http");

            return (
              <Link
                key={link.name}
                href={link.href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className={cn(
                  "relative px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 whitespace-nowrap",
                  active ? "text-foreground" : "text-foreground/50 hover:text-foreground/80"
                )}
              >
                {active && (
                  <span className="absolute inset-0 rounded-full bg-white border border-black/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]" />
                )}
                <span className="relative z-10">{link.name}</span>
              </Link>
            );
          })}
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-4">
          <Link
            href="/app"
            className="hidden md:flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 border border-black/10 px-6 py-2.5 rounded-full backdrop-blur-[24px] transition-all duration-500 text-sm font-semibold text-accent-foreground group shadow-[0_8px_32px_0_rgba(0,0,0,0.12)]"
          >
            Launch App
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </nav>
  );
}
