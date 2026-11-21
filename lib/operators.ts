// Operator badges (initials + colours) for search results. Swap the badge for a logo by
// adding `logoUrl` here; see the template README.

export interface OperatorStyle {
  initials: string;
  bg: string;
  fg: string;
  logoUrl?: string;
}

const STYLES: Record<string, OperatorStyle> = {
  Eurostar: { initials: "ES", bg: "#0E1F17", fg: "#C8F169" },
  "Deutsche Bahn": { initials: "DB", bg: "#FFFFFF", fg: "#0E1F17" },
  SNCF: { initials: "SN", bg: "#CFE6D6", fg: "#0E1F17" },
  Ouigo: { initials: "OG", bg: "#BFD9E8", fg: "#0E1F17" },
  "TGV Lyria": { initials: "LY", bg: "#D6DEEE", fg: "#0E1F17" },
  Renfe: { initials: "RF", bg: "#F3E2B3", fg: "#0E1F17" },
  Trenitalia: { initials: "TI", bg: "#CFE6D6", fg: "#0E1F17" },
  Italo: { initials: "IT", bg: "#FDEBDD", fg: "#0E1F17" },
  SBB: { initials: "SB", bg: "#FFFFFF", fg: "#0E1F17" },
  SNCB: { initials: "BE", bg: "#D6DEEE", fg: "#0E1F17" },
  NS: { initials: "NS", bg: "#F3E2B3", fg: "#0E1F17" },
  FlixBus: { initials: "FB", bg: "#E4F7B5", fg: "#0E1F17" },
  "BlaBlaCar Bus": { initials: "BB", bg: "#BFD9E8", fg: "#0E1F17" },
  BlaBlaCar: { initials: "BC", bg: "#D6DEEE", fg: "#0E1F17" },
  ALSA: { initials: "AL", bg: "#FDEBDD", fg: "#0E1F17" },
};

function fallback(name: string): OperatorStyle {
  const words = name.split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
  return { initials, bg: "#EAF3EC", fg: "#0E1F17" };
}

/** Style for a (possibly combined, "A + B") operator string: the first operator leads. */
export function operatorStyle(operator: string): OperatorStyle & { extra: number } {
  const parts = operator.split(" + ");
  return { ...(STYLES[parts[0]] ?? fallback(parts[0])), extra: parts.length - 1 };
}
