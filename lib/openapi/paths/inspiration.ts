import {
  cookieOrBearerSecurity,
  jsonContent,
  response,
} from '@/lib/openapi/helpers'

export function buildInspirationPaths() {
  return {
    '/api/inspiration/entries': {
      get: {
        tags: ['Inspiration'],
        summary: 'List inspiration entries',
        description:
          'Public read endpoint. The site lock must already be satisfied before this route will return entries.',
        parameters: [
          { $ref: '#/components/parameters/Limit' },
          { $ref: '#/components/parameters/Offset' },
          { $ref: '#/components/parameters/Search' },
        ],
        responses: {
          '200': response('Paginated inspiration entries.', {
            $ref: '#/components/schemas/InspirationEntriesList',
          }),
          '403': response('Site lock has not been satisfied yet.', {
            $ref: '#/components/schemas/ErrorEnvelope',
          }),
          '500': response('Unexpected server error.', {
            $ref: '#/components/schemas/ErrorEnvelope',
          }),
        },
      },
      post: {
        tags: ['Inspiration'],
        summary: 'Create an inspiration entry',
        description:
          'Write endpoint for admin sessions or bearer API tokens. Device-token writes may be further gated by the inspiration device allowlist. When attachCurrentStatus is used with a bearer token, the request must provide the current device key and can only attach that device\'s status.',
        security: cookieOrBearerSecurity(
          'Use an admin session cookie for full functionality, or a bearer API token for device-originated writes.',
        ),
        requestBody: {
          required: true,
          content: jsonContent(
            { $ref: '#/components/schemas/InspirationEntryCreate' },
            {
              plainText: {
                value: {
                  title: 'Today',
                  content: 'A short note from the device side.',
                },
              },
              lexical: {
                value: {
                  title: 'Rich note',
                  contentLexical: {
                    root: {
                      children: [
                        {
                          type: 'paragraph',
                          children: [{ type: 'text', text: 'Lexical content example.' }],
                        },
                      ],
                    },
                  },
                },
              },
              inlineImage: {
                value: {
                  title: 'Snapshot',
                  content: 'Attached with inline image data.',
                  imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
                },
              },
              adminStatusSnapshot: {
                value: {
                  title: 'What I am doing',
                  content: 'Status was attached by the admin UI flow.',
                  attachCurrentStatus: true,
                  attachStatusDeviceHash: 'MY_DEVICE_HASH',
                  attachStatusIncludeDeviceInfo: true,
                },
              },
            },
          ),
        },
        responses: {
          '201': response('Inspiration entry created.', {
            allOf: [
              { $ref: '#/components/schemas/SuccessEnvelope' },
              { type: 'object', properties: { data: { $ref: '#/components/schemas/InspirationEntry' } } },
            ],
          }),
          '400': response('Missing content or invalid inline image payload.', {
            $ref: '#/components/schemas/ErrorEnvelope',
          }),
          '401': response('Missing admin session and missing bearer token.', {
            $ref: '#/components/schemas/ErrorEnvelope',
          }),
          '403': response('Device token blocked by allowlist, or attachCurrentStatus attempted with a mismatched device key.', {
            $ref: '#/components/schemas/ErrorEnvelope',
          }),
          '500': response('Unexpected server error.', {
            $ref: '#/components/schemas/ErrorEnvelope',
          }),
        },
      },
      delete: {
        tags: ['Inspiration'],
        summary: 'Delete an inspiration entry',
        description: 'Admin-session only delete endpoint.',
        security: [{ sessionCookie: [] }],
        parameters: [{ $ref: '#/components/parameters/InspirationId' }],
        responses: {
          '200': response('Entry deleted.', { $ref: '#/components/schemas/SuccessEnvelope' }),
          '400': response('Missing or invalid id query parameter.', { $ref: '#/components/schemas/ErrorEnvelope' }),
          '401': response('Missing admin session.', { $ref: '#/components/schemas/ErrorEnvelope' }),
          '500': response('Unexpected server error.', { $ref: '#/components/schemas/ErrorEnvelope' }),
        },
      },
    },
    '/api/inspiration/assets': {
      post: {
        tags: ['Inspiration'],
        summary: 'Upload an inline inspiration asset',
        description:
          'Admin sessions and bearer API tokens can upload inline image assets. The response returns the stable public image URL that can be embedded into content.',
        security: cookieOrBearerSecurity(
          'Use an admin session cookie or a bearer API token. Device-token writes may be gated by the inspiration device allowlist.',
        ),
        requestBody: {
          required: true,
          content: jsonContent(
            { $ref: '#/components/schemas/InspirationAssetCreate' },
            {
              image: {
                value: {
                  imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
                },
              },
            },
          ),
        },
        responses: {
          '201': response('Asset created successfully.', {
            $ref: '#/components/schemas/InspirationAssetCreateSuccess',
          }),
          '400': response('Missing or invalid image data URL.', { $ref: '#/components/schemas/ErrorEnvelope' }),
          '401': response('Missing admin session and missing bearer token.', { $ref: '#/components/schemas/ErrorEnvelope' }),
          '403': response('Device token blocked by inspiration allowlist.', { $ref: '#/components/schemas/ErrorEnvelope' }),
          '500': response('Unexpected server error.', { $ref: '#/components/schemas/ErrorEnvelope' }),
        },
      },
    },
    '/api/inspiration/img/{publicKey}': {
      get: {
        tags: ['Inspiration'],
        summary: 'Fetch a public inspiration image',
        description:
          'Public binary image endpoint backed by stored data URLs. Returns the decoded image content for a valid publicKey.',
        parameters: [{ $ref: '#/components/parameters/InspirationPublicKey' }],
        responses: {
          '200': {
            description: 'Binary image body.',
            content: {
              'image/*': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          '404': {
            description: 'Image not found or publicKey invalid.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { error: { type: 'string' } },
                  required: ['error'],
                },
              },
            },
          },
          '500': {
            description: 'Unexpected server error.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { error: { type: 'string' } },
                  required: ['error'],
                },
              },
            },
          },
        },
      },
    },
  }
}
