-- Add Steam integration fields to site_config table
-- steam_enabled: toggle Steam status display
-- steam_id: Steam 64-bit ID for API calls

ALTER TABLE site_config 
ADD COLUMN IF NOT EXISTS steam_enabled BOOLEAN DEFAULT FALSE;

ALTER TABLE site_config 
ADD COLUMN IF NOT EXISTS steam_id VARCHAR(30);
