// Cloudflare Worker: Flipkart Balance Check Proxy
// Deploy this to Cloudflare Workers (free tier: 100K requests/day)
// It proxies balance check requests through Cloudflare's edge network

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

      for (const url of FLIPKART_DCS) {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { ...FK_HEADERS, Cookie: cookieStr },
            body: JSON.stringify({ cardNumber, pin }),
          });

          if (res.status === 500) {
            return Response.json(
              { success: false, error: "Card is expired or deactivated" },
              { headers: corsHeaders }
            );
          }

          const data = await res.json();

          // DC mismatch — try next
          if (data.ERROR_CODE === 2000 || (res.status === 406 && data.RESPONSE?.dc)) {
            continue;
          }

          // Session expired
          if (res.status === 401) {
            return Response.json(
              { success: false, error: "Session expired" },
              { headers: corsHeaders }
            );
          }

          // Success
          if (data.RESPONSE?.statusCode === "SUCCESS" && data.RESPONSE.balanceAmount !== undefined) {
            const expiry = data.RESPONSE.expiryDate
              ? new Date(data.RESPONSE.expiryDate).toISOString().slice(0, 10)
              : null;
            return Response.json(
              { success: true, balance: data.RESPONSE.balanceAmount, expiry },
              { headers: corsHeaders }
            );
          }

          // Zero balance
          if (data.RESPONSE?.message?.toLowerCase().includes("zero balance")) {
            return Response.json(
              { success: true, balance: 0 },
              { headers: corsHeaders }
            );
          }

          // Error from Flipkart
          if (data.RESPONSE?.message && data.RESPONSE.message !== "SUCCESS") {
            return Response.json(
              { success: false, error: `Flipkart: ${data.RESPONSE.message}` },
              { headers: corsHeaders }
            );
          }

          if (data.ERROR_MESSAGE) {
            return Response.json(
              { success: false, error: data.ERROR_MESSAGE },
              { headers: corsHeaders }
            );
          }
        } catch {
          continue;
        }
      }

      return Response.json(
        { success: false, error: "All DCs failed" },
        { headers: corsHeaders }
      );
    } catch (err) {
      return Response.json(
        { success: false, error: err.message || "Worker error" },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
