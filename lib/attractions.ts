import attractionsFixture from "@/data/fixtures/attractions.json";
import { normalize } from "./text";

export interface Attraction {
  id: string;
  city: string; // normalized city key
  name: string;
  blurb: string;
  tag: string;
  day: number;
  time: string;
  durationMin: number;
}

const ATTRACTIONS = (attractionsFixture as { attractions: Attraction[] }).attractions;

/** Card swatch per tag (template colours). */
export const TAG_SWATCH: Record<string, string> = {
  Museum: "#CFE6D6",
  Food: "#F3E2B3",
  Views: "#BFD9E8",
  Landmark: "#D6DEEE",
  Market: "#E4F7B5",
  Outdoors: "#BFD9E8",
};

export function attractionsFor(city: string): Attraction[] {
  const key = normalize(city);
  return ATTRACTIONS.filter((a) => a.city === key);
}

export function getAttraction(id: string): Attraction | undefined {
  return ATTRACTIONS.find((a) => a.id === id);
}
