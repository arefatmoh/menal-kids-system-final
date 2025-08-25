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
  // Optimize connection pool for better performance and stability
  max: Number(process.env.DB_POOL_MAX ?? 25), // Increased for better concurrency
  min: Number(process.env.DB_POOL_MIN ?? 8), // Increased minimum to keep more connections ready
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT ?? 300000), // 5 minutes - keep connections alive much longer
  // Increase connection timeout for remote DBs like Neon; allow override via env
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 30000), // 30 seconds for stability
  // Keep TCP connection alive to avoid mid-handshake drops on some networks
  keepAlive: true,
  // Additional performance optimizations
  allowExitOnIdle: false, // Don't close connections when idle - keep them ready
  maxUses: Number(process.env.DB_MAX_USES ?? 50000), // Much higher - recycle connections after 50000 uses
  // Add connection keep-alive settings
  keepAliveInitialDelayMillis: 10000, // Start keep-alive after 10 seconds
  // Add connection parameters to prevent drops
  statement_timeout: 30000, // 30 second statement timeout
  idle_in_transaction_session_timeout: 300000, // 5 minute idle transaction timeout
})

// Test the connection (quiet mode)
pool.on("connect", () => {
  // Logging disabled for clean terminal
})

pool.on("error", (err) => {
  // Only log critical errors in production
  if (process.env.NODE_ENV === "production") {
    console.error("Database pool error:", err)
  }
})

// Monitor pool health (quiet mode)
setInterval(() => {
  // Logging disabled for clean terminal
}, 60000)

// Force pool to maintain minimum connections (quiet mode)
let forcePoolGrowth = setInterval(async () => {
  const currentTotal = pool.totalCount
  const targetMin = Number(process.env.DB_POOL_MIN ?? 8)
  
  if (currentTotal < targetMin) {
    try {
      // Force create connections to reach minimum
      const connectionsToCreate = targetMin - currentTotal
      const connectionPromises = []
      
      for (let i = 0; i < connectionsToCreate; i++) {
        connectionPromises.push(
          pool.connect().then(client => {
            return client.query('SELECT 1 as test').then(() => {
              client.release()
              return true
            }).catch(() => false)
          }).catch(() => false)
        )
      }
      
      await Promise.all(connectionPromises)
      
    } catch (error) {
      // Only log critical errors in production
      if (process.env.NODE_ENV === "production") {
        console.error("Pool growth error:", error)
      }
    }
  }
}, 15000)

// Database query function with error handling and retry logic (quiet mode)
export async function query(text: string, params?: any[], retries = 3): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await pool.connect()
      try {
        const result = await client.query(text, params)
        return result
      } finally {
        client.release()
      }
    } catch (error: any) {
      // Enhanced error classification for better retry decisions
      const isConnectionError = 
        error.code === 'ECONNRESET' || 
        error.code === 'ENOTFOUND' || 
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'EHOSTUNREACH' ||
        error.message?.includes('Connection terminated') ||
        error.message?.includes('timeout') ||
        error.message?.includes('connection') ||
        error.message?.includes('network');
      
      const isPoolError = 
        error.code === 'ENOSPC' || // No space left on device
        error.message?.includes('pool') ||
        error.message?.includes('too many clients');
      
      const isRetryableError = isConnectionError || isPoolError;
      
      if (attempt === retries || !isRetryableError) {
        // Only log critical errors in production
        if (process.env.NODE_ENV === "production") {
          console.error("Database query error:", error.message)
        }
        throw error
      }
      
      // Silent retry - no logging
      const delay = attempt * 1000 + Math.random() * 500; // Add jitter to prevent thundering herd
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

// Transaction helper with retry logic (quiet mode)
export async function transaction<T>(callback: (client: PoolClient) => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
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
    } catch (error: any) {
      // Check if this is a connection-related error that we should retry
      const isConnectionError = error.code === 'ECONNRESET' || 
                               error.code === 'ENOTFOUND' || 
                               error.code === 'ETIMEDOUT' ||
                               error.message?.includes('Connection terminated') ||
                               error.message?.includes('timeout');
      
      if (attempt === retries || !isConnectionError) {
        // Only log critical errors in production
        if (process.env.NODE_ENV === "production") {
          console.error("Transaction error:", error.message)
        }
        throw error
      }
      
      // Silent retry - no logging
      const delay = attempt * 1000 + Math.random() * 500; // Add jitter to prevent thundering herd
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  // This should never be reached due to the throw in the loop, but TypeScript requires it
  throw new Error("Transaction failed after all retry attempts")
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
