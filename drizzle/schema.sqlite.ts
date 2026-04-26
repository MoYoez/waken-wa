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
  /** Hex #RRGGBB for admin shell accent; null = use built-in admin theme */
  adminThemeColor: text('admin_theme_color'),
  /** Hex #RRGGBB for admin shell surfaces; null = use built-in admin surfaces */
  adminBackgroundColor: text('admin_background_color'),
  pageTitle: text('page_title')
    .notNull()
    .default('别睡了啦！看看你在做什么'),
  /** URL or data URL for the browser tab icon; null = use built-in generated icon */
  siteIconUrl: text('site_icon_url'),
  userName: text('user_name').notNull(),
  userBio: text('user_bio').notNull(),
  avatarUrl: text('avatar_url').notNull(),
  // Nullable on purpose: safe db:push on existing rows; app treats null as false.
  avatarFetchByServerEnabled: integer('avatar_fetch_by_server_enabled', { mode: 'boolean' }).default(false),
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
  userNoteSignatureFontEnabled: integer('user_note_signature_font_enabled', {
    mode: 'boolean',
  }).default(false),
  userNoteSignatureFontFamily: text('user_note_signature_font_family'),
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
  publicFontOptionsEnabled: integer('public_font_options_enabled', { mode: 'boolean' }).default(false),
  publicFontOptions: text('public_font_options', { mode: 'json' }),
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
  // Nullable on purpose: safe db:push on existing rows; app treats null as false.
  smoothScrollEnabled: integer('smooth_scroll_enabled', { mode: 'boolean' }).default(false),
  hideActivityMedia: integer('hide_activity_media', { mode: 'boolean' })
    .notNull()
    .default(false),
  // Nullable on purpose: safe db:push on existing rows; app treats null as false.
  hideInspirationOnHome: integer('hide_inspiration_on_home', { mode: 'boolean' }).default(false),
  hcaptchaEnabled: integer('hcaptcha_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  hcaptchaSiteKey: text('hcaptcha_site_key'),
  hcaptchaSecretKey: text('hcaptcha_secret_key'),
  displayTimezone: text('display_timezone').notNull().default('Asia/Shanghai'),
  // Nullable on purpose: safe db:push on existing rows; app treats null as false.
  forceDisplayTimezone: integer('force_display_timezone', { mode: 'boolean' }).default(false),
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

export const siteConfigV2Entries = sqliteTable(
  'site_config_v2_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    siteConfigId: integer('site_config_id')
      .notNull()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    settingKey: text('setting_key').notNull(),
    valueKind: text('value_kind').notNull(),
    stringValue: text('string_value'),
    numberValue: integer('number_value'),
    booleanValue: integer('boolean_value', { mode: 'boolean' }),
    jsonValue: text('json_value', { mode: 'json' }),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [
    uniqueIndex('site_config_v2_entries_site_key_key').on(t.siteConfigId, t.settingKey),
    index('site_config_v2_entries_site_idx').on(t.siteConfigId),
  ],
)

export const siteSettingsMigrationMeta = sqliteTable('site_settings_v2_migration_meta', {
  siteConfigId: integer('site_config_id')
    .primaryKey()
    .references(() => siteConfig.id, { onDelete: 'cascade' }),
  migrationState: text('migration_state').notNull().default('legacy'),
  migratedAt: tsOpt('migrated_at'),
  legacyDataClearedAt: tsOpt('legacy_data_cleared_at'),
  createdAt: ts('created_at'),
  updatedAt: ts('updated_at'),
})

export const siteSettingsV2ValueEntries = sqliteTable(
  'site_settings_v2_value_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    siteConfigId: integer('site_config_id')
      .notNull()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    settingKey: text('setting_key').notNull(),
    valueKind: text('value_kind').notNull(),
    stringValue: text('string_value'),
    numberValue: integer('number_value'),
    booleanValue: integer('boolean_value', { mode: 'boolean' }),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [
    uniqueIndex('site_settings_v2_value_entries_site_key_key').on(
      t.siteConfigId,
      t.category,
      t.settingKey,
    ),
    index('site_settings_v2_value_entries_site_category_idx').on(
      t.siteConfigId,
      t.category,
    ),
  ],
)

export const siteSettingsV2ListEntries = sqliteTable(
  'site_settings_v2_list_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    siteConfigId: integer('site_config_id')
      .notNull()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    settingKey: text('setting_key').notNull(),
    itemValue: text('item_value').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [
    index('site_settings_v2_list_entries_site_key_idx').on(
      t.siteConfigId,
      t.category,
      t.settingKey,
      t.position,
    ),
  ],
)

export const siteSettingsV2ThemeCustomSurface = sqliteTable(
  'site_settings_v2_theme_custom_surface',
  {
    siteConfigId: integer('site_config_id')
      .primaryKey()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    background: text('background'),
    bodyBackground: text('body_background'),
    animatedBg: text('animated_bg'),
    primary: text('primary'),
    secondary: text('secondary'),
    accent: text('accent'),
    online: text('online'),
    foreground: text('foreground'),
    card: text('card'),
    border: text('border'),
    muted: text('muted'),
    mutedForeground: text('muted_foreground'),
    homeCardOverlay: text('home_card_overlay'),
    homeCardOverlayDark: text('home_card_overlay_dark'),
    homeCardInsetHighlight: text('home_card_inset_highlight'),
    animatedBgTint1: text('animated_bg_tint_1'),
    animatedBgTint2: text('animated_bg_tint_2'),
    animatedBgTint3: text('animated_bg_tint_3'),
    floatingOrbColor1: text('floating_orb_color_1'),
    floatingOrbColor2: text('floating_orb_color_2'),
    floatingOrbColor3: text('floating_orb_color_3'),
    radius: text('radius'),
    hideFloatingOrbs: integer('hide_floating_orbs', { mode: 'boolean' }),
    transparentAnimatedBg: integer('transparent_animated_bg', { mode: 'boolean' }),
    backgroundImageMode: text('background_image_mode'),
    backgroundImageUrl: text('background_image_url'),
    backgroundRandomApiUrl: text('background_random_api_url'),
    paletteMode: text('palette_mode'),
    paletteLiveEnabled: integer('palette_live_enabled', { mode: 'boolean' }),
    paletteLiveScope: text('palette_live_scope'),
    paletteSeedImageUrl: text('palette_seed_image_url'),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
)

export const siteSettingsV2ThemeCustomSurfaceImagePool = sqliteTable(
  'site_settings_v2_theme_custom_surface_image_pool',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    siteConfigId: integer('site_config_id')
      .notNull()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    imageUrl: text('image_url').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [
    index('site_settings_v2_theme_custom_surface_image_pool_site_idx').on(
      t.siteConfigId,
      t.position,
    ),
  ],
)

export const siteSettingsV2ThemePublicFontOptions = sqliteTable(
  'site_settings_v2_theme_public_font_options',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    siteConfigId: integer('site_config_id')
      .notNull()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    mode: text('mode').notNull(),
    label: text('label').notNull(),
    family: text('family').notNull(),
    url: text('url'),
    position: integer('position').notNull().default(0),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [
    index('site_settings_v2_theme_public_font_options_site_idx').on(
      t.siteConfigId,
      t.position,
    ),
  ],
)

export const siteSettingsV2SchedulePeriods = sqliteTable(
  'site_settings_v2_schedule_periods',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    siteConfigId: integer('site_config_id')
      .notNull()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    periodId: text('period_id').notNull(),
    label: text('label').notNull(),
    part: text('part').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    position: integer('position').notNull().default(0),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [
    uniqueIndex('site_settings_v2_schedule_periods_site_period_key').on(
      t.siteConfigId,
      t.periodId,
    ),
    index('site_settings_v2_schedule_periods_site_idx').on(t.siteConfigId, t.position),
  ],
)

export const siteSettingsV2ScheduleGridDays = sqliteTable(
  'site_settings_v2_schedule_grid_days',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    siteConfigId: integer('site_config_id')
      .notNull()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    weekday: integer('weekday').notNull(),
    rangeStart: text('range_start').notNull(),
    rangeEnd: text('range_end').notNull(),
    intervalMinutes: integer('interval_minutes').notNull(),
    useFixedInterval: integer('use_fixed_interval', { mode: 'boolean' }).notNull().default(false),
    position: integer('position').notNull().default(0),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [
    uniqueIndex('site_settings_v2_schedule_grid_days_site_weekday_key').on(
      t.siteConfigId,
      t.weekday,
    ),
    index('site_settings_v2_schedule_grid_days_site_idx').on(t.siteConfigId, t.position),
  ],
)

export const siteSettingsV2ScheduleCourses = sqliteTable(
  'site_settings_v2_schedule_courses',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    siteConfigId: integer('site_config_id')
      .notNull()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    courseId: text('course_id').notNull(),
    title: text('title').notNull(),
    location: text('location'),
    teacher: text('teacher'),
    weekday: integer('weekday').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    timeMode: text('time_mode'),
    anchorDate: text('anchor_date').notNull(),
    untilDate: text('until_date'),
    position: integer('position').notNull().default(0),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [
    uniqueIndex('site_settings_v2_schedule_courses_site_course_key').on(
      t.siteConfigId,
      t.courseId,
    ),
    index('site_settings_v2_schedule_courses_site_idx').on(t.siteConfigId, t.position),
  ],
)

export const siteSettingsV2ScheduleCourseTimeSessions = sqliteTable(
  'site_settings_v2_schedule_course_time_sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    siteConfigId: integer('site_config_id')
      .notNull()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    courseId: text('course_id').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [
    index('site_settings_v2_schedule_course_time_sessions_site_idx').on(
      t.siteConfigId,
      t.courseId,
      t.position,
    ),
  ],
)

export const siteSettingsV2ScheduleCoursePeriodIds = sqliteTable(
  'site_settings_v2_schedule_course_period_ids',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    siteConfigId: integer('site_config_id')
      .notNull()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    courseId: text('course_id').notNull(),
    periodId: text('period_id').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [
    index('site_settings_v2_schedule_course_period_ids_site_idx').on(
      t.siteConfigId,
      t.courseId,
      t.position,
    ),
  ],
)

export const siteSettingsV2RuleGroups = sqliteTable(
  'site_settings_v2_rule_groups',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    siteConfigId: integer('site_config_id')
      .notNull()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    groupId: text('group_id').notNull(),
    processMatch: text('process_match').notNull(),
    defaultText: text('default_text'),
    position: integer('position').notNull().default(0),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [
    uniqueIndex('site_settings_v2_rule_groups_site_group_key').on(t.siteConfigId, t.groupId),
    index('site_settings_v2_rule_groups_site_idx').on(t.siteConfigId, t.position),
  ],
)

export const siteSettingsV2RuleTitleRules = sqliteTable(
  'site_settings_v2_rule_title_rules',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    siteConfigId: integer('site_config_id')
      .notNull()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    groupId: text('group_id').notNull(),
    titleRuleId: text('title_rule_id').notNull(),
    mode: text('mode').notNull(),
    pattern: text('pattern').notNull(),
    textValue: text('text_value').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [
    uniqueIndex('site_settings_v2_rule_title_rules_site_rule_key').on(
      t.siteConfigId,
      t.titleRuleId,
    ),
    index('site_settings_v2_rule_title_rules_site_group_idx').on(
      t.siteConfigId,
      t.groupId,
      t.position,
    ),
  ],
)

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
  siteConfigV2Entries,
  siteSettingsMigrationMeta,
  siteSettingsV2ValueEntries,
  siteSettingsV2ListEntries,
  siteSettingsV2ThemeCustomSurface,
  siteSettingsV2ThemeCustomSurfaceImagePool,
  siteSettingsV2ThemePublicFontOptions,
  siteSettingsV2SchedulePeriods,
  siteSettingsV2ScheduleGridDays,
  siteSettingsV2ScheduleCourses,
  siteSettingsV2ScheduleCourseTimeSessions,
  siteSettingsV2ScheduleCoursePeriodIds,
  siteSettingsV2RuleGroups,
  siteSettingsV2RuleTitleRules,
  activityAppHistory,
  activityPlaySourceHistory,
  systemSecrets,
  skillsOauthTokens,
  skillsOauthAuthorizeCodes,
  rateLimitBackups,
  inspirationEntries,
  inspirationAssets,
}
