/**
 * Basic ChaintracksService Express Server
 *
 * This is the simplest way to start a ChaintracksService with in-memory (NoDb) storage.
 * The ChaintracksService class from @bsv/wallet-toolbox includes a built-in Express server
 * with all necessary endpoints already configured.
 *
 * Features:
 * - In-memory block header storage (no database required)
 * - Automatic synchronization with BSV blockchain
 * - REST API endpoints for querying headers
 * - CORS enabled for browser clients
 * - Graceful shutdown handling
 */

import { ChaintracksService, Chain } from '@bsv/wallet-toolbox'

/**
 * Main server initialization and startup
 */
async function main() {
  // Configuration from environment variables
  const chain: Chain = (process.env.CHAIN as Chain) || 'main'
  const port = parseInt(process.env.PORT || '3011', 10)

  console.log(`Starting ChaintracksService for ${chain}Net`)
  console.log(`Server will listen on port ${port}`)

  // Create ChaintracksService instance
  // By default, this uses in-memory NoDb storage via createDefaultNoDbChaintracksOptions
  const service = new ChaintracksService({
    chain,
    routingPrefix: '', // No prefix, endpoints are at root level (e.g., /getInfo)
    port
  })

  // Start the JSON-RPC server
  // This call does the following:
  // 1. Calls chaintracks.makeAvailable() to initialize storage
  // 2. Sets up Express app with body-parser and CORS
  // 3. Registers all REST API endpoints
  // 4. Starts HTTP server on specified port
  await service.startJsonRpcServer(port)

  console.log(`✓ ChaintracksService is running on port ${port}`)
  console.log('\nAvailable Endpoints:')
  console.log(`  GET  http://localhost:${port}/               - Server info`)
  console.log(`  GET  http://localhost:${port}/getChain       - Get blockchain (main/test)`)
  console.log(`  GET  http://localhost:${port}/getInfo        - Get service info and status`)
  console.log(`  GET  http://localhost:${port}/getPresentHeight - Get current blockchain height`)
  console.log(`  GET  http://localhost:${port}/findChainTipHashHex - Get chain tip hash`)
  console.log(`  GET  http://localhost:${port}/findChainTipHeaderHex - Get chain tip header`)
  console.log(`  GET  http://localhost:${port}/findHeaderHexForHeight?height=N - Get header by height`)
  console.log(`  GET  http://localhost:${port}/findHeaderHexForBlockHash?hash=HASH - Get header by hash`)
  console.log(`  GET  http://localhost:${port}/getHeaders?height=N&count=M - Get multiple headers`)
  console.log(`  GET  http://localhost:${port}/getFiatExchangeRates - Get fiat exchange rates`)
  console.log(`  POST http://localhost:${port}/addHeaderHex   - Submit new block header`)
  console.log('\nPress Ctrl+C to stop the server')

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`)
    try {
      await service.stopJsonRpcServer()
      console.log('✓ Server stopped successfully')
      process.exit(0)
    } catch (error) {
      console.error('Error during shutdown:', error)
      process.exit(1)
    }
  }

  // Register shutdown handlers
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error)
    shutdown('uncaughtException')
  })

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason)
    shutdown('unhandledRejection')
  })
}

// Start the server
main().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
