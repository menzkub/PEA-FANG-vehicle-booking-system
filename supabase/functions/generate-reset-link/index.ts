import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await callerClient.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: adminProfile } = await adminClient
    .from("profiles")
    .select("role, name, emp")
    .eq("id", user.id)
    .single();

  if (adminProfile?.role !== "admin") {
    return new Response("Forbidden: admin only", { status: 403, headers: CORS });
  }

  const { emp } = await req.json();
  if (!emp) {
    return new Response(JSON.stringify({ error: "emp is required" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { data: targetProfile } = await adminClient
    .from("profiles").select("id, name").eq("emp", emp).single();

  if (!targetProfile) {
    return new Response(JSON.stringify({ error: "ไม่พบรหัสพนักงานในระบบ" }), {
      status: 404, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Use the request's Origin as the redirect base — works for any deployment URL
  const origin = req.headers.get("Origin") || "https://easydrive-fang.vercel.app";
  const redirectTo = `${origin}/?pwd_reset=1`;

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email: `${emp}@easydrive.local`,
    options: { redirectTo },
  });

  if (error || !data?.properties?.action_link) {
    return new Response(JSON.stringify({ error: error?.message || "สร้างลิ้งไม่สำเร็จ" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Log the reset link generation
  await adminClient.from("reset_link_logs").insert({
    target_emp: emp,
    target_name: targetProfile.name,
    generated_by_emp: adminProfile.emp,
    generated_by_name: adminProfile.name,
  });

  return new Response(
    JSON.stringify({ link: data.properties.action_link, name: targetProfile.name }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
});
