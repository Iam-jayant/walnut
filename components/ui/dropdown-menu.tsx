"use client";

import { ReactNode, useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface DropdownMenuProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}

export function DropdownMenu({ trigger, children, align = "left", className }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div 
      className="relative" 
      ref={dropdownRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className="flex items-center gap-1"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {trigger}
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute top-full mt-2 min-w-[200px] rounded-lg border border-black/10 bg-white shadow-lg",
            align === "right" ? "right-0" : "left-0",
            className
          )}
          role="menu"
        >
          <div className="py-1" onClick={() => setIsOpen(false)}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

interface DropdownItemProps {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  className?: string;
}

export function DropdownItem({ children, onClick, icon, className }: DropdownItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-black/5",
        className
      )}
      role="menuitem"
    >
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

interface DropdownLinkProps {
  children: ReactNode;
  href: string;
  icon?: ReactNode;
  description?: string;
  className?: string;
}

export function DropdownLink({ children, href, icon, description, className }: DropdownLinkProps) {
  return (
    <a
      href={href}
      className={cn(
        "flex items-start gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-black/5",
        className
      )}
      role="menuitem"
    >
      {icon && <span className="mt-0.5 text-muted-foreground">{icon}</span>}
      <div className="flex flex-col">
        <span className="font-medium text-foreground">{children}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </div>
    </a>
  );
}

export function DropdownSeparator() {
  return <div className="my-1 h-px bg-black/10" role="separator" />;
}
