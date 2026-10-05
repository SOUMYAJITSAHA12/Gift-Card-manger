// Run this on a home machine:  npm run home-checker
//
// Flipkart answers residential connections but returns HTTP 529 to cloud hosts,
// so the hosted site queues balance checks in Supabase and this picks them up.
// Nothing listens for inbound connections; it only polls outward.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const POLL_MS = Number(process.env.HOME_CHECKER_POLL_MS || 2000);
const HEARTBEAT_KEY = "home_checker_heartbeat";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing env. Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

// A request that never settles would stall the poll loop, stopping the
// heartbeat without printing anything, so the hosted site would report that no
// home machine is running. Bound every call instead.
const SUPABASE_TIMEOUT_MS = 15000;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: {
    fetch: (input, init = {}) =>
      fetch(input, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
      }),
  },
});

const BALANCE_PATH = "/api/1/egv/balance";
const dcUrl = (id) => `https://${id}.rome.api.flipkart.com${BALANCE_PATH}`;

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

async function loadSessions() {
  const { data, error } = await supabase
    .from("sessions")
    .select("cookies")
    .eq("is_active", true);

  if (error || !data) return [];

  return data
    .map((row) =>
      (row.cookies || [])
        .filter((c) => (c.domain || "").includes("flipkart"))
        .map((c) => `${c.name}=${c.value}`)
        .join("; ")
    )
    .filter(Boolean);
}

async function queryFlipkart(cardNumber, pin, cookieStr) {
  const queue = [dcUrl("1"), dcUrl("2")];
  const tried = new Set();
  let lastError = "Could not reach Flipkart";

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
        signal: AbortSignal.timeout(20000),
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
        : undefined;
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

async function checkCard(cardNumber, pin) {
  const sessions = await loadSessions();

  if (sessions.length === 0) {
    return {
      success: false,
      error: "No Flipkart sessions found. Add sessions via the Session Manager.",
    };
  }

  for (const cookieStr of sessions) {
    const result = await queryFlipkart(cardNumber, pin, cookieStr);
    if (result) return result;
  }

  return {
    success: false,
    error:
      "All sessions expired or failed. Add fresh sessions via the Session Manager.",
  };
}

async function finish(jobId, result) {
  await supabase
    .from("balance_jobs")
    .update({ status: "done", result, updated_at: new Date().toISOString() })
    .eq("id", jobId);
}

async function runJob(job) {
  const { data: card } = await supabase
    .from("cards")
    .select("id, card_number, pin")
    .eq("id", job.card_id)
    .maybeSingle();

  if (!card) {
    await finish(job.id, { success: false, error: "Card no longer exists" });
    return;
  }

  const cardNumber = String(card.card_number || "").replace(/\s+/g, "");
  const pin = String(card.pin || "").replace(/\s+/g, "");
  const result = await checkCard(cardNumber, pin);

  if (result.success) {
    await supabase
      .from("cards")
      .update({
        balance: result.balance,
        last_checked: new Date().toISOString(),
        status: result.balance > 0 ? "active" : "used",
        ...(result.expiry ? { expiry_date: result.expiry } : {}),
      })
      .eq("id", card.id);
  } else if (/expired|deactivated/i.test(result.error || "")) {
    await supabase
      .from("cards")
      .update({
        balance: 0,
        last_checked: new Date().toISOString(),
        status: "expired",
      })
      .eq("id", card.id);
  }

  await finish(job.id, result);
  const shown = result.success ? `₹${result.balance}` : result.error;
  console.log(`••••${cardNumber.slice(-4)} -> ${shown}`);
}

async function claimJobs() {
  const { data: jobs } = await supabase
    .from("balance_jobs")
    .select("id, card_id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);

  if (!jobs || jobs.length === 0) return;

  for (const job of jobs) {
    const { data: claimed } = await supabase
      .from("balance_jobs")
      .update({ status: "running", updated_at: new Date().toISOString() })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (!claimed) continue;

    try {
      await runJob(job);
    } catch (err) {
      await finish(job.id, { success: false, error: err.message });
    }
  }
}

async function heartbeat() {
  await supabase.from("app_config").upsert({
    key: HEARTBEAT_KEY,
    value: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

async function sweepOldJobs() {
  const cutoff = new Date(Date.now() - 86400000).toISOString();
  await supabase.from("balance_jobs").delete().lt("created_at", cutoff);
}

let running = true;

process.on("SIGINT", () => {
  running = false;
  console.log("\nStopping. The hosted site will say no home machine is running.");
  supabase
    .from("app_config")
    .delete()
    .eq("key", HEARTBEAT_KEY)
    .then(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000);
});

(async () => {
  console.log("Home balance checker started. Leave this window open.");
  console.log("The hosted site will route Flipkart checks through this machine.");

  await sweepOldJobs();
  let ticks = 0;

  while (running) {
    try {
      await heartbeat();
      await claimJobs();
      if (++ticks % 900 === 0) await sweepOldJobs();
    } catch (err) {
      console.error("Poll failed:", err.message);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
})();
