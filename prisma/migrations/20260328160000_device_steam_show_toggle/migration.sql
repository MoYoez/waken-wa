-- Steam ID stays on site_config; devices only opt in to showing now-playing on the card.
ALTER TABLE "devices" DROP COLUMN "steam_64_id";
ALTER TABLE "devices" ADD COLUMN "show_steam_now_playing" BOOLEAN NOT NULL DEFAULT false;
