-- Per-device SteamID64 for activity card now-playing.
ALTER TABLE "devices" ADD COLUMN "steam_64_id" TEXT;
