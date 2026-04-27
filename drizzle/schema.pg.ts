
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
    pinToTop: boolean('pin_to_top').default(false),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    apiTokenId: integer('api_token_id').references(() => apiTokens.id, {
      onDelete: 'set null',
    }),
    lastSeenAt: timestamp('last_seen_at', { mode: 'date', withTimezone: true }),
    customOfflineStatus: text('custom_offline_status'),
    customOfflineStatusEnabled: boolean('custom_offline_status_enabled').default(false),
    customOfflineStatusUpdatedAt: timestamp('custom_offline_status_updated_at', { mode: 'date', withTimezone: true }),
    customLockStatus: text('custom_lock_status'),
    customLockStatusEnabled: boolean('custom_lock_status_enabled').default(false),
    customLockStatusUpdatedAt: timestamp('custom_lock_status_updated_at', { mode: 'date', withTimezone: true }),
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
  /** Hex #RRGGBB for admin shell accent; null = use built-in admin theme */
  adminThemeColor: varchar('admin_theme_color', { length: 7 }),
  /** Hex #RRGGBB for admin shell surfaces; null = use built-in admin surfaces */
  adminBackgroundColor: varchar('admin_background_color', { length: 7 }),
  pageTitle: varchar('page_title', { length: 120 })
    .notNull()
    .default('别睡了啦！看看你在做什么'),
  /** URL or data URL for the browser tab icon; null = use built-in generated icon */
  siteIconUrl: text('site_icon_url'),
  userName: varchar('user_name', { length: 120 }).notNull(),
  userBio: text('user_bio').notNull(),
  avatarUrl: text('avatar_url').notNull(),
  // Nullable on purpose: safe db:push on existing rows; app treats null as false.
  avatarFetchByServerEnabled: boolean('avatar_fetch_by_server_enabled').default(false),
  /** Hex #RRGGBB for avatar online ring/dot; null = use theme --online */
  profileOnlineAccentColor: varchar('profile_online_accent_color', { length: 7 }),
  /** null in app = enable pulse on online status dot */
  profileOnlinePulseEnabled: boolean('profile_online_pulse_enabled'),
  userNote: text('user_note').notNull(),
  userNoteHitokotoEnabled: boolean('user_note_hitokoto_enabled').notNull().default(false),
  userNoteTypewriterEnabled: boolean('user_note_typewriter_enabled').default(false),
  userNoteSignatureFontEnabled: boolean('user_note_signature_font_enabled').default(false),
  userNoteSignatureFontFamily: text('user_note_signature_font_family'),
  pageLoadingEnabled: boolean('page_loading_enabled').default(true),
  searchEngineIndexingEnabled: boolean('search_engine_indexing_enabled').default(true),
  userNoteHitokotoCategories: jsonb('user_note_hitokoto_categories'),
  userNoteHitokotoEncode: varchar('user_note_hitokoto_encode', { length: 10 })
    .notNull()
    .default('json'),
  userNoteHitokotoFallbackToNote: boolean('user_note_hitokoto_fallback_to_note').default(false),
  themePreset: varchar('theme_preset', { length: 50 }).notNull().default('basic'),
  themeCustomSurface: jsonb('theme_custom_surface'),
  publicFontOptionsEnabled: boolean('public_font_options_enabled').default(false),
  publicFontOptions: jsonb('public_font_options'),
  customCss: text('custom_css'),
  // Nullable on purpose: safe db:push on existing rows; tools treat null as disabled.
  mcpThemeToolsEnabled: boolean('mcp_theme_tools_enabled').default(false), // @DEPRECATED
  // Nullable on purpose: safe db:push on existing rows; app treats null as disabled.
  skillsDebugEnabled: boolean('skills_debug_enabled').default(false),
  // Nullable on purpose: safe db:push on existing rows; null = enabled by default.
  openApiDocsEnabled: boolean('openapi_docs_enabled').default(true),
  // Nullable on purpose: safe db:push on existing rows; null = not configured.
  skillsAuthMode: varchar('skills_auth_mode', { length: 20 }),
  // Nullable on purpose: safe db:push on existing rows; null = no active OAuth token.
  skillsOauthExpiresAt: timestamp('skills_oauth_expires_at', { mode: 'date', withTimezone: true }),
  // Nullable on purpose: safe db:push on existing rows; null = use default 60 minutes.
  skillsOauthTokenTtlMinutes: integer('skills_oauth_token_ttl_minutes').default(60),
  // Nullable on purpose: safe db:push on existing rows; null = default to skills.
  aiToolMode: varchar('ai_tool_mode', { length: 20 }).default('skills'),
  historyWindowMinutes: integer('history_window_minutes').notNull().default(120),
  appMessageRules: jsonb('app_message_rules'),
  appMessageRulesShowProcessName: boolean('app_message_rules_show_process_name')
    .notNull()
    .default(true),
  appBlacklist: jsonb('app_blacklist'),
  appWhitelist: jsonb('app_whitelist'),
  appFilterMode: varchar('app_filter_mode', { length: 20 }).notNull().default('blacklist'),
  appNameOnlyList: jsonb('app_name_only_list'),
  /** Nullable on purpose: safe db:push on existing rows; app treats null as enabled. */
  captureReportedAppsEnabled: boolean('capture_reported_apps_enabled').default(true),
  mediaPlaySourceBlocklist: jsonb('media_play_source_blocklist'),
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
  // Nullable on purpose: safe db:push on existing rows; app treats null as false.
  globalMouseTiltGyroEnabled: boolean('global_mouse_tilt_gyro_enabled').default(false),
  // Nullable on purpose: safe db:push on existing rows; app treats null as false.
  smoothScrollEnabled: boolean('smooth_scroll_enabled').default(false),
  hideActivityMedia: boolean('hide_activity_media').notNull().default(false),
  // Nullable on purpose: safe db:push on existing rows; app treats null as false.
  hideInspirationOnHome: boolean('hide_inspiration_on_home').default(false),
  hcaptchaEnabled: boolean('hcaptcha_enabled').notNull().default(false),
  hcaptchaSiteKey: varchar('hcaptcha_site_key', { length: 200 }),
  hcaptchaSecretKey: varchar('hcaptcha_secret_key', { length: 200 }),
  displayTimezone: varchar('display_timezone', { length: 50 })
    .notNull()
    .default('Asia/Shanghai'),
  // Nullable on purpose: safe db:push on existing rows; app treats null as false.
  forceDisplayTimezone: boolean('force_display_timezone').default(false),
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

export const siteConfigV2Entries = pgTable(
  'site_config_v2_entries',
  {
    id: serial('id').primaryKey(),
    siteConfigId: integer('site_config_id')
      .notNull()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    settingKey: varchar('setting_key', { length: 120 }).notNull(),
    valueKind: varchar('value_kind', { length: 16 }).notNull(),
    stringValue: text('string_value'),
    numberValue: integer('number_value'),
    booleanValue: boolean('boolean_value'),
    jsonValue: jsonb('json_value'),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('site_config_v2_entries_site_key_key').on(t.siteConfigId, t.settingKey),
    index('site_config_v2_entries_site_idx').on(t.siteConfigId),
  ],
)

export const siteSettingsMigrationMeta = pgTable('site_settings_v2_migration_meta', {
  siteConfigId: integer('site_config_id')
    .primaryKey()
    .references(() => siteConfig.id, { onDelete: 'cascade' }),
  migrationState: varchar('migration_state', { length: 32 }).notNull().default('legacy'),
  migratedAt: timestamp('migrated_at', { mode: 'date', withTimezone: true }),
  legacyDataClearedAt: timestamp('legacy_data_cleared_at', {
    mode: 'date',
    withTimezone: true,
  }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const siteSettingsV2ValueEntries = pgTable(
  'site_settings_v2_value_entries',
  {
    id: serial('id').primaryKey(),
    siteConfigId: integer('site_config_id')
      .notNull()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    category: varchar('category', { length: 32 }).notNull(),
    settingKey: varchar('setting_key', { length: 120 }).notNull(),
    valueKind: varchar('value_kind', { length: 16 }).notNull(),
    stringValue: text('string_value'),
    numberValue: integer('number_value'),
    booleanValue: boolean('boolean_value'),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
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

export const siteSettingsV2ListEntries = pgTable(
  'site_settings_v2_list_entries',
  {
    id: serial('id').primaryKey(),
    siteConfigId: integer('site_config_id')
      .notNull()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    category: varchar('category', { length: 32 }).notNull(),
    settingKey: varchar('setting_key', { length: 120 }).notNull(),
    itemValue: text('item_value').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
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

export const siteSettingsV2ThemeCustomSurface = pgTable('site_settings_v2_theme_custom_surface', {
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
  hideFloatingOrbs: boolean('hide_floating_orbs'),
  transparentAnimatedBg: boolean('transparent_animated_bg'),
  backgroundImageMode: varchar('background_image_mode', { length: 24 }),
  backgroundImageUrl: text('background_image_url'),
  backgroundRandomApiUrl: text('background_random_api_url'),
  paletteMode: varchar('palette_mode', { length: 32 }),
  paletteLiveEnabled: boolean('palette_live_enabled'),
  paletteLiveScope: varchar('palette_live_scope', { length: 24 }),
  paletteSeedImageUrl: text('palette_seed_image_url'),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const siteSettingsV2ThemeCustomSurfaceImagePool = pgTable(
  'site_settings_v2_theme_custom_surface_image_pool',
  {
    id: serial('id').primaryKey(),
    siteConfigId: integer('site_config_id')
      .notNull()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    imageUrl: text('image_url').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('site_settings_v2_theme_custom_surface_image_pool_site_idx').on(t.siteConfigId, t.position)],
)

export const siteSettingsV2ThemePublicFontOptions = pgTable(
  'site_settings_v2_theme_public_font_options',
  {
    id: serial('id').primaryKey(),
    siteConfigId: integer('site_config_id')
      .notNull()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    mode: varchar('mode', { length: 16 }).notNull(),
    label: varchar('label', { length: 60 }).notNull(),
    family: varchar('family', { length: 100 }).notNull(),
    url: text('url'),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('site_settings_v2_theme_public_font_options_site_idx').on(t.siteConfigId, t.position)],
)

export const siteSettingsV2SchedulePeriods = pgTable(
  'site_settings_v2_schedule_periods',
  {
    id: serial('id').primaryKey(),
    siteConfigId: integer('site_config_id')
      .notNull()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    periodId: varchar('period_id', { length: 64 }).notNull(),
    label: varchar('label', { length: 40 }).notNull(),
    part: varchar('part', { length: 16 }).notNull(),
    startTime: varchar('start_time', { length: 8 }).notNull(),
    endTime: varchar('end_time', { length: 8 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('site_settings_v2_schedule_periods_site_period_key').on(t.siteConfigId, t.periodId),
    index('site_settings_v2_schedule_periods_site_idx').on(t.siteConfigId, t.position),
  ],
)

export const siteSettingsV2ScheduleGridDays = pgTable(
  'site_settings_v2_schedule_grid_days',
  {
    id: serial('id').primaryKey(),
    siteConfigId: integer('site_config_id')
      .notNull()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    weekday: integer('weekday').notNull(),
    rangeStart: varchar('range_start', { length: 8 }).notNull(),
    rangeEnd: varchar('range_end', { length: 8 }).notNull(),
    intervalMinutes: integer('interval_minutes').notNull(),
    useFixedInterval: boolean('use_fixed_interval').notNull().default(false),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('site_settings_v2_schedule_grid_days_site_weekday_key').on(t.siteConfigId, t.weekday),
    index('site_settings_v2_schedule_grid_days_site_idx').on(t.siteConfigId, t.position),
  ],
)

export const siteSettingsV2ScheduleCourses = pgTable(
  'site_settings_v2_schedule_courses',
  {
    id: serial('id').primaryKey(),
    siteConfigId: integer('site_config_id')
      .notNull()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    courseId: varchar('course_id', { length: 64 }).notNull(),
    title: varchar('title', { length: 120 }).notNull(),
    location: varchar('location', { length: 200 }),
    teacher: varchar('teacher', { length: 120 }),
    weekday: integer('weekday').notNull(),
    startTime: varchar('start_time', { length: 8 }).notNull(),
    endTime: varchar('end_time', { length: 8 }).notNull(),
    timeMode: varchar('time_mode', { length: 16 }),
    anchorDate: varchar('anchor_date', { length: 10 }).notNull(),
    untilDate: varchar('until_date', { length: 10 }),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('site_settings_v2_schedule_courses_site_course_key').on(t.siteConfigId, t.courseId),
    index('site_settings_v2_schedule_courses_site_idx').on(t.siteConfigId, t.position),
  ],
)

export const siteSettingsV2ScheduleCourseTimeSessions = pgTable(
  'site_settings_v2_schedule_course_time_sessions',
  {
    id: serial('id').primaryKey(),
    siteConfigId: integer('site_config_id')
      .notNull()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    courseId: varchar('course_id', { length: 64 }).notNull(),
    startTime: varchar('start_time', { length: 8 }).notNull(),
    endTime: varchar('end_time', { length: 8 }).notNull(),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('site_settings_v2_schedule_course_time_sessions_site_idx').on(
      t.siteConfigId,
      t.courseId,
      t.position,
    ),
  ],
)

export const siteSettingsV2ScheduleCoursePeriodIds = pgTable(
  'site_settings_v2_schedule_course_period_ids',
  {
    id: serial('id').primaryKey(),
    siteConfigId: integer('site_config_id')
      .notNull()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    courseId: varchar('course_id', { length: 64 }).notNull(),
    periodId: varchar('period_id', { length: 64 }).notNull(),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('site_settings_v2_schedule_course_period_ids_site_idx').on(
      t.siteConfigId,
      t.courseId,
      t.position,
    ),
  ],
)

export const siteSettingsV2RuleGroups = pgTable(
  'site_settings_v2_rule_groups',
  {
    id: serial('id').primaryKey(),
    siteConfigId: integer('site_config_id')
      .notNull()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    groupId: varchar('group_id', { length: 64 }).notNull(),
    processMatch: varchar('process_match', { length: 240 }).notNull(),
    defaultText: text('default_text'),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('site_settings_v2_rule_groups_site_group_key').on(t.siteConfigId, t.groupId),
    index('site_settings_v2_rule_groups_site_idx').on(t.siteConfigId, t.position),
  ],
)

export const siteSettingsV2RuleTitleRules = pgTable(
  'site_settings_v2_rule_title_rules',
  {
    id: serial('id').primaryKey(),
    siteConfigId: integer('site_config_id')
      .notNull()
      .references(() => siteConfig.id, { onDelete: 'cascade' }),
    groupId: varchar('group_id', { length: 64 }).notNull(),
    titleRuleId: varchar('title_rule_id', { length: 64 }).notNull(),
    mode: varchar('mode', { length: 16 }).notNull(),
    pattern: text('pattern').notNull(),
    textValue: text('text_value').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
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

export const activityAppHistory = pgTable('activity_app_history', {
  id: serial('id').primaryKey(),
  processName: varchar('process_name', { length: 200 }).notNull().unique(),
  platformBuckets: jsonb('platform_buckets'),
  firstSeenAt: timestamp('first_seen_at', { mode: 'date', withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { mode: 'date', withTimezone: true })
    .notNull()
    .defaultNow(),
  seenCount: integer('seen_count').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const activityPlaySourceHistory = pgTable('activity_play_source_history', {
  id: serial('id').primaryKey(),
  playSource: varchar('play_source', { length: 120 }).notNull().unique(),
  firstSeenAt: timestamp('first_seen_at', { mode: 'date', withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { mode: 'date', withTimezone: true })
    .notNull()
    .defaultNow(),
  seenCount: integer('seen_count').notNull().default(0),
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

export const skillsOauthTokens = pgTable(
  'skills_oauth_tokens',
  {
    id: serial('id').primaryKey(),
    aiClientId: varchar('ai_client_id', { length: 128 }).notNull(),
    tokenHash: varchar('token_hash', { length: 512 }).notNull(),
    expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { mode: 'date', withTimezone: true }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('skills_oauth_tokens_ai_client_id_idx').on(t.aiClientId)],
)

export const skillsOauthAuthorizeCodes = pgTable(
  'skills_oauth_authorize_codes',
  {
    id: serial('id').primaryKey(),
    authorizeCode: varchar('authorize_code', { length: 128 }).notNull().unique(),
    aiClientId: varchar('ai_client_id', { length: 128 }).notNull(),
    expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }).notNull(),
    approvedAt: timestamp('approved_at', { mode: 'date', withTimezone: true }),
    approvedBy: integer('approved_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    exchangeAt: timestamp('exchange_at', { mode: 'date', withTimezone: true }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('skills_oauth_authorize_codes_ai_client_id_idx').on(t.aiClientId)],
)

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
  contentLexical: text('content_lexical'),
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
