/**
 * ChaintracksService with API Versioning (Routing Prefix)
 *
 * This example demonstrates how to use a routing prefix for API versioning.
 * All endpoints will be prefixed with the specified path (e.g., /api/v1).
 *
 * Example:
 * - Without prefix: GET /getInfo
 * - With prefix:    GET /api/v1/getInfo
 */

import { ChaintracksService, Chain } from '@bsv/wallet-toolbox'

async function main() {
  const chain: Chain = (process.env.CHAIN as Chain) || 'main'
  const port = parseInt(process.env.PORT || '3012', 10)
  const routingPrefix = process.env.ROUTING_PREFIX || '/api/v1'

  console.log(`Starting ChaintracksService for ${chain}Net with routing prefix`)
  console.log(`Routing prefix: ${routingPrefix}`)
  console.log(`Server will listen on port ${port}`)

  // Create ChaintracksService with routing prefix
  const service = new ChaintracksService({
    chain,
    routingPrefix, // All endpoints will be prefixed with this
    port
  })

  await service.startJsonRpcServer(port)

  console.log(`✓ ChaintracksService is running on port ${port}`)
  console.log('\nAvailable Endpoints (with prefix):')
  console.log(`  GET  http://localhost:${port}/               - Server info (no prefix)`)
  console.log(`  GET  http://localhost:${port}${routingPrefix}/getChain`)
  console.log(`  GET  http://localhost:${port}${routingPrefix}/getInfo`)
  console.log(`  GET  http://localhost:${port}${routingPrefix}/getPresentHeight`)
  console.log(`  GET  http://localhost:${port}${routingPrefix}/findChainTipHashHex`)
  console.log(`  GET  http://localhost:${port}${routingPrefix}/findChainTipHeaderHex`)
  console.log(`  GET  http://localhost:${port}${routingPrefix}/findHeaderHexForHeight?height=N`)
  console.log(`  GET  http://localhost:${port}${routingPrefix}/findHeaderHexForBlockHash?hash=HASH`)
  console.log(`  GET  http://localhost:${port}${routingPrefix}/getHeaders?height=N&count=M`)
  console.log(`  GET  http://localhost:${port}${routingPrefix}/getFiatExchangeRates`)
  console.log(`  POST http://localhost:${port}${routingPrefix}/addHeaderHex`)
  console.log('\nPress Ctrl+C to stop the server')

  // Graceful shutdown
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

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error)
    shutdown('uncaughtException')
  })
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason)
    shutdown('unhandledRejection')
  })
}

main().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
