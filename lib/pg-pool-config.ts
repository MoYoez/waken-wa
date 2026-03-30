import type { PoolConfig } from 'pg'

/**
 * Builds pg Pool options for DrizzlePg. TLS defaults follow the driver (strict verification).
 * Set POSTGRES_SSL_REJECT_UNAUTHORIZED=false only when the server uses a self-signed or
 * non-public CA and you accept MITM risk (e.g. some internal DBs / dev proxies).
 *
 * On Vercel (VERCEL=1), rejectUnauthorized is disabled automatically because Vercel's
 * outbound TLS proxy terminates the connection and re-presents its own certificate,
 * which would otherwise fail strict CA verification.
 */
export function postgresAdapterPoolConfig(connectionString: string): PoolConfig {
  const config: PoolConfig = {
    connectionString,
    connectionTimeoutMillis: 5000,
  }

  const rejectRaw = process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED?.trim().toLowerCase()
  const insecureRaw = process.env.POSTGRES_SSL_INSECURE?.trim().toLowerCase()
  const onVercel = process.env.VERCEL === '1'
  const relaxTls =
    onVercel ||
    rejectRaw === 'false' ||
    rejectRaw === '0' ||
    insecureRaw === '1' ||
    insecureRaw === 'true' ||
    insecureRaw === 'yes'

  if (relaxTls) {
    const prev = config.ssl
    const base =
      prev && typeof prev === 'object' && !Array.isArray(prev)
        ? { ...prev }
        : {}
    config.ssl = { ...base, rejectUnauthorized: false }
  }

  return config
}
