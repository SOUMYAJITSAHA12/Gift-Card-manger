"use client";

import { useState, useEffect, useCallback } from "react";
import { GiftCard, BalanceCheckResult, DashboardStats, CARD_TYPE_LABELS } from "@/lib/types";
import {
  fetchCards,
  createCard,
  updateCard,
  deleteCards,
  checkBalance,
  computeStats,
  exportToCSV,
} from "@/lib/api";
import Dashboard from "@/components/Dashboard";
import CardTable from "@/components/CardTable";
import CardForm from "@/components/CardForm";
import BulkImport from "@/components/BulkImport";
import Toast from "@/components/Toast";
import SessionStatus from "@/components/SessionStatus";

export default function Home() {
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalCards: 0,
    totalBalance: 0,
    activeCards: 0,
    usedCards: 0,
    expiredCards: 0,
    unknownCards: 0,
    flipkartBalance: 0,
    amazonPayBalance: 0,
    amazonShoppingBalance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState<GiftCard | undefined>();
  const [showImport, setShowImport] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchCards();
      setCards(data);
      setStats(computeStats(data));
    } catch {
      setToast({ message: "Failed to load cards", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (cards.length === 0) return;
    const BACKUP_KEY = "gc_last_backup";
    const BACKUP_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days
    const lastBackup = localStorage.getItem(BACKUP_KEY);
    const now = Date.now();

    if (!lastBackup || now - parseInt(lastBackup) > BACKUP_INTERVAL) {
      const csv = exportToCSV(cards);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gc-backup-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      localStorage.setItem(BACKUP_KEY, now.toString());
      setToast({ message: "Weekly backup downloaded", type: "info" });
    }
  }, [cards]);

  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
  };

  const handleAddCard = async (data: Omit<GiftCard, "id" | "createdAt">) => {
    try {
      const newCard = await createCard(data);
      await refresh();
      setShowForm(false);
      if (data.cardType === "flipkart") {
        showToast("Card added — fetching balance...", "info");
        handleCheckBalance(newCard);
      } else {
        showToast("Card added successfully", "success");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add card";
      showToast(msg, "error");
    }
  };

  const handleEditCard = async (data: Omit<GiftCard, "id" | "createdAt">) => {
    if (editingCard) {
      try {
        await updateCard(editingCard.id, data);
        await refresh();
        setEditingCard(undefined);
        setShowForm(false);
        showToast("Card updated successfully", "success");
      } catch {
        showToast("Failed to update card", "error");
      }
    }
  };

  const handleDeleteCard = async (id: string) => {
    try {
      await deleteCards([id]);
      selectedIds.delete(id);
      setSelectedIds(new Set(selectedIds));
      await refresh();
      showToast("Card deleted", "info");
    } catch {
      showToast("Failed to delete card", "error");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!confirm(`Delete ${count} selected card(s)?`)) return;
    try {
      await deleteCards(Array.from(selectedIds));
      setSelectedIds(new Set());
      await refresh();
      showToast(`Deleted ${count} card(s)`, "info");
    } catch {
      showToast("Failed to delete cards", "error");
    }
  };

  const handleImport = async (
    imported: Omit<GiftCard, "id" | "createdAt">[]
  ) => {
    const existingNumbers = new Set(cards.map((c) => c.cardNumber.replace(/\s+/g, "")));
    const unique = imported.filter(
      (c) => !existingNumbers.has(c.cardNumber.replace(/\s+/g, ""))
    );
    const skipped = imported.length - unique.length;

    if (unique.length === 0) {
      setShowImport(false);
      showToast(
        `All ${imported.length} card(s) already exist — nothing imported`,
        "error"
      );
      return;
    }

    setShowImport(false);
    const newCards: GiftCard[] = [];
    for (const c of unique) {
      try {
        const card = await createCard(c);
        newCards.push(card);
      } catch {
        // skip duplicates silently
      }
    }
    await refresh();

    const flipkartCards = newCards.filter((c) => c.cardType === "flipkart");
    if (flipkartCards.length === 0) {
      const msg = skipped > 0
        ? `Imported ${newCards.length} card(s), skipped ${skipped} duplicate(s)`
        : `Imported ${newCards.length} card(s)`;
      showToast(msg, "success");
      return;
    }

    const msg = skipped > 0
      ? `Imported ${newCards.length} card(s), skipped ${skipped} duplicate(s) — fetching Flipkart balances...`
      : `Imported ${newCards.length} card(s) — fetching Flipkart balances...`;
    showToast(msg, "info");

    for (const card of flipkartCards) {
      await handleCheckBalance(card);
      await new Promise((r) => setTimeout(r, 1500));
    }
    showToast("All balances fetched", "success");
  };

  const handleExport = () => {
    const target =
      selectedIds.size > 0
        ? cards.filter((c) => selectedIds.has(c.id))
        : cards;
    const csv = exportToCSV(target);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gift-cards-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${target.length} card(s)`, "success");
  };

  const handleCheckBalance = async (card: GiftCard) => {
    setCheckingIds((prev) => new Set(prev).add(card.id));
    try {
      const data: BalanceCheckResult = await checkBalance(card.cardNumber, card.pin);
      if (data.success && data.balance !== undefined) {
        await updateCard(card.id, {
          balance: data.balance,
          lastChecked: new Date().toISOString(),
          status: data.balance > 0 ? "active" : "used",
          expiryDate: data.expiry ?? card.expiryDate,
        });
        await refresh();
        showToast(
          `Balance: ₹${data.balance.toLocaleString("en-IN")}`,
          "success"
        );
      } else if (
        data.error &&
        (data.error.toLowerCase().includes("expired") ||
          data.error.toLowerCase().includes("deactivated"))
      ) {
        await updateCard(card.id, {
          balance: 0,
          lastChecked: new Date().toISOString(),
          status: "expired",
        });
        await refresh();
        showToast("Card is expired or deactivated", "error");
      } else {
        showToast(data.error || "Could not check balance", "error");
      }
    } catch {
      showToast("Network error checking balance", "error");
    } finally {
      setCheckingIds((prev) => {
        const next = new Set(prev);
        next.delete(card.id);
        return next;
      });
    }
  };

  const handleBulkCheckBalance = async () => {
    const all =
      selectedIds.size > 0
        ? cards.filter((c) => selectedIds.has(c.id))
        : cards;
    const targets = all.filter((c) => c.cardType === "flipkart");
    if (targets.length === 0) {
      showToast("No Flipkart cards to check (Amazon/Vouchers need manual balance)", "info");
      return;
    }
    if (
      !confirm(
        `Check balance for ${targets.length} Flipkart card(s)? This may take a while.`
      )
    )
      return;
    showToast(`Checking ${targets.length} card(s)...`, "info");
    for (const card of targets) {
      await handleCheckBalance(card);
      await new Promise((r) => setTimeout(r, 1500));
    }
    showToast("Bulk balance check complete", "success");
  };

  const handleMarkUsed = async (card: GiftCard) => {
    if (card.status === "used") {
      if (!confirm("Restore this voucher to active?")) return;
      await updateCard(card.id, { status: "active", balance: card.initialAmount ?? 0 });
      await refresh();
      showToast("Restored to active", "info");
    } else {
      if (!confirm(`Mark voucher ••••${card.cardNumber.slice(-4)} (₹${card.balance?.toLocaleString("en-IN") ?? 0}) as used?`)) return;
      await updateCard(card.id, { status: "used", balance: 0 });
      await refresh();
      showToast("Marked as used", "info");
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied`, "info");
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCards.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCards.map((c) => c.id)));
    }
  };

  const filteredCards = cards.filter((card) => {
    const matchesSearch =
      searchQuery === "" ||
      card.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.cardNumber.includes(searchQuery) ||
      card.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.notes.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      filterStatus === "all"
        ? card.status !== "used" && card.status !== "expired" && card.balance !== 0
        : card.status === filterStatus;

    const matchesType =
      filterType === "all" || card.cardType === filterType;

    return matchesSearch && matchesFilter && matchesType;
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">🎁</div>
          <p className="text-gray-500 text-sm">Loading cards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-lg">🎁</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  Gift Card Manager
                </h1>
                <p className="text-[10px] text-gray-400 -mt-0.5">
                  Flipkart, Amazon Pay &amp; Amazon Shopping Vouchers
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <SessionStatus />
              <button
                onClick={() => {
                  setEditingCard(undefined);
                  setShowForm(true);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                + Add Card
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Dashboard Stats */}
        <Dashboard stats={stats} activeFilter={filterStatus} onFilterClick={setFilterStatus} />

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-1 gap-3 items-center w-full sm:w-auto">
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                placeholder="Search cards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                🔍
              </span>
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="all">All Types</option>
              {Object.entries(CARD_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="used">Used</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <div className="flex gap-2 flex-wrap">
            {selectedIds.size > 0 && (
              <>
                <span className="px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg">
                  {selectedIds.size} selected
                </span>
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                >
                  Delete Selected
                </button>
              </>
            )}
            <button
              onClick={handleBulkCheckBalance}
              className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              🔄 Check {selectedIds.size > 0 ? "Selected" : "All"} Balance
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              📥 Import CSV
            </button>
            <button
              onClick={handleExport}
              disabled={cards.length === 0}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              📤 Export CSV
            </button>
          </div>
        </div>

        {/* Card Table */}
        <CardTable
          cards={filteredCards}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onEdit={(card) => {
            setEditingCard(card);
            setShowForm(true);
          }}
          onDelete={handleDeleteCard}
          onCheckBalance={handleCheckBalance}
          onMarkUsed={handleMarkUsed}
          onCopy={handleCopy}
          checkingIds={checkingIds}
        />

        {/* Footer Info */}
        <div className="text-center text-xs text-gray-400 py-4">
          <p>
            Data is stored in Supabase. Accessible from any device.
          </p>
          <p className="mt-1">
            Auto balance check for Flipkart GCs. Amazon vouchers: enter code + amount only.
          </p>
        </div>
      </main>

      {/* Modals */}
      {showForm && (
        <CardForm
          card={editingCard}
          isEditing={!!editingCard}
          onSave={editingCard ? handleEditCard : handleAddCard}
          onCancel={() => {
            setShowForm(false);
            setEditingCard(undefined);
          }}
        />
      )}
      {showImport && (
        <BulkImport
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
