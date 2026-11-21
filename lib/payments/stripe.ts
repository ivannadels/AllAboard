import "server-only";
import Stripe from "stripe";

let client: Stripe | null | undefined;

/**
 * The Stripe client, or null when no key is configured (the app then uses the built-in mock
 * checkout, so `npm run dev` keeps working offline). Live keys are refused on purpose.
 */
export function getStripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return (client = null);
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
    throw new Error("AllAboard only runs Stripe in test mode. Use a sk_test_ key.");
  }
  client = new Stripe(key, { appInfo: { name: "AllAboard (prototype)" } });
  return client;
}

export const paymentsMode = (): "stripe" | "mock" => (getStripe() ? "stripe" : "mock");
