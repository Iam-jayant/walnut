import { GlassPanel } from "@/components/walnut/glass-panel";

type LiquidationBadgeProps = {
  liquidatable: boolean;
};

export function LiquidationBadge({ liquidatable }: LiquidationBadgeProps) {
  if (!liquidatable) return null;

  return (
    <GlassPanel className="walnut-alert walnut-alert-danger border-2 border-red-500/70">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-red-100">
          <svg
            className="h-5 w-5 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <p className="walnut-label text-red-700">Critical Risk</p>
          <h3 className="mt-1 font-display text-lg text-red-900">
            Position is Liquidatable
          </h3>
          <p className="mt-1 text-sm text-red-800">
            Your health factor has fallen below the liquidation threshold. Contact
            protocol to resolve.
          </p>
        </div>
      </div>
    </GlassPanel>
  );
}
