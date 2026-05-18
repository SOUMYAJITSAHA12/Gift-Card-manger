"use client";

import { useState } from "react";
import { AppSettings } from "@/lib/settings";

interface Props {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
}

export default function Settings({ settings, onSave, onClose }: Props) {
  const [fkCookie, setFkCookie] = useState(settings.fkCookie);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
          <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
          <p className="text-xs text-gray-500 mt-1">
            Configure Flipkart session for balance checking
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Flipkart Session Cookie
            </label>
            <textarea
              rows={4}
              value={fkCookie}
              onChange={(e) => setFkCookie(e.target.value)}
              placeholder="Paste your Flipkart cookie string here..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <p className="text-xs font-semibold text-blue-800">
              How to get your Flipkart cookie:
            </p>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
              <li>
                Open{" "}
                <a
                  href="https://www.flipkart.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  flipkart.com
                </a>{" "}
                and make sure you&apos;re logged in
              </li>
              <li>
                Press <kbd className="px-1 py-0.5 bg-blue-100 rounded text-[10px]">F12</kbd> to
                open DevTools
              </li>
              <li>
                Go to <strong>Application</strong> tab → <strong>Cookies</strong> →{" "}
                <strong>https://www.flipkart.com</strong>
              </li>
              <li>
                Find the cookie named <code className="bg-blue-100 px-1 rounded">T</code> — copy
                its full value
              </li>
              <li>
                Paste it here as: <code className="bg-blue-100 px-1 rounded">T=value_here</code>
              </li>
            </ol>
            <p className="text-[10px] text-blue-600 mt-2">
              Your cookie is stored locally in your browser and never sent to any
              third party — only to Flipkart&apos;s own API.
            </p>
          </div>

          {fkCookie && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              <p className="text-xs text-green-700">
                ✓ Cookie configured ({fkCookie.length} chars)
              </p>
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
            onClick={() => onSave({ fkCookie: fkCookie.trim() })}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
