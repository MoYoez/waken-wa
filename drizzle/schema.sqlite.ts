import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

/** Drizzle SQLite stores DateTime as TEXT (ISO-8601); runtime uses Drizzle timestamp mode (driver typing lags in 0.44). */
const textCol = text as any
const ts = (name: string) =>
  textCol(name, { mode: 'timestamp' })
    .notNull()
    .default(sql`(datetime('now'))`)
const tsOpt = (name: string) => textCol(name, { mode: 'timestamp' })

export const adminUsers = sqliteTable('admin_users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: ts('created_at'),
})

export const apiTokens = sqliteTable('api_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  token: text('token').notNull().unique(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: ts('created_at'),
  lastUsedAt: tsOpt('last_used_at'),
})

export const devices = sqliteTable(
  'devices',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    displayName: text('display_name').notNull(),
    generatedHashKey: text('generated_hash_key').notNull().unique(),
    showSteamNowPlaying: integer('show_steam_now_playing', { mode: 'boolean' })
      .notNull()
      .default(false),
    pinToTop: integer('pin_to_top', { mode: 'boolean' }).default(false),
    status: text('status').notNull().default('active'),
    apiTokenId: integer('api_token_id').references(() => apiTokens.id, {
      onDelete: 'set null',
    }),
    lastSeenAt: tsOpt('last_seen_at'),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [index('devices_api_token_id_idx').on(t.apiTokenId)],
)

export const userActivities = sqliteTable(
  'user_activities',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    deviceId: integer('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    generatedHashKey: text('generated_hash_key').notNull(),
    processName: text('process_name').notNull(),
    processTitle: text('process_title'),
    metadata: text('metadata', { mode: 'json' }),
    startedAt: ts('started_at'),
    expiresAt: textCol('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [
    uniqueIndex('user_activities_device_id_process_name_key').on(
      t.deviceId,
      t.processName,
    ),
  ],
)

export const siteConfig = sqliteTable('site_config', {
  id: integer('id').primaryKey().default(1),
  pageTitle: text('page_title')
    .notNull()
    .default('别睡了啦！看看你在做什么'),
  userName: text('user_name').notNull(),
  userBio: text('user_bio').notNull(),
  avatarUrl: text('avatar_url').notNull(),
  /** Hex #RRGGBB for avatar online ring/dot; null = use theme --online */
  profileOnlineAccentColor: text('profile_online_accent_color'),
  /** null/undefined in app = enable pulse on online status dot */
  profileOnlinePulseEnabled: integer('profile_online_pulse_enabled', { mode: 'boolean' }),
  userNote: text('user_note').notNull(),
  userNoteHitokotoEnabled: integer('user_note_hitokoto_enabled', {
    mode: 'boolean',
  })
    .notNull()
    .default(false),
  userNoteTypewriterEnabled: integer('user_note_typewriter_enabled', { mode: 'boolean' }).default(false),
  pageLoadingEnabled: integer('page_loading_enabled', { mode: 'boolean' }).default(true),
  searchEngineIndexingEnabled: integer('search_engine_indexing_enabled', { mode: 'boolean' }).default(true),
  userNoteHitokotoCategories: text('user_note_hitokoto_categories', {
    mode: 'json',
  }),
  userNoteHitokotoEncode: text('user_note_hitokoto_encode')
    .notNull()
    .default('json'),
  userNoteHitokotoFallbackToNote: integer('user_note_hitokoto_fallback_to_note', {
    mode: 'boolean',
  }).default(false),
  themePreset: text('theme_preset').notNull().default('basic'),
  themeCustomSurface: text('theme_custom_surface', { mode: 'json' }),
  customCss: text('custom_css'),
  // Nullable on purpose: safe db:push on existing rows; tools treat null as disabled. // @DEPRECATED
  mcpThemeToolsEnabled: integer('mcp_theme_tools_enabled', { mode: 'boolean' }).default(false),
  // Nullable on purpose: safe db:push on existing rows; app treats null as disabled.
  skillsDebugEnabled: integer('skills_debug_enabled', { mode: 'boolean' }).default(false),
  // Nullable on purpose: safe db:push on existing rows; null = enabled by default.
  openApiDocsEnabled: integer('openapi_docs_enabled', { mode: 'boolean' }).default(true),
  // Nullable on purpose: safe db:push on existing rows; null = not configured.
  skillsAuthMode: text('skills_auth_mode'),
  // Nullable on purpose: safe db:push on existing rows; null = no active OAuth token.
  skillsOauthExpiresAt: tsOpt('skills_oauth_expires_at'),
  // Nullable on purpose: safe db:push on existing rows; null = use default 60 minutes.
  skillsOauthTokenTtlMinutes: integer('skills_oauth_token_ttl_minutes').default(60),
  // Nullable on purpose: safe db:push on existing rows; null = default to skills.
  aiToolMode: text('ai_tool_mode').default('skills'),
  historyWindowMinutes: integer('history_window_minutes').notNull().default(120),
  appMessageRules: text('app_message_rules', { mode: 'json' }),
  appMessageRulesShowProcessName: integer('app_message_rules_show_process_name', {
    mode: 'boolean',
  })
    .notNull()
    .default(true),
  appBlacklist: text('app_blacklist', { mode: 'json' }),
  appWhitelist: text('app_whitelist', { mode: 'json' }),
  appFilterMode: text('app_filter_mode').notNull().default('blacklist'),
  appNameOnlyList: text('app_name_only_list', { mode: 'json' }),
  /** Nullable on purpose: safe db:push on existing rows; app treats null as enabled. */
  captureReportedAppsEnabled: integer('capture_reported_apps_enabled', {
    mode: 'boolean',
  }).default(true),
  mediaPlaySourceBlocklist: text('media_play_source_blocklist', { mode: 'json' }),
  processStaleSeconds: integer('process_stale_seconds').notNull().default(500),
  pageLockEnabled: integer('page_lock_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  pageLockPasswordHash: text('page_lock_password_hash'),
  currentlyText: text('currently_text').notNull().default('当前状态'),
  earlierText: text('earlier_text').notNull().default('最近的随想录'),
  adminText: text('admin_text').notNull().default('admin'),
  autoAcceptNewDevices: integer('auto_accept_new_devices', { mode: 'boolean' })
    .notNull()
    .default(false),
  inspirationAllowedDeviceHashes: text('inspiration_allowed_device_hashes', {
    mode: 'json',
  }),
  scheduleSlotMinutes: integer('schedule_slot_minutes').notNull().default(30),
  schedulePeriodTemplate: text('schedule_period_template', { mode: 'json' }),
  scheduleGridByWeekday: text('schedule_grid_by_weekday', { mode: 'json' }),
  scheduleCourses: text('schedule_courses', { mode: 'json' }),
  scheduleIcs: text('schedule_ics'),
  scheduleInClassOnHome: integer('schedule_in_class_on_home', {
    mode: 'boolean',
  })
    .notNull()
    .default(false),
  scheduleHomeShowLocation: integer('schedule_home_show_location', {
    mode: 'boolean',
  })
    .notNull()
    .default(false),
  scheduleHomeShowTeacher: integer('schedule_home_show_teacher', {
    mode: 'boolean',
  })
    .notNull()
    .default(false),
  scheduleHomeShowNextUpcoming: integer('schedule_home_show_next_upcoming', {
    mode: 'boolean',
  })
    .notNull()
    .default(false),
  scheduleHomeAfterClassesLabel: text('schedule_home_after_classes_label')
    .notNull()
    .default('正在摸鱼'),
  globalMouseTiltEnabled: integer('global_mouse_tilt_enabled', {
    mode: 'boolean',
  })
    .notNull()
    .default(false),
  // Nullable on purpose: safe db:push on existing rows; app treats null as false.
  globalMouseTiltGyroEnabled: integer('global_mouse_tilt_gyro_enabled', {
    mode: 'boolean',
  }).default(false),
  hideActivityMedia: integer('hide_activity_media', { mode: 'boolean' })
    .notNull()
    .default(false),
  hcaptchaEnabled: integer('hcaptcha_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  hcaptchaSiteKey: text('hcaptcha_site_key'),
  hcaptchaSecretKey: text('hcaptcha_secret_key'),
  displayTimezone: text('display_timezone').notNull().default('Asia/Shanghai'),
  activityUpdateMode: text('activity_update_mode').notNull().default('sse'),
  steamEnabled: integer('steam_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  steamId: text('steam_id'),
  steamApiKey: text('steam_api_key'),
  // Nullable on purpose: safe db:push on existing rows; app treats null as false.
  useNoSqlAsCacheRedis: integer('use_no_sql_as_cache_redis', { mode: 'boolean' }).default(true),
  // Nullable on purpose: safe db:push on existing rows; app handles null with default.
  redisCacheTtlSeconds: integer('redis_cache_ttl_seconds').default(3600),
  // Nullable on purpose: safe db:push on existing rows; app treats null as false.
  activityRejectLockappSleep: integer('activity_reject_lockapp_sleep', {
    mode: 'boolean',
  }).default(false),
  createdAt: ts('created_at'),
  updatedAt: ts('updated_at'),
})

export const activityAppHistory = sqliteTable(
  'activity_app_history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    processName: text('process_name').notNull().unique(),
    platformBuckets: text('platform_buckets', { mode: 'json' }),
    firstSeenAt: ts('first_seen_at'),
    lastSeenAt: ts('last_seen_at'),
    seenCount: integer('seen_count').notNull().default(0),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
)

export const activityPlaySourceHistory = sqliteTable(
  'activity_play_source_history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    playSource: text('play_source').notNull().unique(),
    firstSeenAt: ts('first_seen_at'),
    lastSeenAt: ts('last_seen_at'),
    seenCount: integer('seen_count').notNull().default(0),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
)

export const systemSecrets = sqliteTable('system_secrets', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const skillsOauthTokens = sqliteTable(
  'skills_oauth_tokens',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    aiClientId: text('ai_client_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: textCol('expires_at', { mode: 'timestamp' }).notNull(),
    revokedAt: tsOpt('revoked_at'),
    createdAt: ts('created_at'),
  },
  (t) => [index('skills_oauth_tokens_ai_client_id_idx').on(t.aiClientId)],
)

export const skillsOauthAuthorizeCodes = sqliteTable(
  'skills_oauth_authorize_codes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    authorizeCode: text('authorize_code').notNull().unique(),
    aiClientId: text('ai_client_id').notNull(),
    expiresAt: textCol('expires_at', { mode: 'timestamp' }).notNull(),
    approvedAt: tsOpt('approved_at'),
    approvedBy: integer('approved_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    exchangeAt: tsOpt('exchange_at'),
    createdAt: ts('created_at'),
  },
  (t) => [index('skills_oauth_authorize_codes_ai_client_id_idx').on(t.aiClientId)],
)

export const rateLimitBackups = sqliteTable('rate_limit_backups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  rlKey: text('rl_key').notNull().unique(),
  count: integer('count').notNull().default(0),
  windowMs: integer('window_ms').notNull(),
  resetAt: textCol('reset_at', { mode: 'timestamp' }).notNull(),
  updatedAt: ts('updated_at'),
})

export const inspirationEntries = sqliteTable('inspiration_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title'),
  content: text('content').notNull(),
  contentLexical: text('content_lexical'),
  imageDataUrl: text('image_data_url'),
  statusSnapshot: text('status_snapshot'),
  createdAt: ts('created_at'),
  updatedAt: ts('updated_at'),
})

export const inspirationAssets = sqliteTable(
  'inspiration_assets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    publicKey: text('public_key')
      .notNull()
      .unique()
      .$defaultFn(() => crypto.randomUUID()),
    imageDataUrl: text('image_data_url').notNull(),
    inspirationEntryId: integer('inspiration_entry_id').references(
      () => inspirationEntries.id,
      { onDelete: 'cascade' },
    ),
    createdAt: ts('created_at'),
  },
  (t) => [index('inspiration_assets_inspiration_entry_id_idx').on(t.inspirationEntryId)],
)

export const sqliteSchema = {
  adminUsers,
  apiTokens,
  devices,
  userActivities,
  siteConfig,
  activityAppHistory,
  activityPlaySourceHistory,
  systemSecrets,
  skillsOauthTokens,
  skillsOauthAuthorizeCodes,
  rateLimitBackups,
  inspirationEntries,
  inspirationAssets,
}
