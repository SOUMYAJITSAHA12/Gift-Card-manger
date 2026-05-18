import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("sessions")
      .select("id, created_at, is_active")
      .eq("is_active", true);

    if (error) {
      return NextResponse.json({
        status: "error",
        count: 0,
        message: error.message,
      });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        status: "empty",
        count: 0,
        message: "No active sessions. Add one via Session Manager.",
      });
    }

    const oldest = data
      .map((s) => new Date(s.created_at).getTime())
      .sort((a, b) => a - b)[0];

    const daysSinceOldest = Math.floor((Date.now() - oldest) / 86400000);

    let status: "healthy" | "warning" | "expired";
    if (daysSinceOldest > 14) {
      status = "expired";
    } else if (daysSinceOldest > 7) {
      status = "warning";
    } else {
      status = "healthy";
    }

    return NextResponse.json({
      status,
      count: data.length,
      oldestDaysAgo: daysSinceOldest,
      message:
        status === "healthy"
          ? `${data.length} active session(s)`
          : status === "warning"
            ? `Sessions are ${daysSinceOldest}+ days old — may be expired`
            : `Sessions are ${daysSinceOldest}+ days old — likely expired`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ status: "error", count: 0, message }, { status: 500 });
  }
}
