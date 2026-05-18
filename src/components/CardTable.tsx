"use client";

import { useState } from "react";
import { GiftCard, SortField, SortDirection, CARD_TYPE_LABELS } from "@/lib/types";

interface Props {
  cards: GiftCard[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onEdit: (card: GiftCard) => void;
  onDelete: (id: string) => void;
  onCheckBalance: (card: GiftCard) => void;
  onMarkUsed: (card: GiftCard) => void;
  onCopy: (text: string, label: string) => void;
  checkingIds: Set<string>;
}

function maskCard(num: string): string {
  if (num.length <= 4) return num;
  return "•".repeat(num.length - 4) + num.slice(-4);
}

export default function CardTable({
  cards,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onDelete,
  onCheckBalance,
  onMarkUsed,
  onCopy,
  checkingIds,
}: Props) {
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [revealedPins, setRevealedPins] = useState<Set<string>>(new Set());
  const [revealedCards, setRevealedCards] = useState<Set<string>>(new Set());

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sorted = [...cards].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    switch (sortField) {
      case "cardType":
        return mul * (a.cardType || "").localeCompare(b.cardType || "");
      case "label":
        return mul * a.label.localeCompare(b.label);
      case "balance":
        return mul * ((a.balance ?? 0) - (b.balance ?? 0));
      case "createdAt":
        return mul * a.createdAt.localeCompare(b.createdAt);
      case "expiryDate":
        return mul * (a.expiryDate ?? "").localeCompare(b.expiryDate ?? "");
      case "status":
        return mul * a.status.localeCompare(b.status);
      default:
        return 0;
    }
  });

  const togglePin = (id: string) => {
    const next = new Set(revealedPins);
    next.has(id) ? next.delete(id) : next.add(id);
    setRevealedPins(next);
  };

  const toggleCard = (id: string) => {
    const next = new Set(revealedCards);
    next.has(id) ? next.delete(id) : next.add(id);
    setRevealedCards(next);
  };

  const SortHeader = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
    <th
      onClick={() => toggleSort(field)}
      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 select-none"
    >
      <span className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <span className="text-blue-500">{sortDir === "asc" ? "↑" : "↓"}</span>
        )}
      </span>
    </th>
  );

  if (cards.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="text-4xl mb-3">🎁</div>
        <p className="text-gray-500 text-sm">
          No gift cards yet. Click &quot;Add Card&quot; to get started or import from CSV.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={
                    selectedIds.size === cards.length && cards.length > 0
                  }
                  onChange={onToggleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <SortHeader field="cardType">Type</SortHeader>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Card Number
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                PIN
              </th>
              <SortHeader field="balance">Balance</SortHeader>
              <SortHeader field="expiryDate">Expiry</SortHeader>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((card) => {
              const isChecking = checkingIds.has(card.id);

              return (
                <tr
                  key={card.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    selectedIds.has(card.id) ? "bg-blue-50/50" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(card.id)}
                      onChange={() => onToggleSelect(card.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      card.cardType === "flipkart"
                        ? "bg-yellow-100 text-yellow-800"
                        : card.cardType === "amazon_pay"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-sky-100 text-sky-800"
                    }`}>
                      {CARD_TYPE_LABELS[card.cardType] || "Flipkart GC"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <code className="text-sm text-gray-700 font-mono">
                        {revealedCards.has(card.id)
                          ? card.cardNumber
                          : maskCard(card.cardNumber)}
                      </code>
                      <button
                        onClick={() => toggleCard(card.id)}
                        className="text-gray-400 hover:text-gray-600 text-xs"
                        title={
                          revealedCards.has(card.id)
                            ? "Hide card number"
                            : "Show card number"
                        }
                      >
                        {revealedCards.has(card.id) ? "🙈" : "👁"}
                      </button>
                      <button
                        onClick={() =>
                          onCopy(card.cardNumber, "Card number")
                        }
                        className="text-gray-400 hover:text-gray-600 text-xs"
                        title="Copy card number"
                      >
                        📋
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {card.pin ? (
                      <div className="flex items-center gap-1.5">
                        <code className="text-sm text-gray-700 font-mono">
                          {revealedPins.has(card.id) ? card.pin : "••••••"}
                        </code>
                        <button
                          onClick={() => togglePin(card.id)}
                          className="text-gray-400 hover:text-gray-600 text-xs"
                          title={
                            revealedPins.has(card.id)
                              ? "Hide PIN"
                              : "Show PIN"
                          }
                        >
                          {revealedPins.has(card.id) ? "🙈" : "👁"}
                        </button>
                        <button
                          onClick={() => onCopy(card.pin, "PIN")}
                          className="text-gray-400 hover:text-gray-600 text-xs"
                          title="Copy PIN"
                        >
                          📋
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-semibold text-gray-900">
                      {card.balance !== null
                        ? `₹${card.balance.toLocaleString("en-IN")}`
                        : "—"}
                    </span>
                    {card.lastChecked && (
                      <div className="text-[10px] text-gray-400">
                        {new Date(card.lastChecked).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {card.expiryDate
                      ? new Date(card.expiryDate).toLocaleDateString(
                          "en-IN"
                        )
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {card.cardType === "flipkart" && (
                        <button
                          onClick={() => onCheckBalance(card)}
                          disabled={isChecking}
                          className="p-1.5 text-xs rounded-lg hover:bg-blue-50 text-blue-600 disabled:opacity-50 transition-colors"
                          title="Check balance"
                        >
                          {isChecking ? (
                            <span className="inline-block animate-spin">⟳</span>
                          ) : (
                            "🔄"
                          )}
                        </button>
                      )}
                      {card.cardType !== "flipkart" && card.status !== "used" && (
                        <button
                          onClick={() => onMarkUsed(card)}
                          className="p-1.5 text-xs rounded-lg hover:bg-green-50 text-green-700 transition-colors"
                          title="Mark as used"
                        >
                          ✓
                        </button>
                      )}
                      {card.cardType !== "flipkart" && card.status === "used" && (
                        <button
                          onClick={() => onMarkUsed(card)}
                          className="p-1.5 text-xs rounded-lg hover:bg-amber-50 text-amber-700 transition-colors"
                          title="Undo — mark as active"
                        >
                          ↩
                        </button>
                      )}
                      <button
                        onClick={() => onEdit(card)}
                        className="p-1.5 text-xs rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => {
                          if (
                            confirm("Delete this gift card?")
                          )
                            onDelete(card.id);
                        }}
                        className="p-1.5 text-xs rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
