import { GlassPanel } from "@/components/walnut/glass-panel";
import { cn } from "@/lib/utils";

type HealthFactorStatus = "safe" | "at-risk" | "liquidatable" | "unknown";

type HealthFactorCardProps = {
  healthFactor: bigint | undefined;
  isDecrypting: boolean;
  showDecrypted: boolean;
  status: HealthFactorStatus;
};

export function HealthFactorCard({
  healthFactor,
  isDecrypting,
  showDecrypted,
  status,
}: HealthFactorCardProps) {
  const displayValue = () => {
    if (!showDecrypted) return "******";
    if (isDecrypting) return "Loading...";
    if (healthFactor === undefined) return "N/A";
    return (Number(healthFactor) / 10000).toFixed(2);
  };

  const statusColors: Record<HealthFactorStatus, string> = {
    safe: "border-emerald-300/50 bg-emerald-50/70",
    "at-risk": "border-amber-300/55 bg-amber-50/75",
    liquidatable: "border-red-300/55 bg-red-50/75",
    unknown: "border-black/10 bg-white/85",
  };

  const statusLabels: Record<HealthFactorStatus, string> = {
    safe: "Safe",
    "at-risk": "At Risk",
    liquidatable: "Liquidatable",
    unknown: "Unknown",
  };

  return (
    <GlassPanel className={cn("walnut-card walnut-card-strong border-2", statusColors[status])}>
      <div className="flex items-start justify-between">
        <div>
          <p className="walnut-label">Health Factor</p>
          <p className="walnut-value text-4xl">{displayValue()}</p>
        </div>
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium",
            status === "safe" && "border-emerald-200 bg-emerald-100 text-emerald-800",
            status === "at-risk" && "border-amber-200 bg-amber-100 text-amber-800",
            status === "liquidatable" && "border-red-200 bg-red-100 text-red-800",
            status === "unknown" && "border-black/10 bg-black/5 text-gray-800"
          )}
        >
          {statusLabels[status]}
        </span>
      </div>
      <p className="walnut-meta text-xs">
        {status === "safe" && "Your position is healthy (≥1.50)"}
        {status === "at-risk" && "Monitor your position (1.05-1.50)"}
        {status === "liquidatable" && "Position at risk (<1.05)"}
        {status === "unknown" && "Show values to view status"}
      </p>
    </GlassPanel>
  );
}
