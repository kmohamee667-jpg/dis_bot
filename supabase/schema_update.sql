-- Execute this SQL in your Supabase SQL Editor to add missing columns to the 'timer' table

ALTER TABLE timer ADD COLUMN IF NOT EXISTS text_channel_id TEXT;
ALTER TABLE timer ADD COLUMN IF NOT EXISTS theme_key VARCHAR(50);
ALTER TABLE timer ADD COLUMN IF NOT EXISTS mode VARCHAR(50);
ALTER TABLE timer ADD COLUMN IF NOT EXISTS update_mode VARCHAR(50);
ALTER TABLE timer ADD COLUMN IF NOT EXISTS top3_prize TEXT;
ALTER TABLE timer ADD COLUMN IF NOT EXISTS top10_prize TEXT;
ALTER TABLE timer ADD COLUMN IF NOT EXISTS paused_time BIGINT;
ALTER TABLE timer ADD COLUMN IF NOT EXISTS starter_name TEXT;

-- Recommended: Ensure current_cycle is present and default 1
ALTER TABLE timer ADD COLUMN IF NOT EXISTS current_cycle INT DEFAULT 1;

-- If you still get errors, try running this to refresh PostgREST cache (only if necessary)
-- NOTIFY pgrst, 'reload schema';
