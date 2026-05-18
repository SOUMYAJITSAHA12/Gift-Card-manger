"use client";

import { useState, useEffect } from "react";
import SessionManager from "./SessionManager";

interface SessionInfo {
  status: "healthy" | "warning" | "expired" | "empty" | "error";
  count: number;
  oldestDaysAgo?: number | null;
  message: string;
}

export default function SessionStatus() {
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [showManager, setShowManager] = useState(false);

  const fetchStatus = () => {
    fetch("/api/session-status")
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo({ status: "error", count: 0, message: "Could not check sessions" }));
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (!info) return null;

  const colors: Record<string, string> = {
    healthy: "bg-green-500",
    warning: "bg-amber-500",
    expired: "bg-red-500",
    empty: "bg-red-500",
    error: "bg-gray-500",
  };

  const textColors: Record<string, string> = {
    healthy: "text-green-700",
    warning: "text-amber-700",
    expired: "text-red-700",
    empty: "text-red-700",
    error: "text-gray-700",
  };

  return (
    <>
      <button
        onClick={() => setShowManager(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-gray-100 ${textColors[info.status]}`}
        title="Flipkart session status — click to manage"
      >
        <span className={`w-2 h-2 rounded-full ${colors[info.status]} ${info.status === "warning" ? "animate-pulse" : ""}`} />
        {info.status === "healthy"
          ? `${info.count} session${info.count > 1 ? "s" : ""}`
          : info.status === "warning"
            ? "Sessions aging"
            : "No sessions"}
      </button>

      {showManager && (
        <SessionManager
          onClose={() => {
            setShowManager(false);
            fetchStatus();
          }}
        />
      )}
    </>
  );
}
