-- ─── app_config table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_config (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "auth_read_app_config"
  ON app_config FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "auth_write_app_config"
  ON app_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── Default sync schedule (08:00 ICT) ───────────────────────────────
INSERT INTO app_config (key, value)
VALUES ('sync_schedule', '{"hour": 8}')
ON CONFLICT (key) DO NOTHING;

-- ─── pg_cron + pg_net ─────────────────────────────────────────────────
-- ต้องเปิด extension ก่อน: Database → Extensions → pg_cron + pg_net

-- SQL function: ตรวจชั่วโมง ICT จาก app_config แล้วเรียก Edge Function ถ้าตรง
-- แทนที่ <ANON_KEY> ด้วย anon key จาก Project Settings → API
CREATE OR REPLACE FUNCTION check_and_sync_fuel_prices()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  configured_hour INTEGER;
  current_hour_ict INTEGER;
BEGIN
  -- อ่านชั่วโมงที่ตั้งไว้จาก app_config (default 8 = 08:00 น.)
  SELECT COALESCE((value->>'hour')::INTEGER, 8)
  INTO configured_hour
  FROM app_config
  WHERE key = 'sync_schedule';

  -- ชั่วโมงปัจจุบัน (ICT = UTC+7)
  current_hour_ict := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Asia/Bangkok'))::INTEGER;

  -- ซิงค์เฉพาะเมื่อชั่วโมงตรง
  IF current_hour_ict = configured_hour THEN
    PERFORM net.http_post(
      url     := 'https://hrwscuswqrhjqlquhswy.supabase.co/functions/v1/sync-fuel-prices',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer <ANON_KEY>'
      ),
      body    := '{}'::jsonb
    );
  END IF;
END;
$$;

-- ลบ cron เดิม (ถ้ามี) แล้วตั้งใหม่ให้รันทุกชั่วโมง
SELECT cron.unschedule('sync-fuel-prices-daily');

SELECT cron.schedule(
  'sync-fuel-prices-hourly',
  '0 * * * *',   -- ทุกชั่วโมง → function ตรวจเองว่าถึงเวลาไหม
  'SELECT check_and_sync_fuel_prices()'
);

-- ดู jobs: SELECT * FROM cron.job;
-- ลบ:      SELECT cron.unschedule('sync-fuel-prices-hourly');
