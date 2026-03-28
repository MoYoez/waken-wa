-- Activity feed is in-memory only; drop persisted activity_logs and retention cap column.
DROP TABLE IF EXISTS "activity_logs";

ALTER TABLE "site_config" DROP COLUMN "activity_log_retention_max";
