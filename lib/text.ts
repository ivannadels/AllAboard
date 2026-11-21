/** Lowercase, accent-insensitive comparison key ("Zürich" → "zurich"). */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** URL-safe slug ("BlaBlaCar Bus" → "blablacar-bus"). */
export function slugify(s: string): string {
  return normalize(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
