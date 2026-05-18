"use client";

import { useState } from "react";
import { GiftCard, CardType, CARD_TYPE_LABELS } from "@/lib/types";

interface Props {
  card?: GiftCard;
  onSave: (data: Omit<GiftCard, "id" | "createdAt">) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

export default function CardForm({ card, onSave, onCancel, isEditing }: Props) {
  const [formData, setFormData] = useState({
    cardType: (card?.cardType ?? "flipkart") as CardType,
    cardNumber: card?.cardNumber ?? "",
    pin: card?.pin ?? "",
    balance: card?.balance?.toString() ?? "",
  });

  const isVoucher = formData.cardType === "amazon_pay" || formData.cardType === "amazon_shopping";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const balance = formData.balance ? parseFloat(formData.balance) : null;

    onSave({
      cardType: formData.cardType,
      cardNumber: formData.cardNumber.trim(),
      pin: isVoucher ? "" : formData.pin.trim(),
      balance: isVoucher ? balance : (card?.balance ?? null),
      initialAmount: isVoucher ? balance : (card?.initialAmount ?? null),
      label: card?.label ?? "",
      source: card?.source ?? "",
      expiryDate: card?.expiryDate ?? null,
      status: isVoucher
        ? (balance && balance > 0 ? "active" : balance === 0 ? "used" : "unknown")
        : (card?.status ?? "unknown"),
      lastChecked: isVoucher && balance !== null
        ? new Date().toISOString()
        : (card?.lastChecked ?? null),
      notes: card?.notes ?? "",
    });
  };

  const fieldClass =
    "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors";

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? "Edit Card" : "Add Card"}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {isVoucher
              ? "Enter voucher code and amount"
              : "Balance will be fetched automatically from Flipkart API"}
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Card Type *
            </label>
            <select
              value={formData.cardType}
              onChange={(e) =>
                setFormData({ ...formData, cardType: e.target.value as CardType })
              }
              disabled={isEditing}
              className={`${fieldClass} ${isEditing ? "bg-gray-50 cursor-not-allowed" : ""}`}
            >
              {Object.entries(CARD_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {isVoucher ? "Voucher Code *" : "Card Number *"}
            </label>
            <input
              type="text"
              required
              placeholder={
                formData.cardType === "amazon_shopping"
                  ? "e.g. SVHV3HZFQYFA7"
                  : formData.cardType === "amazon_pay"
                    ? "e.g. RPDT-GW67EN-78JF"
                    : "16-digit card number"
              }
              value={formData.cardNumber}
              onChange={(e) =>
                setFormData({ ...formData, cardNumber: e.target.value })
              }
              className={fieldClass}
            />
          </div>

          {!isVoucher && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                PIN *
              </label>
              <input
                type="text"
                required
                placeholder="6-digit PIN"
                value={formData.pin}
                onChange={(e) =>
                  setFormData({ ...formData, pin: e.target.value })
                }
                className={fieldClass}
              />
            </div>
          )}

          {isVoucher && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Amount (INR) *
              </label>
              <input
                type="number"
                required
                step="0.01"
                min="0"
                placeholder="Enter voucher amount"
                value={formData.balance}
                onChange={(e) =>
                  setFormData({ ...formData, balance: e.target.value })
                }
                className={fieldClass}
              />
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-3 justify-end rounded-b-2xl">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {isEditing
              ? "Update"
              : isVoucher
                ? "Add Voucher"
                : "Add & Fetch Balance"}
          </button>
        </div>
      </form>
    </div>
  );
}
