import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const FLIPKART_DCS = [
  "https://1.rome.api.flipkart.com/api/1/egv/balance",
  "https://2.rome.api.flipkart.com/api/1/egv/balance",
];

const FK_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  "x-user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 FKUA/website/42/website/Desktop",
  Origin: "https://www.flipkart.com",
  Referer: "https://www.flipkart.com/",
};

interface SessionCookie {
  name: string;
  value: string;
  domain: string;
}

interface FlipkartResponse {
  STATUS_CODE?: number;
  RESPONSE?: {
    balanceAmount?: number;
    expiryDate?: number;
    message?: string;
    statusCode?: string;
    id?: string;
    dc?: string;
  };
  ERROR_MESSAGE?: string;
  ERROR_CODE?: number;
}

async function loadSessionsFromDB(): Promise<string[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("cookies")
    .eq("is_active", true);

  if (error || !data) return [];

  return data
    .map((row) => {
      const cookies = row.cookies as SessionCookie[];
      return cookies
        .filter((c) => c.domain.includes("flipkart"))
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");
    })
    .filter(Boolean);
}

async function tryWithSession(
  cardNumber: string,
  pin: string,
  cookieStr: string
): Promise<{ success: boolean; balance?: number; expiry?: string; error?: string } | null> {
  for (const url of FLIPKART_DCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { ...FK_HEADERS, Cookie: cookieStr },
        body: JSON.stringify({ cardNumber, pin }),
        signal: AbortSignal.timeout(20000),
      });

      if (res.status === 500) {
        return {
          success: false,
          error: "Card is expired or deactivated (Flipkart returned server error)",
        };
      }

      const data: FlipkartResponse = await res.json();

      if (data.ERROR_CODE === 2000 || (res.status === 406 && data.RESPONSE?.dc)) {
        continue;
      }

      if (res.status === 401) return null;

      if (
        data.RESPONSE?.statusCode === "SUCCESS" &&
        data.RESPONSE.balanceAmount !== undefined
      ) {
        const expiry = data.RESPONSE.expiryDate
          ? new Date(data.RESPONSE.expiryDate).toISOString().slice(0, 10)
          : null;
        return {
          success: true,
          balance: data.RESPONSE.balanceAmount,
          expiry: expiry ?? undefined,
        };
      }

      if (
        data.RESPONSE?.message &&
        data.RESPONSE.message.toLowerCase().includes("zero balance")
      ) {
        return { success: true, balance: 0 };
      }

      if (data.RESPONSE?.message && data.RESPONSE.message !== "SUCCESS") {
        return { success: false, error: `Flipkart: ${data.RESPONSE.message}` };
      }

      if (data.ERROR_MESSAGE) {
        return { success: false, error: data.ERROR_MESSAGE };
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cardNumber, pin } = body;

    if (!cardNumber || !pin) {
      return NextResponse.json(
        { success: false, error: "Card number and PIN are required" },
        { status: 400 }
      );
    }

    const cleanCard = cardNumber.replace(/\s+/g, "");
    const cleanPin = pin.replace(/\s+/g, "");

    const sessions = await loadSessionsFromDB();

    if (sessions.length === 0) {
      return NextResponse.json({
        success: false,
        cardNumber: cleanCard,
        error:
          "No Flipkart sessions found. Add sessions via the Session Manager.",
      });
    }

    for (const cookieStr of sessions) {
      const result = await tryWithSession(cleanCard, cleanPin, cookieStr);
      if (result) {
        return NextResponse.json({ ...result, cardNumber: cleanCard });
      }
    }

    return NextResponse.json({
      success: false,
      cardNumber: cleanCard,
      error:
        "All sessions expired or failed. Add fresh sessions via the Session Manager.",
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error occurred";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
