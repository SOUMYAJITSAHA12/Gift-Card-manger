"use client";

import { useState, useRef } from "react";
import { parseCSV } from "@/lib/api";
import { GiftCard } from "@/lib/types";

interface Props {
  onImport: (cards: Omit<GiftCard, "id" | "createdAt">[]) => void;
  onClose: () => void;
}

const SAMPLE_CSV = `Card Type,Card Number,PIN,Balance,Initial Amount,Label,Source,Expiry Date,Status,Last Checked,Notes
flipkart,1234567890123456,123456,500,500,Birthday Gift,Woohoo,2027-12-31,active,,My first card
amazon_pay,RPDT-GW67EN-78JF,,1000,1000,,Amazon,,active,,Amazon Pay voucher
amazon_shopping,SVHV3HZFQYFA7,,200,200,,Amazon,,active,,Shopping voucher`;

export default function BulkImport({ onImport, onClose }: Props) {
  const [csvText, setCsvText] = useState("");
  const [parsed, setParsed] = useState<Omit<GiftCard, "id" | "createdAt">[]>(
    []
  );
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleParse = (text: string) => {
    setCsvText(text);
    setError("");
    try {
      const result = parseCSV(text);
      if (result.length === 0) {
        setError("No valid rows found. Make sure your CSV has a header row.");
        setParsed([]);
      } else {
        setParsed(result);
      }
    } catch {
      setError("Failed to parse CSV. Check format.");
      setParsed([]);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleParse(reader.result as string);
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
          <h2 className="text-lg font-semibold text-gray-900">
            Bulk Import Gift Cards
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Upload a CSV file or paste CSV data below
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Upload CSV File
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFile}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
          </div>

          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-600">
                Or Paste CSV Data
              </label>
              <button
                onClick={() => handleParse(SAMPLE_CSV)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Load sample
              </button>
            </div>
            <textarea
              rows={8}
              value={csvText}
              onChange={(e) => handleParse(e.target.value)}
              placeholder={`Card Type,Card Number,PIN,Balance,Initial Amount,Label,Source,Expiry Date,Status,Last Checked,Notes\nflipkart,1234567890123456,123456,500,500,My Card,Woohoo,2027-12-31,active,,`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg">
              {error}
            </div>
          )}

          {parsed.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-medium text-green-800">
                ✓ {parsed.length} card(s) ready to import
              </p>
              <div className="mt-2 max-h-32 overflow-y-auto">
                {parsed.map((c, i) => (
                  <div
                    key={i}
                    className="text-xs text-green-700 font-mono py-0.5"
                  >
                    {c.cardNumber.slice(-4).padStart(c.cardNumber.length, "•")}{" "}
                    — {c.label || "No label"} —{" "}
                    {c.balance ? `₹${c.balance}` : "No balance"}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-3 justify-end rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (parsed.length > 0) onImport(parsed);
            }}
            disabled={parsed.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Import {parsed.length} Card(s)
          </button>
        </div>
      </div>
    </div>
  );
}
