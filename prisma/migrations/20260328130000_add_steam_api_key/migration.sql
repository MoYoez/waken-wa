-- Steam Web API key configurable in admin (optional fallback: STEAM_API_KEY env).
ALTER TABLE "site_config" ADD COLUMN "steam_api_key" TEXT;
