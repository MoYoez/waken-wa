import {
  bearerSecurity,
  jsonContent,
  response,
} from '@/lib/openapi/helpers'

export function buildDevicePaths(baseUrl: string) {
  return {
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
                  metadata: { play_source: 'system_media' },
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
                  error: '设备待后台审核后可用',
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
