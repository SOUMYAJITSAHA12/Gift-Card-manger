export type CardType = "flipkart" | "amazon_pay" | "amazon_shopping";

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  flipkart: "Flipkart GC",
  amazon_pay: "Amazon Pay Voucher",
  amazon_shopping: "Amazon Shopping Voucher",
};

export interface GiftCard {
  id: string;
  cardType: CardType;
  cardNumber: string;
  pin: string;
  balance: number | null;
  initialAmount: number | null;
  label: string;
  source: string;
  expiryDate: string | null;
  status: "active" | "used" | "expired" | "unknown";
  lastChecked: string | null;
  createdAt: string;
  notes: string;
}

export interface BalanceCheckResult {
  success: boolean;
  balance?: number;
  currency?: string;
  expiry?: string;
  error?: string;
  cardNumber: string;
}

export type SortField =
  | "cardType"
  | "label"
  | "balance"
  | "createdAt"
  | "expiryDate"
  | "status";
export type SortDirection = "asc" | "desc";

export interface DashboardStats {
  totalCards: number;
  totalBalance: number;
  activeCards: number;
  usedCards: number;
  expiredCards: number;
  unknownCards: number;
  flipkartBalance: number;
  amazonPayBalance: number;
  amazonShoppingBalance: number;
}
