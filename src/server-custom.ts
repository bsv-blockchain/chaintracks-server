/**
 * ChaintracksService with Custom Configuration
 *
 * This example demonstrates advanced configuration including:
 * - Custom Chaintracks instance with specific options
 * - Custom Services configuration
 * - WhatsOnChain API key configuration
 * - Custom bulk/live ingestor settings
 * - Event subscriptions (header and reorg listeners)
 */

import { ChaintracksService, ChaintracksServiceOptions, BlockHeader, Chaintracks, createDefaultNoDbChaintracksOptions, Services, Chain } from '@bsv/wallet-toolbox'

async function main() {
  const chain: Chain = (process.env.CHAIN as Chain) || 'main'
  const port = parseInt(process.env.PORT || '3013', 10)
  const whatsonchainApiKey = process.env.WHATSONCHAIN_API_KEY || ''

  console.log(`Starting ChaintracksService with custom configuration`)
  console.log(`Chain: ${chain}Net`)
  console.log(`Port: ${port}`)
  console.log(`WhatsOnChain API Key: ${whatsonchainApiKey ? '✓ Configured' : '✗ Not configured'}`)

  // Create custom Chaintracks options
  // This allows fine-tuning of storage, ingestors, and sync behavior
  const chaintracksOptions = createDefaultNoDbChaintracksOptions(
    chain,
    whatsonchainApiKey, // WhatsOnChain API key for better rate limits
    100000, // maxPerFile: Headers per bulk file (100k)
    2, // maxRetained: Number of bulk files to retain in memory
    undefined, // fetch: Use default ChaintracksFetch
    'https://cdn.projectbabbage.com/blockheaders/', // CDN URL for bulk headers
    2000, // liveHeightThreshold: Headers within this distance are "live"
    400, // reorgHeightThreshold: Max reorg depth to handle
    500, // bulkMigrationChunkSize: Batch size for migrations
    400, // batchInsertLimit: Max headers to insert in one batch
    36 // addLiveRecursionLimit: Max depth to recursively fetch missing headers
  )

  // Create Chaintracks instance with custom options
  const chaintracks = new Chaintracks(chaintracksOptions)

  // Subscribe to new block header events
  // This allows you to react to new blocks in real-time
  const headerSubscriptionId = await chaintracks.subscribeHeaders(
    async (header: BlockHeader) => {
      console.log(`📦 New block header received:`)
      console.log(`   Height: ${header.height}`)
      console.log(`   Hash: ${header.hash}`)
      console.log(`   Timestamp: ${new Date(header.time * 1000).toISOString()}`)
    }
  )

  // Subscribe to blockchain reorganization events
  // Important for handling chain reorgs properly
  const reorgSubscriptionId = await chaintracks.subscribeReorgs(
    async (depth: number, oldTip: BlockHeader, newTip: BlockHeader, deactivated?: BlockHeader[]) => {
      console.log(`🔄 Blockchain reorganization detected!`)
      console.log(`   Reorg depth: ${depth} blocks`)
      console.log(`   Old tip: ${oldTip.hash} (height ${oldTip.height})`)
      console.log(`   New tip: ${newTip.hash} (height ${newTip.height})`)
      if (deactivated && deactivated.length > 0) {
        console.log(`   Deactivated blocks: ${deactivated.map(h => h.hash).join(', ')}`)
      }
    }
  )

  console.log(`✓ Subscribed to header events (ID: ${headerSubscriptionId})`)
  console.log(`✓ Subscribed to reorg events (ID: ${reorgSubscriptionId})`)

  // Create custom Services instance
  // This allows configuring which BSV network services to use
  // Note: Services uses the chain parameter to configure network services
  const services = new Services(chain)

  // Create ChaintracksService with custom chaintracks and services
  const serviceOptions: ChaintracksServiceOptions = {
    chain,
    routingPrefix: '',
    chaintracks, // Use our custom chaintracks instance
    services, // Use our custom services instance
    port
  }

  const service = new ChaintracksService(serviceOptions)

  // Start the server
  await service.startJsonRpcServer(port)

  console.log(`\n✓ ChaintracksService is running on port ${port}`)
  console.log('\nAvailable Endpoints:')
  console.log(`  GET  http://localhost:${port}/getInfo - Get detailed service info`)
  console.log(`  GET  http://localhost:${port}/getPresentHeight - Get current height`)
  console.log(`  GET  http://localhost:${port}/findChainTipHeaderHex - Get chain tip`)
  console.log('\nAll standard ChaintracksService endpoints are available.')
  console.log('Press Ctrl+C to stop the server')

  // Enhanced shutdown with cleanup
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`)
    try {
      // Unsubscribe from events
      console.log('Unsubscribing from events...')
      await chaintracks.unsubscribe(headerSubscriptionId)
      await chaintracks.unsubscribe(reorgSubscriptionId)

      // Stop the service (this also destroys chaintracks)
      console.log('Stopping server...')
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
