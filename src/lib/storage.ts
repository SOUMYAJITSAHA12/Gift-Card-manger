import { GiftCard, DashboardStats } from "./types";

const STORAGE_KEY = "gift_cards_manager";

function generateId(): string {
  return `gc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getCards(): GiftCard[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("flipkart_gift_cards");
  if (!raw) return [];
  try {
    const cards = JSON.parse(raw) as GiftCard[];
    return cards.map((c) => ({ ...c, cardType: c.cardType || "flipkart" }));
  } catch {
    return [];
  }
}

export function saveCards(cards: GiftCard[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

export function cardExists(cardNumber: string): boolean {
  const clean = cardNumber.replace(/\s+/g, "");
  return getCards().some((c) => c.cardNumber.replace(/\s+/g, "") === clean);
}

export function addCard(
  card: Omit<GiftCard, "id" | "createdAt">
): GiftCard {
  const cards = getCards();
  const newCard: GiftCard = {
    ...card,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  cards.push(newCard);
  saveCards(cards);
  return newCard;
}

export function updateCard(
  id: string,
  updates: Partial<GiftCard>
): GiftCard | null {
  const cards = getCards();
  const idx = cards.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  cards[idx] = { ...cards[idx], ...updates };
  saveCards(cards);
  return cards[idx];
}

export function deleteCard(id: string): boolean {
  const cards = getCards();
  const filtered = cards.filter((c) => c.id !== id);
  if (filtered.length === cards.length) return false;
  saveCards(filtered);
  return true;
}

export function deleteMultipleCards(ids: string[]): number {
  const cards = getCards();
  const idSet = new Set(ids);
  const filtered = cards.filter((c) => !idSet.has(c.id));
  const removed = cards.length - filtered.length;
  saveCards(filtered);
  return removed;
}

export function getStats(): DashboardStats {
  const cards = getCards();
  const active = cards.filter((c) => c.status !== "used" && c.status !== "expired");
  const balanceByType = (type: string) =>
    active.filter((c) => c.cardType === type).reduce((sum, c) => sum + (c.balance ?? 0), 0);
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

export function importFromCSV(csv: string): Omit<GiftCard, "id" | "createdAt">[] {
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
  const hasCardType = headers[0]?.toLowerCase().includes("card type") || headers[0]?.toLowerCase().includes("type");

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
