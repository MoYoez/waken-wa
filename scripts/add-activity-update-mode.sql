-- Add activity_update_mode column to site_config table
-- Allows users to choose between SSE, Supabase Realtime, or HTTP polling for activity updates

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_config' AND column_name = 'activity_update_mode'
  ) THEN
    ALTER TABLE site_config
    ADD COLUMN activity_update_mode VARCHAR(20) NOT NULL DEFAULT 'sse';
  END IF;
END $$;
