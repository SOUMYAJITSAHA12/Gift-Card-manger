// Cloudflare Worker: Flipkart Balance Check Proxy
// Deploy this to Cloudflare Workers (free tier: 100K requests/day)
// It proxies balance check requests through Cloudflare's edge network

const BALANCE_PATH = "/api/1/egv/balance";

function dcUrl(id) {
  return `https://${id}.rome.api.flipkart.com${BALANCE_PATH}`;
}

async function queryFlipkart(cardNumber, pin, cookieStr) {
  const queue = [dcUrl("1"), dcUrl("2")];
  const tried = new Set();
  let lastError = "All DCs failed";

  while (queue.length > 0 && tried.size < 4) {
    const url = queue.shift();
    if (tried.has(url)) continue;
    tried.add(url);

    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        redirect: "manual",
        headers: { ...FK_HEADERS, Cookie: cookieStr },
        body: JSON.stringify({ cardNumber, pin }),
      });
    } catch (err) {
      lastError = err?.message || "Could not reach Flipkart";
      continue;
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("Location");
      if (location && !tried.has(location)) queue.unshift(location);
      lastError = `Flipkart redirected (HTTP ${res.status})`;
      continue;
    }

    if (res.status === 500) {
      return { success: false, error: "Card is expired or deactivated" };
    }

    const raw = await res.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      lastError = `Flipkart returned HTTP ${res.status}`;
      continue;
    }

    const nextId = data.RESPONSE?.id != null ? String(data.RESPONSE.id) : "";
    if ((data.ERROR_CODE === 2000 || res.status === 406) && /^\d+$/.test(nextId)) {
      const nextUrl = dcUrl(nextId);
      if (!tried.has(nextUrl)) queue.unshift(nextUrl);
      lastError = data.ERROR_MESSAGE || `Wrong data center, retrying DC ${nextId}`;
      continue;
    }

    if (res.status === 401) {
      return { success: false, error: "Session expired" };
    }

    if (data.RESPONSE?.statusCode === "SUCCESS" && data.RESPONSE.balanceAmount !== undefined) {
      const expiry = data.RESPONSE.expiryDate
        ? new Date(data.RESPONSE.expiryDate).toISOString().slice(0, 10)
        : null;
      return { success: true, balance: data.RESPONSE.balanceAmount, expiry };
    }

    if (data.RESPONSE?.message?.toLowerCase().includes("zero balance")) {
      return { success: true, balance: 0 };
    }

    if (data.RESPONSE?.message && data.RESPONSE.message !== "SUCCESS") {
      return { success: false, error: `Flipkart: ${data.RESPONSE.message}` };
    }

    if (data.ERROR_MESSAGE) {
      return { success: false, error: data.ERROR_MESSAGE };
    }

    lastError = `Unexpected Flipkart response (HTTP ${res.status})`;
  }

  return { success: false, error: lastError };
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

export default {
  async fetch(request, env) {
    // CORS headers for your Vercel app
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    // Verify secret to prevent unauthorized use
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${env.PROXY_SECRET}`) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    try {
      const { cardNumber, pin, cookieStr } = await request.json();

      if (!cardNumber || !pin || !cookieStr) {
        return Response.json(
          { success: false, error: "Missing required fields" },
          { headers: corsHeaders }
        );
      }

      const result = await queryFlipkart(cardNumber, pin, cookieStr);
      return Response.json(result, { headers: corsHeaders });
    } catch (err) {
      return Response.json(
        { success: false, error: err.message || "Worker error" },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
