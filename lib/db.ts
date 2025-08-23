import { Pool, type PoolClient } from "pg"

// Validate DATABASE_URL for production to avoid accidental local connections
const databaseUrl = process.env.DATABASE_URL
if (process.env.NODE_ENV === "production") {
  if (!databaseUrl) {
    console.warn("DATABASE_URL is not set in production - this will cause issues")
    // Don't throw error during build, only warn
  } else {
    try {
      const u = new URL(databaseUrl)
      if (["localhost", "127.0.0.1", "::1"].includes(u.hostname)) {
        console.warn("DATABASE_URL points to localhost in production - this may cause issues")
      }
    } catch (e) {
      console.warn("Invalid DATABASE_URL format:", e)
    }
  }
}

// Decide whether to use SSL based on URL and env
function resolveSsl(): false | { rejectUnauthorized: boolean } {
  const explicit = process.env.DB_SSL?.toLowerCase()
  if (explicit === "true") return { rejectUnauthorized: false }
  if (explicit === "false") return false

  const urlStr = process.env.DATABASE_URL
  if (!urlStr) return false
  try {
    const url = new URL(urlStr)
    const sslmode = url.searchParams.get("sslmode")?.toLowerCase()
    if (sslmode === "require") return { rejectUnauthorized: false }
    if (sslmode === "disable") return false
    // Default: disable SSL for localhost, enable for remote in production
    const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
    if (isLocalHost) return false
    return process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
  } catch {
    return process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
  }
}

// Database connection pool with optimized settings
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: resolveSsl(),
  // Optimize connection pool for better performance
  max: Number(process.env.DB_POOL_MAX ?? 10), // Reduced from 20 to 10 for better resource management
  min: Number(process.env.DB_POOL_MIN ?? 2), // Keep minimum connections ready
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT ?? 30000), // 30 seconds
  // Increase connection timeout for remote DBs like Neon; allow override via env
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 5000), // Reduced from 10s to 5s
  // Keep TCP connection alive to avoid mid-handshake drops on some networks
  keepAlive: true,
  // Additional performance optimizations
  allowExitOnIdle: true, // Allow pool to close when idle
  maxUses: Number(process.env.DB_MAX_USES ?? 7500), // Recycle connections after 7500 uses
})

// Test the connection (less noisy in production)
pool.on("connect", () => {
  if (process.env.NODE_ENV !== "production") {
    console.log("Connected to PostgreSQL database")
  }
})

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err)
  process.exit(-1)
})

// Database query function with error handling
export async function query(text: string, params?: any[]): Promise<any> {
  const client = await pool.connect()
  try {
    const result = await client.query(text, params)
    return result
  } catch (error) {
    console.error("Database query error:", error)
    throw error
  } finally {
    client.release()
  }
}

// Transaction helper
export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const result = await callback(client)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

// Get a client for multiple operations
export async function getClient(): Promise<PoolClient> {
  return await pool.connect()
}

// Close the pool (for graceful shutdown)
export async function closePool(): Promise<void> {
  await pool.end()
}

export default pool
