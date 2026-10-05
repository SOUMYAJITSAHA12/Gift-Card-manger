import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const BALANCE_PATH = "/api/1/egv/balance";

function dcUrl(id: string): string {
  return `https://${id}.rome.api.flipkart.com${BALANCE_PATH}`;
}

export const runtime = "nodejs";
export const preferredRegion = "bom1";

function corsHeaders(request: NextRequest): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": request.headers.get("origin") ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Private-Network": "true",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

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
    id?: string | number;
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

const CLOUDFLARE_PROXY_URL = process.env.CLOUDFLARE_PROXY_URL;
const CLOUDFLARE_PROXY_SECRET = process.env.CLOUDFLARE_PROXY_SECRET;

async function tryViaProxy(
  cardNumber: string,
  pin: string,
  cookieStr: string
): Promise<{ success: boolean; balance?: number; expiry?: string; error?: string } | null> {
  if (!CLOUDFLARE_PROXY_URL || !CLOUDFLARE_PROXY_SECRET) return null;
  try {
    const res = await fetch(CLOUDFLARE_PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CLOUDFLARE_PROXY_SECRET}`,
      },
      body: JSON.stringify({ cardNumber, pin, cookieStr }),
      signal: AbortSignal.timeout(25000),
    });
    const data = await res.json();
    if (data.success !== undefined) return data;
    return null;
  } catch {
    return null;
  }
}

type BalanceResult = {
  success: boolean;
  balance?: number;
  expiry?: string;
  error?: string;
};

function proxyShouldFallBack(result: BalanceResult | null): boolean {
  if (!result) return true;
  if (result.success) return false;
  const error = result.error ?? "";
  return (
    error === "All DCs failed" ||
    error === "Session expired" ||
    error.startsWith("Wrong data center") ||
    error.startsWith("Flipkart redirected") ||
    error.startsWith("Flipkart returned HTTP") ||
    error.startsWith("Could not reach") ||
    error.startsWith("Unexpected Flipkart response")
  );
}

async function tryDirect(
  cardNumber: string,
  pin: string,
  cookieStr: string
): Promise<BalanceResult | null> {
  const queue = [dcUrl("1"), dcUrl("2")];
  const tried = new Set<string>();
  let lastError = "All DCs failed";

  while (queue.length > 0 && tried.size < 4) {
    const url = queue.shift();
    if (!url || tried.has(url)) continue;
    tried.add(url);

    try {
      const res = await fetch(url, {
        method: "POST",
        redirect: "manual",
        headers: { ...FK_HEADERS, Cookie: cookieStr },
        body: JSON.stringify({ cardNumber, pin }),
        signal: AbortSignal.timeout(20000),
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("Location");
        if (location && !tried.has(location)) queue.unshift(location);
        lastError = `Flipkart redirected (HTTP ${res.status})`;
        continue;
      }

      if (res.status === 500) {
        return {
          success: false,
          error: "Card is expired or deactivated (Flipkart returned server error)",
        };
      }

      const raw = await res.text();
      let data: FlipkartResponse;
      try {
        data = JSON.parse(raw) as FlipkartResponse;
      } catch {
        lastError = `Flipkart returned HTTP ${res.status}`;
        continue;
      }

      const nextId = data.RESPONSE?.id != null ? String(data.RESPONSE.id) : "";
      if ((data.ERROR_CODE === 2000 || res.status === 406) && /^\d+$/.test(nextId)) {
        const nextUrl = dcUrl(nextId);
        if (!tried.has(nextUrl)) queue.unshift(nextUrl);
        lastError = data.ERROR_MESSAGE || `Wrong data center ${nextId}`;
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

      lastError = `Unexpected Flipkart response (HTTP ${res.status}): ${raw.slice(0, 120)}`;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : "Could not reach Flipkart";
      continue;
    }
  }

  return { success: false, error: lastError };
}

async function tryWithSession(
  cardNumber: string,
  pin: string,
  cookieStr: string
): Promise<BalanceResult | null> {
  if (CLOUDFLARE_PROXY_URL) {
    const proxied = await tryViaProxy(cardNumber, pin, cookieStr);
    if (proxied?.success) return proxied;
    if (!proxyShouldFallBack(proxied)) return proxied;
  }

  return tryDirect(cardNumber, pin, cookieStr);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cardNumber, pin } = body;

    if (!cardNumber || !pin) {
      return NextResponse.json(
        { success: false, error: "Card number and PIN are required" },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    const cleanCard = cardNumber.replace(/\s+/g, "");
    const cleanPin = pin.replace(/\s+/g, "");

    const sessions = await loadSessionsFromDB();

    if (sessions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          cardNumber: cleanCard,
          error:
            "No Flipkart sessions found. Add sessions via the Session Manager.",
        },
        { headers: corsHeaders(request) }
      );
    }

    for (const cookieStr of sessions) {
      const result = await tryWithSession(cleanCard, cleanPin, cookieStr);
      if (result) {
        return NextResponse.json(
          { ...result, cardNumber: cleanCard },
          { headers: corsHeaders(request) }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        cardNumber: cleanCard,
        error:
          "All sessions expired or failed. Add fresh sessions via the Session Manager.",
      },
      { headers: corsHeaders(request) }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error occurred";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}
