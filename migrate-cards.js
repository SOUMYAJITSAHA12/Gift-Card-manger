// Paste this in browser DevTools console (F12) at http://localhost:3000
// It reads cards from old localStorage and pushes them to Supabase via API

(async () => {
  const raw = localStorage.getItem("flipkart_gift_cards") || localStorage.getItem("gift_cards_manager");
  if (!raw) {
    console.log("No cards found in localStorage");
    return;
  }

  const cards = JSON.parse(raw);
  console.log(`Found ${cards.length} cards to migrate...`);

  let success = 0, failed = 0;
  for (const card of cards) {
    const res = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardType: card.cardType || "flipkart",
        cardNumber: card.cardNumber,
        pin: card.pin || "",
        balance: card.balance,
        initialAmount: card.initialAmount,
        label: card.label || "",
        source: card.source || "",
        expiryDate: card.expiryDate || null,
        status: card.status || "unknown",
        lastChecked: card.lastChecked || null,
        notes: card.notes || "",
      }),
    });

    if (res.ok) {
      success++;
      console.log(`  OK: ${card.cardNumber.slice(-4)}`);
    } else {
      failed++;
      const err = await res.json();
      console.log(`  FAIL: ${card.cardNumber.slice(-4)} — ${err.error}`);
    }
  }

  console.log(`Done! ${success} migrated, ${failed} failed.`);
  console.log("Refresh the page to see your cards.");
})();
