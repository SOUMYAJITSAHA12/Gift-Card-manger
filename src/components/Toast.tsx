"use client";

import { useEffect } from "react";

interface Props {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
}

const COLORS = {
  success: "bg-green-600",
  error: "bg-red-600",
  info: "bg-blue-600",
};

export default function Toast({ message, type, onClose }: Props) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-[60] ${COLORS[type]} text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-3 animate-slide-up`}
    >
      {message}
      <button
        onClick={onClose}
        className="text-white/70 hover:text-white text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}
