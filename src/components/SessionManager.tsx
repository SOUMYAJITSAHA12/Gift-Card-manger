"use client";

import { useState, useEffect } from "react";

interface Session {
  id: string;
  name: string;
  created_at: string;
  is_active: boolean;
}

export default function SessionManager({ onClose }: { onClose: () => void }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [cookieJson, setCookieJson] = useState("");
  const [error, setError] = useState("");

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      setSessions(data);
    } catch {
      setError("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleAdd = async () => {
    setError("");
    let cookies;
    try {
      cookies = JSON.parse(cookieJson);
      if (!Array.isArray(cookies)) {
        setError("JSON must be an array of cookie objects");
        return;
      }
    } catch {
      setError("Invalid JSON. Paste the exported cookie array.");
      return;
    }

    setAdding(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), cookies }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to add session");
        return;
      }
      setName("");
      setCookieJson("");
      await fetchSessions();
    } catch {
      setError("Network error");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this session?")) return;
    try {
      await fetch("/api/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await fetchSessions();
    } catch {
      setError("Failed to delete session");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
          <h2 className="text-lg font-semibold text-gray-900">Session Manager</h2>
          <p className="text-xs text-gray-500 mt-1">
            Manage Flipkart browser sessions for auto balance checking
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Active sessions list */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Active Sessions ({sessions.length})
            </h3>
            {loading ? (
              <p className="text-xs text-gray-400">Loading...</p>
            ) : sessions.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500">No sessions yet. Add one below.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {s.name || "Unnamed session"}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        Added {new Date(s.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add new session */}
          <div className="border-t border-gray-200 pt-5">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Add New Session</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Label (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Phone number or account name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Cookie JSON *
                </label>
                <textarea
                  rows={6}
                  placeholder='Paste exported cookie JSON array here...\n[\n  { "name": "T", "value": "...", "domain": ".flipkart.com" },\n  ...\n]'
                  value={cookieJson}
                  onChange={(e) => setCookieJson(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}

              <button
                onClick={handleAdd}
                disabled={!cookieJson.trim() || adding}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {adding ? "Adding..." : "Add Session"}
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <p className="text-xs font-semibold text-blue-800">
              How to get cookie JSON:
            </p>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
              <li>Install <strong>Cookie-Editor</strong> extension in your browser</li>
              <li>Log in to <a href="https://www.flipkart.com" target="_blank" rel="noopener noreferrer" className="underline">flipkart.com</a></li>
              <li>Click the Cookie-Editor icon → <strong>Export → JSON</strong></li>
              <li>Paste the JSON array above and click &quot;Add Session&quot;</li>
            </ol>
            <p className="text-[10px] text-blue-600 mt-2">
              Sessions typically last 7-14 days. Add multiple accounts for redundancy.
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
