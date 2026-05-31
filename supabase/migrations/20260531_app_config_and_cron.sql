-- ─── app_config table ────────────────────────────────────────────────
-- Stores key-value config (checklist, vehicle_types, fuel_prices, etc.)
CREATE TABLE IF NOT EXISTS app_config (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- อ่านได้สำหรับ authenticated users
CREATE POLICY IF NOT EXISTS "auth_read_app_config"
  ON app_config FOR SELECT TO authenticated USING (true);

-- เขียนได้สำหรับ authenticated users (ตรวจสิทธิ์ใน app code)
CREATE POLICY IF NOT EXISTS "auth_write_app_config"
  ON app_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── pg_cron + pg_net (ต้องเปิดใน Supabase Dashboard ก่อน) ──────────
-- ไปที่: Database → Extensions → เปิด pg_cron และ pg_net

-- ตั้ง cron sync ราคาน้ำมันทุกวัน 08:00 น. (ICT = UTC+7 → 01:00 UTC)
-- แทนที่ <PROJECT_REF> ด้วย: hrwscuswqrhjqlquhswy
-- แทนที่ <ANON_KEY>     ด้วย anon key จาก Project Settings → API

SELECT cron.schedule(
  'sync-fuel-prices-daily',
  '0 1 * * *',   -- 01:00 UTC = 08:00 ICT ทุกวัน
  $$
  SELECT net.http_post(
    url     := 'https://hrwscuswqrhjqlquhswy.supabase.co/functions/v1/sync-fuel-prices',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <ANON_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- ดู cron jobs ที่มีอยู่:
-- SELECT * FROM cron.job;

-- ลบ cron job (ถ้าต้องการ):
-- SELECT cron.unschedule('sync-fuel-prices-daily');
