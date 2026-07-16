import { ensureSheetSetup, TABS } from "../lib/sheets/bootstrap";

async function main() {
  console.log("Bootstrapping the AI Budgetter spreadsheet…");
  await ensureSheetSetup();
  console.log("Tabs ready:");
  for (const [tab, headers] of Object.entries(TABS)) {
    console.log(`  - ${tab} (${headers.join(", ")})`);
  }
  console.log(
    "\nDone. Categories are seeded per user on their first sign-in, so a fresh sheet only needs tabs + headers.",
  );
}

main().catch((err) => {
  console.error("Bootstrap failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
