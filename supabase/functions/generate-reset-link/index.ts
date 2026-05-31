import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Verify caller is authenticated admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Check caller's JWT — must be an admin profile
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await callerClient.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return new Response("Forbidden: admin only", { status: 403 });
  }

  // Get target emp from request body
  const { emp } = await req.json();
  if (!emp) {
    return new Response(JSON.stringify({ error: "emp is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Look up the auth user's email for this emp
  const { data: targetProfile } = await adminClient
    .from("profiles")
    .select("id, name")
    .eq("emp", emp)
    .single();

  if (!targetProfile) {
    return new Response(JSON.stringify({ error: "Employee not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Generate recovery link without sending email
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email: `${emp}@easydrive.local`,
  });

  if (error || !data?.properties?.action_link) {
    return new Response(JSON.stringify({ error: error?.message || "Failed to generate link" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ link: data.properties.action_link, name: targetProfile.name }),
    { headers: { "Content-Type": "application/json" } },
  );
});
