-- Persisted non-realtime activities (pushMode active + persist_minutes from client).
CREATE TABLE "user_activities" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "device_id" INTEGER NOT NULL,
    "generated_hash_key" TEXT NOT NULL,
    "process_name" TEXT NOT NULL,
    "process_title" TEXT,
    "metadata" TEXT,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_activities_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "user_activities_device_id_process_name_key" ON "user_activities"("device_id", "process_name");
