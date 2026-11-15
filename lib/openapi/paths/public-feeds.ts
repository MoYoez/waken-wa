import { queryParameter, response } from '@/lib/openapi/helpers'

const textContent = {
  content: {
    'application/rss+xml': { schema: { type: 'string' } },
  },
}

const calendarContent = {
  content: {
    'text/calendar': { schema: { type: 'string' } },
  },
}

const svgContent = {
  content: {
    'image/svg+xml': { schema: { type: 'string' } },
  },
}

export function buildPublicFeedPaths() {
  return {
    '/inspiration/feed.xml': {
      get: {
        tags: ['Inspiration'],
        summary: 'RSS 2.0 feed of inspiration entries',
        description:
          'Public RSS feed of the latest inspiration entries. Requires the site lock to be satisfied.',
        responses: {
          '200': { description: 'RSS 2.0 document.', ...textContent },
          '403': response('Site lock has not been satisfied yet.', {
            $ref: '#/components/schemas/ErrorEnvelope',
          }),
          '500': response('Unexpected server error.', { $ref: '#/components/schemas/ErrorEnvelope' }),
        },
      },
    },
    '/inspiration/feed.json': {
      get: {
        tags: ['Inspiration'],
        summary: 'JSON Feed 1.1 of inspiration entries',
        description:
          'Public JSON Feed (https://www.jsonfeed.org) of the latest inspiration entries. Requires the site lock to be satisfied.',
        responses: {
          '200': {
            description: 'JSON Feed 1.1 document.',
            content: { 'application/feed+json': { schema: { type: 'object' } } },
          },
          '403': response('Site lock has not been satisfied yet.', {
            $ref: '#/components/schemas/ErrorEnvelope',
          }),
          '500': response('Unexpected server error.', { $ref: '#/components/schemas/ErrorEnvelope' }),
        },
      },
    },
    '/api/schedule/ics': {
      get: {
        tags: ['Device'],
        summary: 'Read-only schedule calendar subscription',
        description:
          'Returns an ICS calendar of the configured schedule for subscription in Google/Apple/Outlook calendars. Requires the site lock to be satisfied.',
        responses: {
          '200': { description: 'ICS calendar document.', ...calendarContent },
          '403': response('Site lock has not been satisfied yet.', {
            $ref: '#/components/schemas/ErrorEnvelope',
          }),
          '500': response('Unexpected server error.', { $ref: '#/components/schemas/ErrorEnvelope' }),
        },
      },
    },
    '/api/status/badge': {
      get: {
        tags: ['Device'],
        summary: 'Public status badge (Shields endpoint or SVG)',
        description:
          'Compact single-line status badge for READMEs and signatures. Gated like the status card: the badge must be enabled and the site lock satisfied (admins can preview while disabled). Returns a neutral "unavailable" badge instead of an error when gated out.',
        parameters: [
          queryParameter('format', 'json (Shields.io endpoint, default) or svg (standalone flat badge).'),
          queryParameter('label', 'Left-hand badge label. Defaults to "status".'),
        ],
        responses: {
          '200': {
            description: 'Shields endpoint JSON (format=json) or an SVG badge (format=svg).',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    schemaVersion: { type: 'integer' },
                    label: { type: 'string' },
                    message: { type: 'string' },
                    color: { type: 'string' },
                  },
                  required: ['schemaVersion', 'label', 'message', 'color'],
                },
              },
              ...svgContent.content,
            },
          },
        },
      },
    },
  }
}
