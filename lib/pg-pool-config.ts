import type { PoolConfig } from 'pg'

// SSL-related query params that pg-connection-string parses into strict TLS settings.
// When we take over TLS config explicitly, these must be stripped to avoid conflicts.
const SSL_URL_PARAMS = ['sslmode', 'uselibpqcompat', 'sslcert', 'sslkey', 'sslrootcert']

function stripSslParams(url: string): string {
  try {
    const u = new URL(url)
    for (const param of SSL_URL_PARAMS) u.searchParams.delete(param)
    return u.toString()
  } catch {
    return url
  }
}

/**
 * Builds pg Pool options for DrizzlePg. TLS defaults follow the driver (strict verification).
 * Set POSTGRES_SSL_REJECT_UNAUTHORIZED=false only when the server uses a self-signed or
 * non-public CA and you accept MITM risk (e.g. some internal DBs / dev proxies).
 *
 * On Vercel (VERCEL=1), rejectUnauthorized is disabled automatically.
 * Vercel's outbound TLS proxy presents a self-signed cert in the chain, which causes
 * SELF_SIGNED_CERT_IN_CHAIN with strict verification. SSL URL params are also stripped
 * from the connection string so that pg-connection-string cannot re-enable strict
 * verification and override the explicit ssl pool option.
 */
export function postgresAdapterPoolConfig(connectionString: string): PoolConfig {
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

  const config: PoolConfig = {
    // On Vercel, strip SSL URL params so pg-connection-string cannot override our ssl option.
    connectionString: relaxTls ? stripSslParams(connectionString) : connectionString,
    connectionTimeoutMillis: 5000,
  }

  if (relaxTls) {
    config.ssl = { rejectUnauthorized: false }
  }

  return config
}
