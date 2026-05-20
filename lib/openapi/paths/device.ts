import {
  bearerSecurity,
  jsonContent,
  queryParameter,
  response,
} from '@/lib/openapi/helpers'

export function buildDevicePaths(baseUrl: string) {
  return {
    '/api/status-card': {
      get: {
        tags: ['Device'],
        summary: 'Render standalone SVG status card',
        description:
          'Returns an image/svg+xml card for embedding. Uses the public activity feed, honors the site lock, and supports query-based layout and color customization.',
        parameters: [
          queryParameter('deviceId', 'Optional numeric device id to render.', false, { type: 'integer' }),
          queryParameter('deviceKey', 'Optional generatedHashKey to select a device server-side. The key is never rendered into the SVG.'),
          queryParameter('showHeader', 'Set to 1 to render the profile header.', false, { type: 'boolean' }),
          queryParameter('showAvatar', 'When showHeader=1, controls avatar visibility.', false, { type: 'boolean' }),
          queryParameter('showName', 'When showHeader=1, controls public name visibility.', false, { type: 'boolean' }),
          queryParameter('showBio', 'When showHeader=1, controls public bio visibility.', false, { type: 'boolean' }),
          queryParameter('showNote', 'When showHeader=1, controls userNote visibility.', false, { type: 'boolean' }),
          queryParameter('preferGame', 'When true, Steam now-playing games are promoted to the primary status slot and auto selection prefers gaming devices.', false, { type: 'boolean' }),
          queryParameter('showInClassStatus', 'When true, sleeping, idle, or lock-screen statuses are shown as in-class while the schedule has an ongoing course.', false, { type: 'boolean' }),
          queryParameter('width', 'SVG width in pixels.', false, { type: 'integer', minimum: 280, maximum: 1200 }),
          queryParameter('height', 'Preferred SVG height in pixels. The rendered SVG grows automatically when content needs more space.', false, { type: 'integer', minimum: 1, maximum: 720 }),
          queryParameter('radius', 'Card corner radius in pixels.', false, { type: 'integer', minimum: 0, maximum: 80 }),
          queryParameter('bg', 'Hex background color, for example #111111.'),
          queryParameter('fg', 'Hex foreground text color, for example #ffffff.'),
          queryParameter('muted', 'Hex muted text color.'),
          queryParameter('accent', 'Hex accent color.'),
          queryParameter('border', 'Hex border color.'),
        ],
        responses: {
          '200': {
            description: 'SVG status card.',
            content: {
              'image/svg+xml': {
                schema: { type: 'string' },
              },
            },
          },
          '403': {
            description: 'Site lock is enabled and the visitor has not unlocked it. The response body is still a placeholder SVG.',
            content: {
              'image/svg+xml': {
                schema: { type: 'string' },
              },
            },
          },
          '404': {
            description: 'The status-card endpoint is disabled. The response body is still a placeholder SVG.',
            content: {
              'image/svg+xml': {
                schema: { type: 'string' },
              },
            },
          },
          '500': {
            description: 'Unexpected render error. The response body is a fallback SVG.',
            content: {
              'image/svg+xml': {
                schema: { type: 'string' },
              },
            },
          },
        },
      },
    },
    '/api/activity': {
      get: {
        tags: ['Device'],
        summary: 'Read current activity feed',
        description:
          'Supports two access modes: admin session cookie, or `?public=1` after the site lock has already been satisfied.',
        parameters: [{ $ref: '#/components/parameters/ActivityPublic' }],
        responses: {
          '200': response('Activity feed payload.', {
            allOf: [
              { $ref: '#/components/schemas/SuccessEnvelope' },
              { type: 'object', properties: { data: { $ref: '#/components/schemas/ActivityFeed' } } },
            ],
          }),
          '401': response('Missing admin session in non-public mode.', {
            $ref: '#/components/schemas/ErrorEnvelope',
          }),
          '403': response('Site lock has not been satisfied in public mode.', {
            $ref: '#/components/schemas/ErrorEnvelope',
          }),
          '500': response('Unexpected server error.', {
            $ref: '#/components/schemas/ErrorEnvelope',
          }),
        },
      },
      post: {
        tags: ['Device'],
        summary: 'Report device activity',
        description:
          'Primary device reporting endpoint. Use a bearer API token and a stable generatedHashKey.',
        security: bearerSecurity('Bearer token from the API Token admin page.'),
        requestBody: {
          required: true,
          content: jsonContent(
            { $ref: '#/components/schemas/ActivityInput' },
            {
              realtime: {
                summary: 'Realtime report',
                value: {
                  generatedHashKey: 'MY_DEVICE_HASH',
                  device: 'MacBook Pro',
                  device_type: 'desktop',
                  process_name: 'VS Code',
                  process_title: 'editing setup-form.tsx',
                  battery_level: 82,
                  is_charging: true,
                  push_mode: 'realtime',
                  metadata: {
                    play_source: 'manual-test',
                    play_source_name: 'Manual Test',
                    media: { title: 'Example Track', singer: 'Example Artist' },
                  },
                },
              },
              active: {
                summary: 'Persistent active report',
                value: {
                  generatedHashKey: 'MY_DEVICE_HASH',
                  device: 'Windows Desktop',
                  process_name: 'Chrome',
                  process_title: 'Dashboard',
                  push_mode: 'active',
                  metadata: { play_source: 'system_media', play_source_name: 'System Media' },
                },
              },
            },
          ),
        },
        responses: {
          '200': response(
            'Report accepted and current activity updated.',
            {
              allOf: [
                { $ref: '#/components/schemas/SuccessEnvelope' },
                { type: 'object', properties: { data: { $ref: '#/components/schemas/ActivityEntry' } } },
              ],
            },
            {
              success: {
                value: {
                  success: true,
                  data: {
                    device: 'MacBook Pro',
                    processName: 'VS Code',
                    processTitle: 'editing setup-form.tsx',
                    metadata: {
                      pushMode: 'realtime',
                      play_source_name: 'Manual Test',
                      media: { title: 'Example Track', singer: 'Example Artist' },
                    },
                  },
                },
              },
            },
          ),
          '202': response(
            'Device was registered but is waiting for manual approval.',
            { $ref: '#/components/schemas/ActivityPending' },
            {
              pending: {
                value: {
                  success: false,
                  error: 'Device is pending admin review',
                  pending: true,
                  approvalUrl: `${baseUrl}/admin?tab=devices&hash=MY_DEVICE_HASH`,
                  registration: {
                    displayName: 'Unknown Device',
                    generatedHashKey: 'MY_DEVICE_HASH',
                    status: 'pending',
                  },
                },
              },
            },
          ),
          '400': response('Body was invalid or missing required fields.', {
            $ref: '#/components/schemas/ErrorEnvelope',
          }),
          '401': response('Missing, invalid, or disabled bearer API token.', {
            $ref: '#/components/schemas/ErrorEnvelope',
          }),
          '403': response('Device disabled, token mismatch, or LockApp/loginwindow/sleep reporting rejected.', {
            $ref: '#/components/schemas/ErrorEnvelope',
          }),
          '500': response('Unexpected server error.', {
            $ref: '#/components/schemas/ErrorEnvelope',
          }),
        },
      },
    },
  }
}
