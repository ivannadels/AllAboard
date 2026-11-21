/**
 * Prepares the Stripe TEST sandbox for AllAboard. Safe to re-run.
 *
 *   npm run stripe:setup
 *
 * 1. Stripe Tax: placeholder Brussels head office, inclusive pricing, a Belgian registration,
 *    then a sample calculation on the booking fee.
 * 2. Connect: one recipient (Accounts v2) connected account per operator, so fares can be
 *    transferred to operators. Existing accounts are found by metadata and reused.
 *
 * Refuses to run with a live key.
 */
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { OPERATOR_COUNTRY } from "@/lib/operators";
import { BOOKING_FEE_TAX_CODE } from "@/lib/payments/pricing";

const key = process.env.STRIPE_SECRET_KEY;
if (!key?.startsWith("sk_test_")) {
  console.error("STRIPE_SECRET_KEY must be a test-mode key (sk_test_…). Put it in .env.local.");
  process.exit(1);
}
const stripe = new Stripe(key);

const PLACEHOLDER_HEAD_OFFICE = { line1: "Rue de l'Exemple 1", city: "Brussels", postal_code: "1000", country: "BE" };

async function setupTax() {
  console.log("Stripe Tax");
  await stripe.tax.settings.update({
    head_office: { address: PLACEHOLDER_HEAD_OFFICE },
    defaults: { tax_behavior: "inclusive" },
  });
  console.log("  ✓ head office (placeholder Brussels address), prices include VAT");

  const regs = await stripe.tax.registrations.list({ limit: 100 });
  const be = regs.data.find((r) => r.country === "BE" && r.status !== "expired");
  if (be) {
    console.log(`  ✓ Belgian registration already ${be.status}`);
  } else {
    await stripe.tax.registrations.create({
      country: "BE",
      country_options: { be: { type: "standard", standard: { place_of_supply_scheme: "standard" } } },
      active_from: "now",
    });
    console.log("  ✓ Belgian registration created");
  }

  const settings = await stripe.tax.settings.retrieve();
  console.log(`  status: ${settings.status}`);

  // Sample: one €1.50 booking fee (VAT included) for a Belgian customer.
  const calc = await stripe.tax.calculations.create({
    currency: "eur",
    line_items: [{ amount: 150, reference: "booking-fee", tax_code: BOOKING_FEE_TAX_CODE, tax_behavior: "inclusive" }],
    customer_details: { address: { country: "BE", postal_code: "1000" }, address_source: "billing" },
  });
  console.log(`  sample: €1.50 fee includes €${(calc.tax_amount_inclusive / 100).toFixed(2)} VAT`);
}

type V2Account = Stripe.V2.Core.Account;

async function findExisting(): Promise<Map<string, V2Account>> {
  const byOperator = new Map<string, V2Account>();
  for await (const a of stripe.v2.core.accounts.list({ limit: 20 })) {
    const op = (a.metadata as Record<string, string> | undefined)?.allaboard_operator;
    if (op && !a.closed) byOperator.set(op, a);
  }
  return byOperator;
}

async function setupOperators() {
  console.log("Connect operator accounts");
  const existing = await findExisting();
  const now = new Date().toISOString();
  let blocked = false;

  for (const [operator, country] of Object.entries(OPERATOR_COUNTRY)) {
    let account = existing.get(operator);
    if (!account && !blocked) {
      try {
        account = await stripe.v2.core.accounts.create({
          display_name: `${operator} (test)`,
          contact_email: `operator+${operator.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@example.com`,
          dashboard: "none",
          identity: {
            country: country.toLowerCase(),
            entity_type: "company",
            business_details: { registered_name: `${operator} (test)` },
            attestations: { terms_of_service: { account: { date: now, ip: "127.0.0.1" } } },
          },
          configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
          defaults: { currency: "eur", responsibilities: { fees_collector: "application", losses_collector: "application" } },
          metadata: { allaboard_operator: operator },
          include: ["configuration.recipient"],
        });
      } catch (err) {
        blocked = true;
        console.log(`  – skipped (Connect not enabled): ${(err as Error).message}`);
        console.log(
          "\n  Connect payouts are optional and not enabled in this sandbox. Payments work without them:\n" +
            "  fares are recorded as owed to each operator and settled outside Stripe.\n" +
            "  To pay operators through Stripe instead: Dashboard (sandbox) → Connect → set up the platform\n" +
            "  as responsible for connected accounts' losses (no Stripe Dashboard), then re-run this script.\n",
        );
      }
    }
    if (!account) continue;
    const transfers = account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status ?? "unknown";
    await prisma.operatorAccount.upsert({
      where: { operator },
      create: { operator, stripeAccountId: account.id, country, transfersStatus: transfers },
      update: { stripeAccountId: account.id, country, transfersStatus: transfers },
    });
    console.log(`  ✓ ${operator.padEnd(14)} ${account.id}  transfers: ${transfers}`);
  }
}

async function main() {
  await setupTax();
  await setupOperators();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
