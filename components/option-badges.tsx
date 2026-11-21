import { Coins, Leaf, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Badge as BadgeKind } from "@/lib/ranking";

const BADGES: Record<BadgeKind, { label: string; Icon: typeof Leaf; className: string }> = {
  greenest: { label: "Greenest", Icon: Leaf, className: "bg-eco-soft text-eco border-transparent" },
  cheapest: { label: "Cheapest", Icon: Coins, className: "" },
  fastest: { label: "Fastest", Icon: Zap, className: "" },
};

export function OptionBadges({ badges }: { badges: BadgeKind[] }) {
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => {
        const { label, Icon, className } = BADGES[b];
        return (
          <Badge key={b} variant="outline" className={`gap-1 ${className}`}>
            <Icon className="size-3" aria-hidden />
            {label}
          </Badge>
        );
      })}
    </div>
  );
}
