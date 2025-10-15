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

import { ChaintracksService, ChaintracksServiceOptions, BlockHeader, Chaintracks, createDefaultNoDbChaintracksOptions, Services, Chain, ChaintracksFs } from '@bsv/wallet-toolbox'
import * as path from 'path'
import * as express from 'express'

async function main() {
  const chain: Chain = (process.env.CHAIN as Chain) || 'main'
  const port = parseInt(process.env.PORT || '3013', 10)
  const cdnPort = port + 1 // CDN runs on next port
  const whatsonchainApiKey = process.env.WHATSONCHAIN_API_KEY || ''

  // SOURCE_CDN_URL: Remote CDN to download headers FROM (if local files don't exist)
  const sourceCdnUrl = process.env.SOURCE_CDN_URL || ''

  const enableBulkHeadersCDN = process.env.ENABLE_BULK_HEADERS_CDN === 'true'

  // CDN_HOST_URL: Public URL where THIS server's CDN is accessible (written to JSON rootFolder)
  const cdnHostUrl = process.env.CDN_HOST_URL || `http://localhost:${cdnPort}`

  // Process bulk headers path - ensure it's absolute
  let bulkHeadersPath = process.env.BULK_HEADERS_PATH || path.join(process.cwd(), 'public', 'headers')

  // Convert relative paths to absolute
  if (!path.isAbsolute(bulkHeadersPath)) {
    bulkHeadersPath = path.join(process.cwd(), bulkHeadersPath)
  }

  // The source URL is where clients can download headers from (the CDN HTTP endpoint)
  const bulkHeadersSourceUrl = enableBulkHeadersCDN ? cdnHostUrl : undefined

  const bulkHeadersAutoExportInterval = parseInt(process.env.BULK_HEADERS_AUTO_EXPORT_INTERVAL || '240000000', 10) // Default: 400 blocks around 67 hours

  console.log(`Starting ChaintracksService with custom configuration`)
  console.log(`Chain: ${chain}Net`)
  console.log(`Port: ${port}`)
  console.log(`WhatsOnChain API Key: ${whatsonchainApiKey ? '✓ Configured' : '✗ Not configured'}`)
  console.log(`Bulk Headers CDN: ${enableBulkHeadersCDN ? '✓ Enabled' : '✗ Disabled'}`)
  if (enableBulkHeadersCDN) {
    console.log(`CDN Port: ${cdnPort}`)
    console.log(`CDN Host URL: ${cdnHostUrl}`)
    console.log(`Bulk Headers Path: ${bulkHeadersPath}`)

    // Ensure the directory exists before we start
    try {
      const fs = await import('fs/promises')
      await fs.mkdir(bulkHeadersPath, { recursive: true })
      console.log(`✓ Bulk headers directory ready`)
    } catch (error) {
      console.error(`❌ Failed to create bulk headers directory: ${error}`)
      throw error
    }
  }

  // Create custom Chaintracks options
  // This allows fine-tuning of storage, ingestors, and sync behavior
  // When bulk headers CDN is enabled, configure the CDN ingestor to use the local filesystem first
  const chaintracksOptions = createDefaultNoDbChaintracksOptions(
    chain,
    whatsonchainApiKey, // WhatsOnChain API key for better rate limits
    100000, // maxPerFile: Headers per bulk file (100k)
    2, // maxRetained: Number of bulk files to retain in memory
    undefined, // fetch: Use default ChaintracksFetch
    sourceCdnUrl, // SOURCE_CDN_URL: Remote CDN to download headers FROM (fallback if local files don't exist)
    2000, // liveHeightThreshold: Headers within this distance are "live"
    400, // reorgHeightThreshold: Max reorg depth to handle
    500, // bulkMigrationChunkSize: Batch size for migrations
    400, // batchInsertLimit: Max headers to insert in one batch
    36 // addLiveRecursionLimit: Max depth to recursively fetch missing headers
  )

  // If bulk headers CDN is enabled, configure the CDN ingestor to use our local path
  // This makes the ingestor check the local filesystem FIRST before fetching from remote CDN
  //
  // How it works:
  // 1. On first startup: Ingestor checks bulkHeadersPath, finds no files, downloads from remote CDN (if configured)
  // 2. exportBulkHeaders() exports all headers from in-memory storage to bulkHeadersPath filesystem
  // 3. On subsequent restarts: Ingestor checks bulkHeadersPath, finds exported files, loads them WITHOUT downloading
  //
  // This creates a "self-hosting" CDN: once headers are downloaded and exported, the server serves them to others
  if (enableBulkHeadersCDN && chaintracksOptions.bulkIngestors.length > 0) {
    const cdnIngestor = chaintracksOptions.bulkIngestors[0] as any
    if (cdnIngestor && cdnIngestor.localCachePath !== undefined) {
      // Override the local cache path to use our bulk headers export directory
      cdnIngestor.localCachePath = bulkHeadersPath
      console.log(`✓ Configured CDN ingestor to use local path: ${bulkHeadersPath}`)
      console.log(`  → Ingestor will check filesystem first, then fallback to remote CDN`)
    }
  }

  // Create Chaintracks instance with custom options
  const chaintracks = new Chaintracks(chaintracksOptions)

  // Track last exported height to trigger exports at 100k marks
  let lastExportedHeight = 0
  let isExporting = false

  // Function to export bulk headers
  const exportBulkHeaders = async () => {
    if (!enableBulkHeadersCDN) {
      console.log('⏭️  Bulk headers CDN is disabled, skipping export')
      return
    }

    if (isExporting) {
      console.log('⏭️  Export already in progress, skipping')
      return
    }

    try {
      isExporting = true
      console.log('\n🔍 Checking if export is needed...')

      const currentHeight = await chaintracks.currentHeight()
      console.log(`   Current height: ${currentHeight}`)
      console.log(`   Last exported height: ${lastExportedHeight}`)

      // Check if we've crossed a 100k boundary
      const currentMilestone = Math.floor(currentHeight / 100000)
      const lastMilestone = Math.floor(lastExportedHeight / 100000)
      console.log(`   Current milestone: ${currentMilestone}, Last milestone: ${lastMilestone}`)

      const shouldExport = currentMilestone > lastMilestone || lastExportedHeight === 0
      console.log(`   Should export: ${shouldExport}`)

      if (shouldExport) {
        console.log(`\n📤 Exporting bulk headers to ${bulkHeadersPath}...`)
        console.log(`   Source URL (rootFolder in JSON): ${bulkHeadersSourceUrl}`)

        await chaintracks.exportBulkHeaders(
          bulkHeadersPath,
          ChaintracksFs,
          bulkHeadersSourceUrl, // sourceUrl - sets rootFolder in the JSON metadata file
          100000,               // headersPerFile
          undefined             // maxHeight (export all available)
        )

        lastExportedHeight = currentHeight
        console.log(`✓ Bulk headers exported successfully`)
        console.log(`   Files should now be available at: ${bulkHeadersPath}`)
        console.log(`   Download URL: ${bulkHeadersSourceUrl}/${chain}NetBlockHeaders.json`)

        // List files to verify
        const fs = await import('fs/promises')
        try {
          const files = await fs.readdir(bulkHeadersPath)
          console.log(`   Found ${files.length} files: ${files.join(', ')}`)
        } catch (e) {
          console.log(`   Could not list files: ${e}`)
        }
      } else {
        console.log('⏭️  No export needed (no 100k boundary crossed)')
      }
    } catch (error) {
      console.error('❌ Error exporting bulk headers:', error)
      if (error instanceof Error) {
        console.error('   Error message:', error.message)
        console.error('   Stack trace:', error.stack)
      }
    } finally {
      isExporting = false
    }
  }

  // Subscribe to new block header events
  // This allows you to react to new blocks in real-time
  const headerSubscriptionId = await chaintracks.subscribeHeaders(
    async (header: BlockHeader) => {
      console.log(`📦 New block header received:`)
      console.log(`   Height: ${header.height}`)
      console.log(`   Hash: ${header.hash}`)
      console.log(`   Timestamp: ${new Date(header.time * 1000).toISOString()}`)

      // Check if we should export headers (non-blocking)
      if (enableBulkHeadersCDN) {
        exportBulkHeaders().catch(err =>
          console.error('Background export error:', err)
        )
      }
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

  // Start the ChaintracksService server
  await service.startJsonRpcServer(port)

  // Start a separate CDN server for bulk headers if enabled
  let cdnServer: any
  if (enableBulkHeadersCDN) {
    const cdnPort = port + 1 // Use next port for CDN
    const cdnApp = express.default()

    // CORS headers for CDN
    cdnApp.use((_req: any, res: any, next: any) => {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Headers', '*')
      res.header('Access-Control-Allow-Methods', '*')
      next()
    })

    // Serve static files from the bulk headers directory
    cdnApp.use('/', express.static(bulkHeadersPath, {
      setHeaders: (res: any, filePath: string) => {
        // Set appropriate headers for bulk header files
        if (filePath.endsWith('.headers')) {
          res.setHeader('Content-Type', 'application/octet-stream')
        } else if (filePath.endsWith('.json')) {
          res.setHeader('Content-Type', 'application/json')
        }
        res.setHeader('Cache-Control', 'public, max-age=3600')
      }
    }))

    cdnServer = cdnApp.listen(cdnPort, () => {
      console.log(`✓ Bulk Headers CDN server running on port ${cdnPort}`)
      console.log(`  Access files at: http://localhost:${cdnPort}/mainNetBlockHeaders.json`)
    })
  }

  // Perform initial export if CDN is enabled
  if (enableBulkHeadersCDN) {
    console.log('\n🔄 Performing initial bulk headers export...')
    await exportBulkHeaders()
  }

  // Set up periodic export check (every 10 minutes by default)
  let exportInterval: NodeJS.Timeout | undefined
  if (enableBulkHeadersCDN) {
    exportInterval = setInterval(() => {
      exportBulkHeaders().catch(err =>
        console.error('Periodic export error:', err)
      )
    }, bulkHeadersAutoExportInterval)
  }

  console.log(`\n✓ ChaintracksService is running on port ${port}`)
  console.log('\nAvailable Endpoints:')
  console.log(`  GET  http://localhost:${port}/getInfo - Get detailed service info`)
  console.log(`  GET  http://localhost:${port}/getPresentHeight - Get current height`)
  console.log(`  GET  http://localhost:${port}/findChainTipHeaderHex - Get chain tip`)
  if (enableBulkHeadersCDN) {
    console.log(`\n  CDN Endpoints (port ${cdnPort}):`)
    console.log(`  GET  http://localhost:${cdnPort}/${chain}NetBlockHeaders.json - Bulk headers metadata`)
    console.log(`  GET  http://localhost:${cdnPort}/*.headers - Bulk header files`)
  }
  console.log('\nAll standard ChaintracksService endpoints are available.')
  console.log('Press Ctrl+C to stop the server')

  // Enhanced shutdown with cleanup
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`)
    try {
      // Stop periodic export if running
      if (exportInterval) {
        clearInterval(exportInterval)
        console.log('Stopped periodic export timer')
      }

      // Stop CDN server if running
      if (cdnServer) {
        console.log('Stopping CDN server...')
        await new Promise<void>((resolve) => {
          cdnServer.close(() => {
            console.log('✓ CDN server stopped')
            resolve()
          })
        })
      }

      // Unsubscribe from events
      console.log('Unsubscribing from events...')
      await chaintracks.unsubscribe(headerSubscriptionId)
      await chaintracks.unsubscribe(reorgSubscriptionId)

      // Stop the service (this also destroys chaintracks)
      console.log('Stopping ChaintracksService server...')
      await service.stopJsonRpcServer()

      console.log('✓ All servers stopped successfully')
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
