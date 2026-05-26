"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface PermitExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
}

export function PermitExplainerModal({
  isOpen,
  onClose,
  onProceed,
}: PermitExplainerModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-walnut-card border border-walnut-border rounded-lg shadow-xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-walnut-muted hover:text-walnut-text transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6">
          <h2 className="text-xl font-bold text-walnut-text mb-4">
            Create Your Private Access Permit
          </h2>

          <div className="space-y-4 text-sm text-walnut-muted mb-6">
            <p>
              Your financial data is encrypted on-chain. To view your collateral, debt, and health
              factor, you need to create a permit.
            </p>
            <p>
              This permit is a cryptographic signature that grants your wallet permission to
              decrypt your own encrypted data. It's stored locally and never leaves your device.
            </p>
            <p className="text-walnut-text font-medium">
              You'll only need to sign this once. It's free and takes just a few seconds.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-walnut-border text-walnut-text hover:bg-walnut-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onProceed();
                onClose();
              }}
              className="flex-1 px-4 py-2 rounded-lg bg-walnut-accent text-white hover:bg-walnut-accent-hover transition-colors font-medium"
            >
              Sign to Create Permit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function usePermitExplainer() {
  const [hasSeenExplainer, setHasSeenExplainer] = useState(false);
  const [showExplainer, setShowExplainer] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem("walnut_permit_explainer_seen");
    setHasSeenExplainer(seen === "true");
  }, []);

  const triggerExplainer = () => {
    if (!hasSeenExplainer) {
      setShowExplainer(true);
    }
  };

  const markAsSeen = () => {
    localStorage.setItem("walnut_permit_explainer_seen", "true");
    setHasSeenExplainer(true);
    setShowExplainer(false);
  };

  return {
    showExplainer,
    setShowExplainer,
    triggerExplainer,
    markAsSeen,
    hasSeenExplainer,
  };
}
