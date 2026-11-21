import { getProvider } from "@/lib/providers";

// Station autocomplete. Goes through the provider so Step 2 can swap in real data.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const stations = await getProvider().searchStations(q.slice(0, 80));
  return Response.json(stations.map(({ id, name, city, countryCode }) => ({ id, name, city, countryCode })));
}
