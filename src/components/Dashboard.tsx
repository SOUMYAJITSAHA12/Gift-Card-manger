"use client";

import { DashboardStats } from "@/lib/types";

interface Props {
  stats: DashboardStats;
  activeFilter: string;
  onFilterClick: (status: string) => void;
}

export default function Dashboard({ stats, activeFilter, onFilterClick }: Props) {
  const statusCards = [
    {
      label: "Total Cards",
      value: stats.totalCards,
      color: "bg-blue-500",
      filterKey: "all",
    },
    {
      label: "Active",
      value: stats.activeCards,
      color: "bg-green-500",
      filterKey: "active",
    },
    {
      label: "Used",
      value: stats.usedCards,
      color: "bg-gray-500",
      filterKey: "used",
    },
    {
      label: "Expired",
      value: stats.expiredCards,
      color: "bg-red-500",
      filterKey: "expired",
    },
  ];

  const balanceCards = [
    {
      label: "Total Balance",
      value: stats.totalBalance,
      color: "bg-emerald-500",
    },
    {
      label: "Flipkart",
      value: stats.flipkartBalance,
      color: "bg-yellow-500",
    },
    {
      label: "Amazon Pay",
      value: stats.amazonPayBalance,
      color: "bg-orange-500",
    },
    {
      label: "Amazon Shopping",
      value: stats.amazonShoppingBalance,
      color: "bg-sky-500",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Status tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statusCards.map((card) => {
          const isActive = card.filterKey === activeFilter;
          return (
            <div
              key={card.label}
              onClick={() => onFilterClick(card.filterKey)}
              className={`bg-white rounded-xl border p-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${
                isActive
                  ? "border-blue-400 ring-2 ring-blue-100"
                  : "border-gray-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${card.color}`} />
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                  {card.label}
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {card.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Balance breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {balanceCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${card.color}`} />
              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                {card.label}
              </span>
            </div>
            <div className="text-xl font-bold text-gray-900">
              ₹{card.value.toLocaleString("en-IN")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
