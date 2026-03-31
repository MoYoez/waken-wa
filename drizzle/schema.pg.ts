
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const apiTokens = pgTable('api_tokens', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  token: varchar('token', { length: 128 }).notNull().unique(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
    .notNull()
    .defaultNow(),
  lastUsedAt: timestamp('last_used_at', { mode: 'date', withTimezone: true }),
})

export const devices = pgTable(
  'devices',
  {
    id: serial('id').primaryKey(),
    displayName: varchar('display_name', { length: 200 }).notNull(),
    generatedHashKey: varchar('generated_hash_key', { length: 128 }).notNull().unique(),
    showSteamNowPlaying: boolean('show_steam_now_playing').notNull().default(false),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    apiTokenId: integer('api_token_id').references(() => apiTokens.id, {
      onDelete: 'set null',
    }),
    lastSeenAt: timestamp('last_seen_at', { mode: 'date', withTimezone: true }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('devices_api_token_id_idx').on(t.apiTokenId)],
)

export const userActivities = pgTable(
  'user_activities',
  {
    id: serial('id').primaryKey(),
    deviceId: integer('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    generatedHashKey: varchar('generated_hash_key', { length: 128 }).notNull(),
    processName: varchar('process_name', { length: 200 }).notNull(),
    processTitle: text('process_title'),
    metadata: jsonb('metadata'),
    startedAt: timestamp('started_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('user_activities_device_id_process_name_key').on(
      t.deviceId,
      t.processName,
    ),
  ],
)

export const siteConfig = pgTable('site_config', {
  id: integer('id').primaryKey().default(1),
  pageTitle: varchar('page_title', { length: 120 })
    .notNull()
    .default('别睡了啦！看看你在做什么'),
  userName: varchar('user_name', { length: 120 }).notNull(),
  userBio: text('user_bio').notNull(),
  avatarUrl: text('avatar_url').notNull(),
  /** Hex #RRGGBB for avatar online ring/dot; null = use theme --online */
  profileOnlineAccentColor: varchar('profile_online_accent_color', { length: 7 }),
  /** null in app = enable pulse on online status dot */
  profileOnlinePulseEnabled: boolean('profile_online_pulse_enabled'),
  userNote: text('user_note').notNull(),
  userNoteHitokotoEnabled: boolean('user_note_hitokoto_enabled').notNull().default(false),
  userNoteHitokotoCategories: jsonb('user_note_hitokoto_categories'),
  userNoteHitokotoEncode: varchar('user_note_hitokoto_encode', { length: 10 })
    .notNull()
    .default('json'),
  themePreset: varchar('theme_preset', { length: 50 }).notNull().default('basic'),
  themeCustomSurface: jsonb('theme_custom_surface'),
  customCss: text('custom_css'),
  historyWindowMinutes: integer('history_window_minutes').notNull().default(120),
  appMessageRules: jsonb('app_message_rules'),
  appMessageRulesShowProcessName: boolean('app_message_rules_show_process_name')
    .notNull()
    .default(true),
  appBlacklist: jsonb('app_blacklist'),
  appWhitelist: jsonb('app_whitelist'),
  appFilterMode: varchar('app_filter_mode', { length: 20 }).notNull().default('blacklist'),
  appNameOnlyList: jsonb('app_name_only_list'),
  processStaleSeconds: integer('process_stale_seconds').notNull().default(500),
  pageLockEnabled: boolean('page_lock_enabled').notNull().default(false),
  pageLockPasswordHash: text('page_lock_password_hash'),
  currentlyText: varchar('currently_text', { length: 60 }).notNull().default('当前状态'),
  earlierText: varchar('earlier_text', { length: 60 }).notNull().default('最近的随想录'),
  adminText: varchar('admin_text', { length: 30 }).notNull().default('admin'),
  autoAcceptNewDevices: boolean('auto_accept_new_devices').notNull().default(false),
  inspirationAllowedDeviceHashes: jsonb('inspiration_allowed_device_hashes'),
  scheduleSlotMinutes: integer('schedule_slot_minutes').notNull().default(30),
  schedulePeriodTemplate: jsonb('schedule_period_template'),
  scheduleGridByWeekday: jsonb('schedule_grid_by_weekday'),
  scheduleCourses: jsonb('schedule_courses'),
  scheduleIcs: text('schedule_ics'),
  scheduleInClassOnHome: boolean('schedule_in_class_on_home').notNull().default(false),
  scheduleHomeShowLocation: boolean('schedule_home_show_location').notNull().default(false),
  scheduleHomeShowTeacher: boolean('schedule_home_show_teacher').notNull().default(false),
  scheduleHomeShowNextUpcoming: boolean('schedule_home_show_next_upcoming')
    .notNull()
    .default(false),
  scheduleHomeAfterClassesLabel: varchar('schedule_home_after_classes_label', {
    length: 40,
  })
    .notNull()
    .default('正在摸鱼'),
  globalMouseTiltEnabled: boolean('global_mouse_tilt_enabled').notNull().default(false),
  hideActivityMedia: boolean('hide_activity_media').notNull().default(false),
  hcaptchaEnabled: boolean('hcaptcha_enabled').notNull().default(false),
  hcaptchaSiteKey: varchar('hcaptcha_site_key', { length: 200 }),
  hcaptchaSecretKey: varchar('hcaptcha_secret_key', { length: 200 }),
  displayTimezone: varchar('display_timezone', { length: 50 })
    .notNull()
    .default('Asia/Shanghai'),
  activityUpdateMode: varchar('activity_update_mode', { length: 20 })
    .notNull()
    .default('sse'),
  steamEnabled: boolean('steam_enabled').notNull().default(false),
  steamId: varchar('steam_id', { length: 30 }),
  steamApiKey: varchar('steam_api_key', { length: 128 }),
  // Nullable on purpose: safe db:push on existing rows; app treats null as false.
  useNoSqlAsCacheRedis: boolean('use_no_sql_as_cache_redis').default(true),
  // Nullable on purpose: safe db:push on existing rows; app handles null with default.
  redisCacheTtlSeconds: integer('redis_cache_ttl_seconds').default(3600),
  // Nullable on purpose: safe db:push on existing rows; app treats null as false.
  activityRejectLockappSleep: boolean('activity_reject_lockapp_sleep').default(false),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const systemSecrets = pgTable('system_secrets', {
  key: varchar('key', { length: 64 }).primaryKey(),
  value: varchar('value', { length: 512 }).notNull(),
})

export const rateLimitBackups = pgTable(
  'rate_limit_backups',
  {
    id: serial('id').primaryKey(),
    rlKey: varchar('rl_key', { length: 255 }).notNull(),
    count: integer('count').notNull().default(0),
    windowMs: integer('window_ms').notNull(),
    resetAt: timestamp('reset_at', { mode: 'date', withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('rate_limit_backups_rl_key_key').on(t.rlKey)],
)

export const inspirationEntries = pgTable('inspiration_entries', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 200 }),
  content: text('content').notNull(),
  imageDataUrl: text('image_data_url'),
  statusSnapshot: text('status_snapshot'),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const inspirationAssets = pgTable(
  'inspiration_assets',
  {
    id: serial('id').primaryKey(),
    publicKey: uuid('public_key').notNull().unique().defaultRandom(),
    imageDataUrl: text('image_data_url').notNull(),
    inspirationEntryId: integer('inspiration_entry_id').references(
      () => inspirationEntries.id,
      { onDelete: 'cascade' },
    ),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('inspiration_assets_inspiration_entry_id_idx').on(t.inspirationEntryId)],
)

export const pgSchema = {
  adminUsers,
  apiTokens,
  devices,
  userActivities,
  siteConfig,
  systemSecrets,
  rateLimitBackups,
  inspirationEntries,
  inspirationAssets,
}
