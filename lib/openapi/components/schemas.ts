export function buildSchemas(baseUrl: string) {
  const successEnvelope = {
    type: 'object',
    required: ['success'],
    properties: {
      success: { type: 'boolean', enum: [true] },
    },
  }

  const errorEnvelope = {
    type: 'object',
    required: ['success', 'error'],
    properties: {
      success: { type: 'boolean', enum: [false] },
      error: { type: 'string' },
    },
  }

  const activityEntry = {
    type: 'object',
    required: ['device', 'processName'],
    properties: {
      id: { oneOf: [{ type: 'number' }, { type: 'string' }] },
      device: { type: 'string' },
      processName: { type: 'string' },
      processTitle: { type: ['string', 'null'] },
      statusText: { type: ['string', 'null'] },
      generatedHashKey: { type: ['string', 'null'] },
      metadata: { type: ['object', 'null'], additionalProperties: true },
      startedAt: { type: ['string', 'null'], format: 'date-time' },
      updatedAt: { type: ['string', 'null'], format: 'date-time' },
      expiresAt: { type: ['string', 'null'], format: 'date-time' },
      deviceId: { type: ['number', 'null'] },
    },
    additionalProperties: true,
  }

  const appMessageTitleRule = {
    type: 'object',
    required: ['mode', 'pattern', 'text'],
    properties: {
      id: { type: 'string', description: 'Auto-generated identifier; omit when creating new rules' },
      mode: { type: 'string', enum: ['plain', 'regex'] },
      pattern: { type: 'string' },
      text: {
        type: 'string',
        description:
          'May use {process} and {title}. Regex title rules may also use {match}, {match1}, {match2}, or named captures such as {match:name}.',
      },
    },
  }

  const appMessageRuleGroup = {
    type: 'object',
    required: ['processMatch', 'titleRules'],
    properties: {
      id: { type: 'string', description: 'Auto-generated identifier; omit when creating new rules' },
      processMatch: { type: 'string', description: 'Case-insensitive substring match against processName' },
      defaultText: { type: 'string' },
      titleRules: { type: 'array', items: appMessageTitleRule },
    },
  }

  const siteConfig = {
    type: ['object', 'null'],
    description:
      'Redacted site settings payload returned by the LLM API. Restricted or secret values are omitted or masked.',
    additionalProperties: true,
    properties: {
      pageTitle: { type: 'string' },
      siteIconUrl: {
        type: ['string', 'null'],
        description: 'Stable icon URL in responses. May be submitted back as-is.',
      },
      userName: { type: 'string' },
      userBio: { type: 'string' },
      avatarUrl: {
        type: 'string',
        description: 'Stable avatar URL in responses. May be submitted back as-is.',
      },
      avatarFetchByServerEnabled: { type: 'boolean' },
      todayStatusEmoji: { type: ['string', 'null'] },
      todayStatusText: { type: ['string', 'null'] },
      todayStatusExpiresAt: { type: ['string', 'null'], format: 'date-time' },
      todayStatusBusy: { type: 'boolean' },
      userNote: { type: 'string' },
      profileOnlineAccentColor: { type: ['string', 'null'], description: '#RRGGBB or null' },
      profileOnlinePulseEnabled: { type: 'boolean' },
      themePreset: { type: 'string' },
      themeCustomSurface: {
        type: ['object', 'null'],
        additionalProperties: true,
        description:
          'Theme custom surface. Image-like fields may be returned as stable second-level URLs.',
      },
      customCss: { type: ['string', 'null'] },
      globalMouseTiltEnabled: { type: 'boolean' },
      globalMouseTiltGyroEnabled: { type: 'boolean' },
      smoothScrollEnabled: { type: 'boolean' },
      hideActivityMedia: { type: 'boolean' },
      mediaDisplayShowSource: { type: 'boolean' },
      mediaDisplayShowCover: { type: 'boolean' },
      mediaDisplayShowAppIcon: { type: 'boolean' },
      mediaDisplayShowNcmLink: { type: 'boolean' },
      mediaCoverMaxCount: { type: 'integer', minimum: 0, maximum: 500 },
      hideInspirationOnHome: { type: 'boolean' },
      disableFrontendDeviceAnimation: { type: 'boolean' },
      aiToolMode: { type: 'string', enum: ['skills', 'mcp'] },
      skillsAuthMode: { type: ['string', 'null'], enum: ['oauth', 'apikey', null] },
      mcpThemeToolsEnabled: { type: 'boolean' },
      currentlyText: { type: 'string' },
      earlierText: { type: 'string' },
      adminText: { type: 'string' },
      userNoteHitokotoEnabled: { type: 'boolean' },
      userNoteHitokotoCategories: { type: 'array', items: { type: 'string' } },
      userNoteHitokotoEncode: { type: 'string' },
      userNoteHitokotoFallbackToNote: { type: 'boolean' },
      userNoteSignatureFontEnabled: { type: 'boolean' },
      userNoteSignatureFontFamily: { type: 'string' },
      publicFontOptionsEnabled: { type: 'boolean' },
      publicFontOptions: { type: ['array', 'null'], items: { type: 'object', additionalProperties: true } },
      appMessageRules: { type: 'array', items: appMessageRuleGroup },
      appMessageRulesShowProcessName: { type: 'boolean' },
      appFilterMode: { type: 'string', enum: ['blacklist', 'whitelist'] },
      appBlacklist: { type: 'array', items: { type: 'string' } },
      appWhitelist: { type: 'array', items: { type: 'string' } },
      appNameOnlyList: { type: 'array', items: { type: 'string' } },
      captureReportedAppsEnabled: { type: 'boolean' },
      captureReportedAppTitleLimit: { type: 'integer', minimum: 0, maximum: 10 },
      mediaPlaySourceBlocklist: { type: 'array', items: { type: 'string' } },
      mediaPlaySourceRules: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            source: { type: 'string' },
            action: { type: 'string', enum: ['block', 'rename'] },
            displayName: { type: 'string' },
            default: { type: 'boolean' },
          },
        },
      },
      displayTimezone: { type: 'string' },
      forceDisplayTimezone: { type: 'boolean' },
      scheduleSlotMinutes: { type: 'integer', enum: [15, 30, 45, 60] },
      schedulePeriodTemplate: { type: 'array', items: { type: 'object', additionalProperties: true } },
      scheduleGridByWeekday: { type: 'array', items: { type: 'object', additionalProperties: true } },
      scheduleCourses: { type: 'array', items: { type: 'object', additionalProperties: true } },
      scheduleIcs: { type: ['string', 'null'] },
      scheduleInClassOnHome: { type: 'boolean' },
      scheduleHomeShowLocation: { type: 'boolean' },
      scheduleHomeShowTeacher: { type: 'boolean' },
      scheduleHomeShowNextUpcoming: { type: 'boolean' },
      scheduleHomeAfterClassesLabel: { type: 'string' },
      steamEnabled: { type: 'boolean' },
      steamId: { type: ['string', 'null'] },
      activityRejectLockappSleep: { type: 'boolean' },
    },
  }

  const inspirationEntry = {
    type: 'object',
    required: ['id', 'content', 'createdAt'],
    properties: {
      id: { type: 'integer' },
      title: { type: ['string', 'null'] },
      content: { type: 'string' },
      contentLexical: { type: ['string', 'null'] },
      imageDataUrl: {
        type: ['string', 'null'],
        description: 'Stable image URL. Kept as imageDataUrl for backward compatibility.',
      },
      imageUrl: { type: ['string', 'null'] },
      statusSnapshot: { type: ['string', 'null'] },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: ['string', 'null'], format: 'date-time' },
    },
  }

  return {
    SuccessEnvelope: successEnvelope,
    ErrorEnvelope: errorEnvelope,
    AppMessageTitleRule: appMessageTitleRule,
    AppMessageRuleGroup: appMessageRuleGroup,
    ActivityMetadata: {
      type: 'object',
      description:
        'Custom activity metadata. The server also stores normalized fields such as deviceType, pushMode, and media.',
      additionalProperties: true,
      properties: {
        play_source: { type: 'string' },
        play_source_name: { type: 'string' },
        media: {
          type: 'object',
          additionalProperties: true,
          properties: {
            title: { type: 'string' },
            singer: { type: 'string' },
            artist: { type: 'string' },
            album: { type: 'string' },
            coverUrl: { type: 'string' },
            coverDataUrl: { type: 'string' },
            appIconUrl: { type: 'string' },
            appIconDataUrl: { type: 'string' },
            iconDataUrl: { type: 'string' },
            status: { type: 'string', enum: ['playing', 'paused', 'stopped'] },
            isPlaying: { type: 'boolean' },
            isPaused: { type: 'boolean' },
            positionMs: { type: 'integer', minimum: 0 },
            durationMs: { type: 'integer', minimum: 0 },
            timestamps: {
              type: 'object',
              additionalProperties: true,
              properties: {
                start: { oneOf: [{ type: 'integer' }, { type: 'string' }] },
                end: { oneOf: [{ type: 'integer' }, { type: 'string' }] },
              },
            },
          },
        },
      },
    },
    ActivityInput: {
      type: 'object',
      required: ['generatedHashKey', 'process_name'],
      properties: {
        generatedHashKey: { type: 'string' },
        device: { type: 'string' },
        device_type: { type: 'string', enum: ['desktop', 'tablet', 'mobile'] },
        process_name: { type: 'string' },
        process_title: { type: 'string' },
        battery_level: { type: 'integer', minimum: 0, maximum: 100 },
        is_charging: { type: 'boolean' },
        isCharging: { type: 'boolean' },
        push_mode: { type: 'string', enum: ['realtime', 'active'] },
        metadata: { $ref: '#/components/schemas/ActivityMetadata' },
      },
    },
    ActivityEntry: activityEntry,
    ActivityFeed: {
      type: 'object',
      properties: {
        activeStatuses: { type: 'array', items: { $ref: '#/components/schemas/ActivityEntry' } },
        recentActivities: { type: 'array', items: { $ref: '#/components/schemas/ActivityEntry' } },
        recentTopApps: { type: 'array', items: { $ref: '#/components/schemas/ActivityEntry' } },
      },
      additionalProperties: true,
    },
    ActivityPending: {
      allOf: [
        { $ref: '#/components/schemas/ErrorEnvelope' },
        {
          type: 'object',
          properties: {
            pending: { type: 'boolean', enum: [true] },
            approvalUrl: { type: 'string', format: 'uri' },
            registration: {
              type: 'object',
              properties: {
                displayName: { type: 'string' },
                generatedHashKey: { type: 'string' },
                status: { type: 'string', enum: ['pending'] },
              },
              required: ['displayName', 'generatedHashKey', 'status'],
            },
          },
        },
      ],
    },
    LlmEndpoints: {
      type: 'object',
      required: [
        'llmBase',
        'direct',
        'markdown',
        'settingsCore',
        'settingsTheme',
        'settingsSchedule',
        'settingsRules',
        'appsExport',
        'oauthExchange',
        'legacyMcp',
        'legacyMcpApiKeyVerify',
      ],
      properties: {
        llmBase: { type: 'string', format: 'uri' },
        direct: { type: 'string', format: 'uri' },
        markdown: { type: 'string', format: 'uri' },
        settingsCore: { type: 'string', format: 'uri' },
        settingsTheme: { type: 'string', format: 'uri' },
        settingsSchedule: { type: 'string', format: 'uri' },
        settingsRules: { type: 'string', format: 'uri' },
        appsExport: { type: 'string', format: 'uri' },
        oauthExchange: { type: 'string', format: 'uri' },
        legacyMcp: { type: 'string', format: 'uri' },
        legacyMcpApiKeyVerify: { type: 'string', format: 'uri' },
      },
    },
    LlmDirectSuccess: {
      allOf: [
        { $ref: '#/components/schemas/SuccessEnvelope' },
        {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                finalUrl: { type: 'string', format: 'uri' },
                preferredToolMode: { type: 'string', enum: ['skills', 'mcp'] },
                detectedMode: { type: 'string', enum: ['oauth', 'apikey'] },
                endpoints: { $ref: '#/components/schemas/LlmEndpoints' },
                headerPrefix: { type: 'string' },
                headers: { type: 'object', additionalProperties: { type: 'string' } },
                capabilities: { type: 'object', additionalProperties: { type: 'boolean' } },
                guide: { type: 'object', additionalProperties: true },
                legacyMcp: { type: 'object', additionalProperties: true },
              },
              required: ['finalUrl', 'preferredToolMode', 'endpoints'],
            },
          },
        },
      ],
    },
    LlmDirectFailure: {
      allOf: [
        { $ref: '#/components/schemas/ErrorEnvelope' },
        {
          type: 'object',
          properties: {
            finalUrl: { type: 'string', format: 'uri' },
            preferredToolMode: { type: 'string', enum: ['skills', 'mcp'] },
            endpoints: { $ref: '#/components/schemas/LlmEndpoints' },
            data: { type: 'object', additionalProperties: true },
            guide: { type: 'object', additionalProperties: true },
          },
        },
      ],
    },
    SiteConfig: siteConfig,
    SiteConfigPatch: {
      type: 'object',
      description: 'Send only the minimal fields that should change. Restricted fields are rejected by the route.',
      additionalProperties: true,
      properties: {
        pageTitle: { type: 'string' },
        siteIconUrl: {
          type: ['string', 'null'],
          description: 'Accepts direct URLs or the stable icon URL returned by read APIs.',
        },
        userName: { type: 'string' },
        userBio: { type: 'string' },
        avatarUrl: {
          type: 'string',
          description: 'Accepts direct URLs, data URLs, or the stable avatar URL returned by read APIs.',
        },
        avatarFetchByServerEnabled: { type: 'boolean' },
        todayStatusEmoji: { type: ['string', 'null'] },
        todayStatusText: { type: ['string', 'null'] },
        todayStatusExpiresAt: { type: ['string', 'null'], format: 'date-time' },
        todayStatusBusy: { type: 'boolean' },
        userNote: { type: 'string' },
        profileOnlineAccentColor: { type: ['string', 'null'], description: '#RRGGBB or null to reset' },
        profileOnlinePulseEnabled: { type: 'boolean' },
        themePreset: { type: 'string' },
        themeCustomSurface: {
          type: 'object',
          additionalProperties: true,
          description:
            'Theme custom surface payload. Image-like fields accept direct/data URLs and the stable URLs returned by read APIs.',
        },
        customCss: { type: 'string' },
        globalMouseTiltEnabled: { type: 'boolean' },
        globalMouseTiltGyroEnabled: { type: 'boolean' },
        smoothScrollEnabled: { type: 'boolean' },
        hideActivityMedia: { type: 'boolean' },
        mediaDisplayShowSource: { type: 'boolean' },
        mediaDisplayShowCover: { type: 'boolean' },
        mediaDisplayShowAppIcon: { type: 'boolean' },
        mediaDisplayShowNcmLink: { type: 'boolean' },
        mediaCoverMaxCount: { type: 'integer', minimum: 0, maximum: 500 },
        hideInspirationOnHome: { type: 'boolean' },
        disableFrontendDeviceAnimation: { type: 'boolean' },
        aiToolMode: { type: 'string', enum: ['skills', 'mcp'] },
        mcpThemeToolsEnabled: { type: 'boolean' },
        currentlyText: { type: 'string' },
        earlierText: { type: 'string' },
        adminText: { type: 'string' },
        userNoteHitokotoEnabled: { type: 'boolean' },
        userNoteHitokotoCategories: { type: 'array', items: { type: 'string' } },
        userNoteHitokotoEncode: { type: 'string' },
        userNoteHitokotoFallbackToNote: { type: 'boolean' },
        userNoteSignatureFontEnabled: { type: 'boolean' },
        userNoteSignatureFontFamily: { type: 'string' },
        publicFontOptionsEnabled: { type: 'boolean' },
        publicFontOptions: { type: ['array', 'null'], items: { type: 'object', additionalProperties: true } },
        appMessageRules: { type: 'array', items: appMessageRuleGroup },
        appMessageRulesShowProcessName: { type: 'boolean' },
        appFilterMode: { type: 'string', enum: ['blacklist', 'whitelist'] },
        appBlacklist: { type: 'array', items: { type: 'string' } },
        appWhitelist: { type: 'array', items: { type: 'string' } },
        appNameOnlyList: { type: 'array', items: { type: 'string' } },
        captureReportedAppsEnabled: { type: 'boolean' },
        captureReportedAppTitleLimit: { type: 'integer', minimum: 0, maximum: 10 },
        mediaPlaySourceBlocklist: { type: 'array', items: { type: 'string' } },
        mediaPlaySourceRules: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              source: { type: 'string' },
              action: { type: 'string', enum: ['block', 'rename'] },
              displayName: { type: 'string' },
              default: { type: 'boolean' },
            },
          },
        },
        displayTimezone: { type: 'string' },
        forceDisplayTimezone: { type: 'boolean' },
        scheduleSlotMinutes: { type: 'integer', enum: [15, 30, 45, 60] },
        schedulePeriodTemplate: { type: 'array', items: { type: 'object', additionalProperties: true } },
        scheduleGridByWeekday: { type: 'array', items: { type: 'object', additionalProperties: true } },
        scheduleCourses: { type: 'array', items: { type: 'object', additionalProperties: true } },
        scheduleIcs: { type: ['string', 'null'] },
        scheduleInClassOnHome: { type: 'boolean' },
        scheduleHomeShowLocation: { type: 'boolean' },
        scheduleHomeShowTeacher: { type: 'boolean' },
        scheduleHomeShowNextUpcoming: { type: 'boolean' },
        scheduleHomeAfterClassesLabel: { type: 'string' },
        steamEnabled: { type: 'boolean' },
        steamId: { type: ['string', 'null'] },
        activityRejectLockappSleep: { type: 'boolean' },
      },
    },
    ExportedApp: {
      type: 'object',
      required: ['appName', 'titles'],
      properties: {
        appName: { type: 'string' },
        titles: { type: 'array', items: { type: 'string' } },
        lastSeenAt: { type: ['string', 'null'], format: 'date-time' },
      },
    },
    AppsExport: {
      type: 'object',
      required: ['version', 'exportedAt', 'groups'],
      properties: {
        version: { type: 'integer' },
        exportedAt: { type: 'string', format: 'date-time' },
        groups: {
          type: 'object',
          properties: {
            pc: { type: 'array', items: { $ref: '#/components/schemas/ExportedApp' } },
            mobile: { type: 'array', items: { $ref: '#/components/schemas/ExportedApp' } },
          },
        },
      },
    },
    OauthExchange: {
      allOf: [
        { $ref: '#/components/schemas/SuccessEnvelope' },
        {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              required: ['token', 'aiClientId', 'expiresAt', 'oauthTokenTtlMinutes', 'headerPrefix', 'headers'],
              properties: {
                token: { type: 'string' },
                aiClientId: { type: 'string' },
                expiresAt: { type: 'string', format: 'date-time' },
                oauthTokenTtlMinutes: { type: 'integer' },
                headerPrefix: { type: 'string' },
                headers: { type: 'object', additionalProperties: { type: 'string' } },
              },
            },
          },
        },
      ],
    },
    InspirationEntry: inspirationEntry,
    InspirationEntriesList: {
      allOf: [
        { $ref: '#/components/schemas/SuccessEnvelope' },
        {
          type: 'object',
          properties: {
            data: { type: 'array', items: { $ref: '#/components/schemas/InspirationEntry' } },
            displayTimezone: { type: 'string' },
            pagination: {
              type: 'object',
              required: ['limit', 'offset', 'total'],
              properties: {
                limit: { type: 'integer' },
                offset: { type: 'integer' },
                total: { type: 'integer' },
              },
            },
          },
        },
      ],
    },
    InspirationEntryCreate: {
      type: 'object',
      description:
        'Provide Markdown/plain content, Lexical content, or both. Device-token writes may be gated by the inspiration device allowlist.',
      properties: {
        title: { type: 'string' },
        heading: { type: 'string' },
        content: { type: 'string' },
        text: { type: 'string' },
        body: { type: 'string' },
        contentLexical: { oneOf: [{ type: 'string' }, { type: 'object', additionalProperties: true }] },
        content_lexical: { oneOf: [{ type: 'string' }, { type: 'object', additionalProperties: true }] },
        imageDataUrl: {
          type: 'string',
          description: 'Accepts a data URL or an existing /api/inspiration/img/... asset URL.',
        },
        image_data_url: {
          type: 'string',
          description: 'Accepts a data URL or an existing /api/inspiration/img/... asset URL.',
        },
        attachCurrentStatus: { type: 'boolean' },
        preComputedStatusSnapshot: { type: 'string' },
        pre_computed_status_snapshot: { type: 'string' },
        attachStatusDeviceHash: { type: 'string' },
        attach_status_device_hash: { type: 'string' },
        attachStatusActivityKey: { type: 'string' },
        attach_status_activity_key: { type: 'string' },
        attachStatusIncludeDeviceInfo: { type: 'boolean' },
        attach_status_include_device_info: { type: 'boolean' },
        attachStatusDeviceHashes: { type: 'array', items: { type: 'string' } },
      },
    },
    InspirationAssetCreate: {
      type: 'object',
      required: ['imageDataUrl'],
      properties: {
        imageDataUrl: { type: 'string' },
        dataUrl: { type: 'string' },
      },
    },
    InspirationAssetCreateSuccess: {
      allOf: [
        { $ref: '#/components/schemas/SuccessEnvelope' },
        {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              required: ['publicKey', 'url'],
              properties: {
                publicKey: { type: 'string', format: 'uuid' },
                url: {
                  type: 'string',
                  format: 'uri',
                  example: `${baseUrl}/api/inspiration/img/00000000-0000-0000-0000-000000000000`,
                },
              },
            },
          },
        },
      ],
    },
  }
}
