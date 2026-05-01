"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Handshake, Plus, RefreshCcw } from "lucide-react";
import type { Address } from "viem";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassPanel } from "@/components/walnut/glass-panel";
import { ProtocolAlerts, SystemStatusPanel } from "@/components/walnut/protocol-health";
import { useWalnutProtocol } from "@/hooks/use-walnut-protocol";

const OFFERS_REFRESH_INTERVAL_MS = 30_000;

type OfferRow = {
  id: bigint;
  lender: Address;
  borrower: Address;
  active: boolean;
  matched: boolean;
};

export default function P2PPage() {
  const protocol = useWalnutProtocol();
  const {
    canUseContract,
    getOfferCount,
    getOfferMeta,
    getOfferTerms,
    createOffer,
    matchOffer,
    isWriting,
    isEncrypting,
    canWrite,
  } = protocol;

  const [amountInput, setAmountInput] = useState("");
  const [aprInput, setAprInput] = useState("");
  const [tenorInput, setTenorInput] = useState("");
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<bigint | null>(null);
  const [terms, setTerms] = useState<{ amount?: bigint; apr?: bigint; tenor?: bigint } | null>(null);
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);
  const isRefreshingOffersRef = useRef(false);

  const canSubmitOffer = Boolean(amountInput && aprInput && tenorInput);

  const selectedOffer = useMemo(
    () => offers.find((offer) => offer.id === selectedOfferId) ?? null,
    [offers, selectedOfferId]
  );

  const refreshOffers = useCallback(async () => {
    if (!canUseContract) return;
    if (isRefreshingOffersRef.current) return;

    isRefreshingOffersRef.current = true;
    if (offers.length === 0) {
      setIsLoadingOffers(true);
    }

    try {
      const count = await getOfferCount();
      const total = Number(count);
      const start = total > 8 ? total - 8 : 0;
      const ids = Array.from({ length: total - start }, (_, index) => BigInt(start + index));

      const metas = await Promise.all(ids.map((id) => getOfferMeta(id)));
      const rows = metas
        .map((meta, idx) => {
          if (!meta) return null;
          return {
            id: ids[idx],
            lender: meta.lender,
            borrower: meta.borrower,
            active: meta.active,
            matched: meta.matched,
          } satisfies OfferRow;
        })
        .filter((row): row is OfferRow => row !== null)
        .reverse();

      setOffers(rows);
      if (selectedOfferId && !rows.some((row) => row.id === selectedOfferId)) {
        setSelectedOfferId(null);
      }
    } finally {
      isRefreshingOffersRef.current = false;
      setIsLoadingOffers(false);
    }
  }, [canUseContract, getOfferCount, getOfferMeta, offers.length, selectedOfferId]);

  useEffect(() => {
    void refreshOffers();

    const id = window.setInterval(() => {
      void refreshOffers();
    }, OFFERS_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [refreshOffers]);

  useEffect(() => {
    if (!selectedOffer || !selectedOffer.matched) {
      setTerms(null);
      return;
    }

    let active = true;
    void getOfferTerms(selectedOffer.id).then((data) => {
      if (!active) return;
      setTerms(data);
    });

    return () => {
      active = false;
    };
  }, [getOfferTerms, selectedOffer]);

  async function handleCreateOffer() {
    const success = await createOffer({
      amount: amountInput,
      apr: aprInput,
      tenor: tenorInput,
    });

    if (success) {
      setAmountInput("");
      setAprInput("");
      setTenorInput("");
      await refreshOffers();
    }
  }

  async function handleMatchOffer(offerId: bigint) {
    const success = await matchOffer(offerId);
    if (success) {
      await refreshOffers();
    }
  }

  const selectedTermsLabel = selectedOffer?.matched ? terms : null;

  return (
    <div className="space-y-6">
      <GlassPanel className="walnut-hero">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">P2P</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Private Loan Marketplace</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Create encrypted offers on the left and match counterparty requests on the right. Matching now triggers private settlement in Wave 3.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="walnut-status-chip walnut-status-chip-ghost">Encrypted Terms</span>
          <span className="walnut-status-chip walnut-status-chip-ghost">Settlement Wave 3</span>
        </div>
      </GlassPanel>

      <ProtocolAlerts protocol={protocol} />

      <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
        <GlassPanel className="walnut-card walnut-card-strong space-y-4">
          <div>
            <p className="walnut-label">Create Offer</p>
            <h2 className="mt-2 font-display text-2xl text-foreground">New Lender Terms</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              All terms are encrypted client-side before they reach the protocol.
            </p>
          </div>

          <div className="grid gap-3">
            <div>
              <label htmlFor="offer-amount" className="mb-2 block text-sm text-foreground">
                Amount
              </label>
              <Input
                id="offer-amount"
                inputMode="numeric"
                value={amountInput}
                onChange={(event) => setAmountInput(event.target.value.replace(/[^0-9]/g, ""))}
                placeholder="500"
                className="h-12 border-black/10 bg-white text-foreground placeholder:text-muted-foreground/80"
              />
            </div>
            <div>
              <label htmlFor="offer-apr" className="mb-2 block text-sm text-foreground">
                APR (bps)
              </label>
              <Input
                id="offer-apr"
                inputMode="numeric"
                value={aprInput}
                onChange={(event) => setAprInput(event.target.value.replace(/[^0-9]/g, ""))}
                placeholder="1200"
                className="h-12 border-black/10 bg-white text-foreground placeholder:text-muted-foreground/80"
              />
            </div>
            <div>
              <label htmlFor="offer-tenor" className="mb-2 block text-sm text-foreground">
                Tenor (days)
              </label>
              <Input
                id="offer-tenor"
                inputMode="numeric"
                value={tenorInput}
                onChange={(event) => setTenorInput(event.target.value.replace(/[^0-9]/g, ""))}
                placeholder="30"
                className="h-12 border-black/10 bg-white text-foreground placeholder:text-muted-foreground/80"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              className="glass-button bg-accent text-accent-foreground hover:bg-accent/85"
              onClick={handleCreateOffer}
              isLoading={isWriting || isEncrypting}
              loadingText={isEncrypting ? "Encrypting..." : "Submitting..."}
              disabled={!canSubmitOffer || !canWrite}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Offer
            </Button>
          </div>
        </GlassPanel>

        <GlassPanel className="walnut-card walnut-card-strong space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="walnut-label">Marketplace</p>
              <h2 className="mt-2 font-display text-2xl text-foreground">Open Requests</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Select an offer to match. Terms are revealed after a match is confirmed.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="glass-button"
              onClick={() => void refreshOffers()}
              isLoading={isLoadingOffers}
              loadingText="Refreshing..."
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          {offers.length === 0 ? (
            <div className="walnut-alert">
              <p className="text-sm text-muted-foreground">No offers published yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {offers.map((offer) => {
                const isSelected = offer.id === selectedOfferId;
                return (
                  <button
                    key={offer.id.toString()}
                    type="button"
                    onClick={() => setSelectedOfferId(offer.id)}
                    className={
                      isSelected
                        ? "walnut-progress border border-accent/40 bg-accent/10 text-left"
                        : "walnut-progress text-left"
                    }
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">Offer #{offer.id.toString()}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Lender: {offer.lender.slice(0, 6)}...{offer.lender.slice(-4)}
                        </p>
                      </div>
                      <span className="walnut-status-chip walnut-status-chip-ghost">
                        {offer.matched ? "Matched" : offer.active ? "Open" : "Closed"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedOffer ? (
            <div className="walnut-card space-y-3">
              <p className="walnut-label">Selected Offer</p>
              <p className="text-sm text-foreground">Offer #{selectedOffer.id.toString()}</p>
              {selectedOffer.matched && selectedTermsLabel ? (
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Amount: {selectedTermsLabel.amount?.toString() ?? "--"}</p>
                  <p>APR (bps): {selectedTermsLabel.apr?.toString() ?? "--"}</p>
                  <p>Tenor (days): {selectedTermsLabel.tenor?.toString() ?? "--"}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Terms reveal after a successful match.</p>
              )}

              <Button
                className="glass-button bg-accent text-accent-foreground hover:bg-accent/85"
                onClick={() => handleMatchOffer(selectedOffer.id)}
                isLoading={isWriting}
                loadingText="Matching..."
                disabled={!selectedOffer.active || selectedOffer.matched || !canWrite}
              >
                <Handshake className="mr-2 h-4 w-4" />
                Match Offer
              </Button>
            </div>
          ) : (
            <div className="walnut-alert">
              <p className="text-sm text-muted-foreground">Select an offer to view details.</p>
            </div>
          )}
        </GlassPanel>
      </div>

      <SystemStatusPanel protocol={protocol} />
    </div>
  );
}
