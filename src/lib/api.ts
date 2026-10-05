import { GiftCard, BalanceCheckResult, DashboardStats } from "./types";

export async function fetchCards(): Promise<GiftCard[]> {
  const res = await fetch("/api/cards");
  if (!res.ok) throw new Error("Failed to fetch cards");
  return res.json();
}

export async function createCard(
  card: Omit<GiftCard, "id" | "createdAt">
): Promise<GiftCard> {
  const res = await fetch("/api/cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  });
  if (res.status === 409) throw new Error("Card number already exists");
  if (!res.ok) throw new Error("Failed to create card");
  return res.json();
}

export async function updateCard(
  id: string,
  updates: Partial<GiftCard>
): Promise<void> {
  const res = await fetch("/api/cards", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...updates }),
  });
  if (!res.ok) throw new Error("Failed to update card");
}

export async function deleteCards(ids: string[]): Promise<void> {
  const res = await fetch("/api/cards", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error("Failed to delete cards");
}

const LOCAL_CHECKER = "http://127.0.0.1:3000/api/check-balance";

async function postBalance(
  url: string,
  cardNumber: string,
  pin: string,
  timeoutMs?: number
): Promise<BalanceCheckResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardNumber, pin }),
    signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
  });
  return res.json();
}

export async function checkBalance(
  cardNumber: string,
  pin: string
): Promise<BalanceCheckResult> {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const servedLocally = host === "localhost" || host === "127.0.0.1";

  // Flipkart only answers home networks, so prefer the app running on this LAN.
  if (!servedLocally) {
    try {
      return await postBalance(LOCAL_CHECKER, cardNumber, pin, 5000);
    } catch {
      // Fall through to the hosted checker.
    }
  }

  return postBalance("/api/check-balance", cardNumber, pin);
}

export function computeStats(cards: GiftCard[]): DashboardStats {
  const active = cards.filter(
    (c) => c.status !== "used" && c.status !== "expired"
  );
  const balanceByType = (type: string) =>
    active
      .filter((c) => c.cardType === type)
      .reduce((sum, c) => sum + (c.balance ?? 0), 0);

  return {
    totalCards: active.length,
    totalBalance: active.reduce((sum, c) => sum + (c.balance ?? 0), 0),
    activeCards: cards.filter((c) => c.status === "active").length,
    usedCards: cards.filter((c) => c.status === "used").length,
    expiredCards: cards.filter((c) => c.status === "expired").length,
    unknownCards: cards.filter((c) => c.status === "unknown").length,
    flipkartBalance: balanceByType("flipkart"),
    amazonPayBalance: balanceByType("amazon_pay"),
    amazonShoppingBalance: balanceByType("amazon_shopping"),
  };
}

export function exportToCSV(cards: GiftCard[]): string {
  const headers = [
    "Card Type",
    "Card Number",
    "PIN",
    "Balance",
    "Initial Amount",
    "Label",
    "Source",
    "Expiry Date",
    "Status",
    "Last Checked",
    "Notes",
  ];
  const rows = cards.map((c) => [
    c.cardType || "flipkart",
    c.cardNumber,
    c.pin,
    c.balance?.toString() ?? "",
    c.initialAmount?.toString() ?? "",
    c.label,
    c.source,
    c.expiryDate ?? "",
    c.status,
    c.lastChecked ?? "",
    c.notes,
  ]);
  const escape = (v: string) =>
    v.includes(",") || v.includes('"') || v.includes("\n")
      ? `"${v.replace(/"/g, '""')}"`
      : v;
  return [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join(
    "\n"
  );
}

export function parseCSV(csv: string): Omit<GiftCard, "id" | "createdAt">[] {
  const lines = csv
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const hasCardType =
    headers[0]?.toLowerCase().includes("card type") ||
    headers[0]?.toLowerCase().includes("type");

  return lines.slice(1).map((line) => {
    const cols = parseRow(line);
    if (hasCardType) {
      return {
        cardType: (cols[0] as GiftCard["cardType"]) || "flipkart",
        cardNumber: cols[1] || "",
        pin: cols[2] || "",
        balance: cols[3] ? parseFloat(cols[3]) : null,
        initialAmount: cols[4] ? parseFloat(cols[4]) : null,
        label: cols[5] || "",
        source: cols[6] || "",
        expiryDate: cols[7] || null,
        status: (cols[8] as GiftCard["status"]) || "unknown",
        lastChecked: cols[9] || null,
        notes: cols[10] || "",
      };
    }
    return {
      cardType: "flipkart" as const,
      cardNumber: cols[0] || "",
      pin: cols[1] || "",
      balance: cols[2] ? parseFloat(cols[2]) : null,
      initialAmount: cols[3] ? parseFloat(cols[3]) : null,
      label: cols[4] || "",
      source: cols[5] || "",
      expiryDate: cols[6] || null,
      status: (cols[7] as GiftCard["status"]) || "unknown",
      lastChecked: cols[8] || null,
      notes: cols[9] || "",
    };
  });
}
