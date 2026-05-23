import 'server-only'

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import sharp from 'sharp'

export type ImageTransformFormat = 'avif' | 'jpeg' | 'png' | 'webp'
export type ImageTransformFit = 'contain' | 'cover' | 'fill' | 'inside' | 'outside'

type ImageTransformOptions = {
  cacheControl: string
  defaultFormat?: ImageTransformFormat
  defaultQuality?: number
  defaultWidth?: number
}

type ImageTransformParams = {
  fit: ImageTransformFit | null
  format: ImageTransformFormat | null
  height: number | null
  quality: number
  width: number | null
}

const DEFAULT_QUALITY = 72
const MIN_IMAGE_QUALITY = 35
const MAX_IMAGE_QUALITY = 92
const MIN_IMAGE_WIDTH = 32
const MAX_IMAGE_WIDTH = 2048
const SUPPORTED_OUTPUT_FORMATS = new Set<ImageTransformFormat>(['avif', 'jpeg', 'png', 'webp'])
const SUPPORTED_FIT_MODES = new Set<ImageTransformFit>(['contain', 'cover', 'fill', 'inside', 'outside'])

function ClampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function ParseWidth(raw: string | null, fallback?: number): number | null {
  const value = raw == null || raw.trim() === '' ? fallback : Number(raw)
  if (!Number.isFinite(value)) return null
  return ClampNumber(Number(value), MIN_IMAGE_WIDTH, MAX_IMAGE_WIDTH)
}

function ParseQuality(raw: string | null, fallback?: number): number {
  const value = raw == null || raw.trim() === '' ? fallback : Number(raw)
  if (!Number.isFinite(value)) return DEFAULT_QUALITY
  return ClampNumber(Number(value), MIN_IMAGE_QUALITY, MAX_IMAGE_QUALITY)
}

function ParseFormat(raw: string | null, fallback?: ImageTransformFormat): ImageTransformFormat | null {
  const value = String(raw ?? fallback ?? '').trim().toLowerCase() as ImageTransformFormat
  return SUPPORTED_OUTPUT_FORMATS.has(value) ? value : null
}

function ParseFit(raw: string | null): ImageTransformFit | null {
  const value = String(raw ?? '').trim().toLowerCase() as ImageTransformFit
  return SUPPORTED_FIT_MODES.has(value) ? value : null
}

function ParseImageTransformParams(
  request: NextRequest,
  options: ImageTransformOptions,
): ImageTransformParams {
  return {
    fit: ParseFit(request.nextUrl.searchParams.get('fit')),
    format: ParseFormat(request.nextUrl.searchParams.get('format'), options.defaultFormat),
    height: ParseWidth(request.nextUrl.searchParams.get('h'), undefined),
    quality: ParseQuality(request.nextUrl.searchParams.get('q'), options.defaultQuality),
    width: ParseWidth(request.nextUrl.searchParams.get('w'), options.defaultWidth),
  }
}

function ShouldTransformImage(contentType: string, params: ImageTransformParams): boolean {
  if (contentType.includes('svg')) return false
  return params.width !== null || params.height !== null || params.format !== null
}

async function TransformImageBuffer(
  input: Buffer,
  contentType: string,
  params: ImageTransformParams,
): Promise<{ body: Buffer; contentType: string }> {
  if (!ShouldTransformImage(contentType, params)) {
    return { body: input, contentType }
  }

  try {
    let image = sharp(input, { animated: contentType.includes('gif') }).rotate()
    if (params.width || params.height) {
      const fit = params.fit ?? (params.width && params.height ? 'cover' : 'inside')
      image = image.resize({
        width: params.width ?? undefined,
        height: params.height ?? undefined,
        fit,
        position: 'centre',
        withoutEnlargement: true,
      })
    }

    switch (params.format) {
      case 'avif':
        return {
          body: await image.avif({ quality: params.quality }).toBuffer(),
          contentType: 'image/avif',
        }
      case 'jpeg':
        return {
          body: await image.jpeg({ mozjpeg: true, quality: params.quality }).toBuffer(),
          contentType: 'image/jpeg',
        }
      case 'png':
        return {
          body: await image.png({ compressionLevel: 9, quality: params.quality }).toBuffer(),
          contentType: 'image/png',
        }
      case 'webp':
        return {
          body: await image.webp({ quality: params.quality }).toBuffer(),
          contentType: 'image/webp',
        }
      default:
        if (params.width || params.height) {
          return {
            body: await image.toBuffer(),
            contentType,
          }
        }
        return { body: input, contentType }
    }
  } catch {
    return { body: input, contentType }
  }
}

export async function CreateTransformedImageResponse(
  input: ArrayBuffer | Buffer | Uint8Array,
  contentType: string,
  request: NextRequest,
  options: ImageTransformOptions,
): Promise<NextResponse> {
  const source = Buffer.isBuffer(input)
    ? input
    : input instanceof ArrayBuffer
      ? Buffer.from(input)
      : Buffer.from(input)
  const normalizedContentType = contentType.toLowerCase()
  const params = ParseImageTransformParams(request, options)
  const transformed = await TransformImageBuffer(source, normalizedContentType, params)

  return new NextResponse(new Uint8Array(transformed.body), {
    status: 200,
    headers: {
      'Cache-Control': options.cacheControl,
      'Content-Type': transformed.contentType,
    },
  })
}
