import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PTT_API = "https://api.chnwt.dev/thai-oil-api/latest";

Deno.serve(async (req) => {
  // Allow manual HTTP trigger (GET) as well as cron invocation
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Fetch PTT fuel prices
  let ptt: Record<string, { price: string }>;
  try {
    const res = await fetch(PTT_API, { headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error(`PTT API returned ${res.status}`);
    const json = await res.json();
    ptt = json.data ?? json;
  } catch (err) {
    const msg = `Failed to fetch PTT API: ${err}`;
    console.error(msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Read current fuel_prices from app_config (to preserve ev price and other fields)
  const { data: existing } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "fuel_prices")
    .single();

  const current: Record<string, number | string> = existing?.value ?? {};

  // Map PTT fields → app fields (same logic as the frontend sync)
  const mapped: Record<string, number | string> = { ...current };

  const parse = (v: string | undefined) => (v ? parseFloat(v) : undefined);

  const g95 = parse(ptt.gasohol_95?.price);
  const g91 = parse(ptt.gasohol_91?.price);
  if (g95) mapped.gasohol = g95;
  else if (g91) mapped.gasohol = g91;

  const diesel   = parse(ptt.diesel?.price);
  const dieselB7 = parse(ptt.diesel_b7?.price);
  if (dieselB7) mapped.diesel = dieselB7;
  else if (diesel) mapped.diesel = diesel;

  const b95 = parse(ptt.gasoline_95?.price);
  if (b95) mapped.benzin = b95;

  const ngv = parse(ptt.ngv?.price);
  if (ngv) mapped.ngv = ngv;

  mapped.updatedAt = new Date().toISOString();

  // Upsert into app_config
  const { error } = await supabase.from("app_config").upsert(
    { key: "fuel_prices", value: mapped, updated_at: mapped.updatedAt },
    { onConflict: "key" },
  );

  if (error) {
    const msg = `DB upsert failed: ${error.message}`;
    console.error(msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = {
    ok: true,
    updatedAt: mapped.updatedAt,
    prices: {
      gasohol: mapped.gasohol,
      diesel:  mapped.diesel,
      benzin:  mapped.benzin,
      ngv:     mapped.ngv,
    },
  };

  console.log("sync-fuel-prices:", JSON.stringify(result));

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
});
