import { ApiReference } from '@scalar/nextjs-api-reference'

import { isOpenApiDocsEnabled } from '@/lib/openapi-access'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const customCss = `
  :root {
    color-scheme: light;
  }

  body {
    background:
      radial-gradient(circle at top left, rgba(232, 206, 174, 0.45), transparent 26%),
      radial-gradient(circle at top right, rgba(119, 166, 160, 0.18), transparent 24%),
      linear-gradient(180deg, #fffaf3 0%, #fff 22%, #f8f5ef 100%);
  }
`

const scalarReferenceHandler = ApiReference({
  pageTitle: 'Waken API Reference',
  url: '/api/openapi.json',
  customCss,
})

export async function GET() {
  if (!(await isOpenApiDocsEnabled())) {
    return new Response('Not Found', { status: 404 })
  }

  return scalarReferenceHandler()
}
