# ChaintracksService Express Server

A TypeScript Express server implementation wrapping the `ChaintracksService` from `@bsv/wallet-toolbox`. This server provides REST API endpoints for querying Bitcoin SV (BSV) blockchain headers with in-memory storage.

## Overview

The `ChaintracksService` class from `@bsv/wallet-toolbox` is a complete, production-ready Express server that:

- **Tracks BSV blockchain headers** in real-time
- **In-memory NoDb storage** - no database setup required
- **Automatic synchronization** with BSV blockchain via multiple sources
- **REST API endpoints** for querying headers by height, hash, or range
- **CORS enabled** for browser clients
- **Event subscriptions** for new headers and chain reorganizations
- **Graceful shutdown** handling

## Features

### Built-in Endpoints

All endpoints return JSON responses in this format:

```json
{
  "status": "success",
  "value": <result>
}
```

Or on error:

```json
{
  "status": "error",
  "code": "ERR_INTERNAL",
  "description": "error message"
}
```

#### GET Endpoints

- `GET /` - Server information page
- `GET /robots.txt` - Robots exclusion standard
- `GET /getChain` - Returns the blockchain network ('main' or 'test')
- `GET /getInfo` - Returns detailed service information including:
  - Current heights (bulk and live storage)
  - Storage backend type
  - Configured bulk and live ingestors
  - Package versions
- `GET /getPresentHeight` - Returns the latest blockchain height
- `GET /findChainTipHashHex` - Returns the chain tip block hash
- `GET /findChainTipHeaderHex` - Returns the chain tip block header
- `GET /findHeaderHexForHeight?height=N` - Returns header for specific height
- `GET /findHeaderHexForBlockHash?hash=HASH` - Returns header for specific block hash
- `GET /getHeaders?height=N&count=M` - Returns M headers starting from height N (as hex string)
- `GET /getFiatExchangeRates` - Returns current fiat exchange rates for BSV

#### POST Endpoints

- `POST /addHeaderHex` - Submit a new block header for consideration

### Storage Architecture

The default configuration uses **ChaintracksStorageNoDb** which:

- Stores headers in memory (no database required)
- Uses CDN for bulk historical headers
- Automatically syncs with blockchain
- Handles chain reorganizations
- Retains recent headers for fast access

### Network Services Integration

The server integrates with multiple BSV network services:

1. **BulkIngestorCDNBabbage** - Fetches historical headers from Babbage CDN
2. **BulkIngestorWhatsOnChainCdn** - Fetches headers from WhatsOnChain CDN
3. **LiveIngestorWhatsOnChainPoll** - Polls WhatsOnChain for new blocks

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` to configure:

```env
# Chain: 'main' or 'test'
CHAIN=main

# Server port (default: 3011)
PORT=3011

# Routing prefix for API endpoints (optional)
ROUTING_PREFIX=

# WhatsOnChain API Key (optional but recommended)
WHATSONCHAIN_API_KEY=your_api_key_here
```

## Usage

### Basic Server

The simplest way to start a ChaintracksService:

```bash
npm run build
npm start
```

Or for development:

```bash
npm run dev
```

This starts the server with default configuration on port 3011.

**Source:** `src/server.ts`

### Test Network

To run on testnet:

```bash
CHAIN=test npm start
# or
npm run start:test
```

### Server with API Versioning

Start with a routing prefix for API versioning:

```bash
ROUTING_PREFIX=/api/v1 npm run start:prefix
```

All endpoints will be prefixed (e.g., `/api/v1/getInfo`).

**Source:** `src/server-with-prefix.ts`

### Custom Configuration

For advanced configuration including event subscriptions:

```bash
npm run start:custom
```

This example shows:
- Custom Chaintracks options
- WhatsOnChain API key configuration
- Subscribing to new block events
- Subscribing to chain reorganization events
- Custom Services configuration

**Source:** `src/server-custom.ts`

## Code Examples

### 1. Basic Server Setup

```typescript
import { ChaintracksService } from '@bsv/wallet-toolbox/services/chaintracker/chaintracks/ChaintracksService'
import { Chain } from '@bsv/wallet-toolbox/sdk/types'

const service = new ChaintracksService({
  chain: 'main',
  routingPrefix: '',
  port: 3011
})

await service.startJsonRpcServer(3011)
```

### 2. Custom Configuration with Events

```typescript
import { Chaintracks } from '@bsv/wallet-toolbox/services/chaintracker/chaintracks/Chaintracks'
import { createDefaultNoDbChaintracksOptions } from '@bsv/wallet-toolbox/services/chaintracker/chaintracks/createDefaultNoDbChaintracksOptions'
import { Services } from '@bsv/wallet-toolbox/services/Services'

// Create custom Chaintracks with specific options
const chaintracksOptions = createDefaultNoDbChaintracksOptions(
  'main',
  'your_whatsonchain_api_key',
  100000, // maxPerFile
  2,      // maxRetained
  undefined, // fetch
  'https://cdn.projectbabbage.com/blockheaders/',
  2000,   // liveHeightThreshold
  400,    // reorgHeightThreshold
  500,    // bulkMigrationChunkSize
  400,    // batchInsertLimit
  36      // addLiveRecursionLimit
)

const chaintracks = new Chaintracks(chaintracksOptions)

// Subscribe to new block headers
await chaintracks.subscribeHeaders((header) => {
  console.log(`New block: ${header.height} - ${header.hash}`)
})

// Subscribe to reorgs
await chaintracks.subscribeReorgs((depth, oldTip, newTip) => {
  console.log(`Reorg detected: depth ${depth}`)
})

// Create service with custom chaintracks
const service = new ChaintracksService({
  chain: 'main',
  routingPrefix: '',
  chaintracks,
  services: new Services('main'),
  port: 3011
})

await service.startJsonRpcServer(3011)
```

### 3. Client Usage

```typescript
import { ChaintracksClient } from './client-example'

const client = new ChaintracksClient('http://localhost:3011')

// Get service info
const info = await client.getInfo()
console.log('Height:', info.heightLive)

// Get current height
const height = await client.getPresentHeight()

// Get chain tip
const chainTip = await client.findChainTipHeader()

// Get header by height
const header = await client.findHeaderForHeight(800000)

// Get multiple headers
const headers = await client.getHeaders(800000, 10)
```

## API Response Examples

### GET /getInfo

```json
{
  "status": "success",
  "value": {
    "chain": "main",
    "heightBulk": 869999,
    "heightLive": 870125,
    "storage": "ChaintracksStorageNoDb",
    "bulkIngestors": [
      "BulkIngestorCDNBabbage",
      "BulkIngestorWhatsOnChainCdn"
    ],
    "liveIngestors": [
      "LiveIngestorWhatsOnChainPoll"
    ],
    "packages": []
  }
}
```

### GET /findChainTipHeaderHex

```json
{
  "status": "success",
  "value": {
    "version": 536870912,
    "previousHash": "000000000000000003a1b48cf612e8...",
    "merkleRoot": "7c5f9c5e8b8a5c3d2e1f0a9b8c7d6e...",
    "time": 1703001234,
    "bits": 403123456,
    "nonce": 2876543210,
    "height": 870125,
    "hash": "00000000000000000123456789abcd..."
  }
}
```

### GET /getPresentHeight

```json
{
  "status": "success",
  "value": 870125
}
```

## Architecture

### ChaintracksService Initialization Sequence

1. **Constructor** - Creates ChaintracksService instance with options
   - If no `chaintracks` provided, creates one using `createDefaultNoDbChaintracksOptions`
   - If no `services` provided, creates default Services instance
   - Validates all components are on the same chain

2. **startJsonRpcServer()** - Starts the Express server
   - Calls `chaintracks.makeAvailable()` to initialize storage
   - Sets up Express app with body-parser and CORS middleware
   - Registers all REST API endpoints
   - Starts HTTP server listening on specified port

3. **Background Synchronization**
   - Bulk ingestors fetch historical headers from CDN
   - Live ingestors poll for new blocks
   - Main thread processes incoming headers
   - Storage automatically handles chain reorganizations

4. **Graceful Shutdown**
   - Call `stopJsonRpcServer()` to close HTTP server
   - Automatically destroys chaintracks instance
   - Cleans up all resources

### Storage Layers

```
┌─────────────────────────────────────────┐
│      ChaintracksService (Express)       │
│         REST API Endpoints              │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         Chaintracks Core                │
│   - Header validation                   │
│   - Chain reorganization handling       │
│   - Event subscriptions                 │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│   ChaintracksStorageNoDb (In-Memory)    │
│   - Bulk file manager (CDN backed)      │
│   - Live headers (recent blocks)        │
│   - Height range tracking               │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│        Bulk & Live Ingestors            │
│   - BulkIngestorCDNBabbage              │
│   - BulkIngestorWhatsOnChainCdn         │
│   - LiveIngestorWhatsOnChainPoll        │
└─────────────────────────────────────────┘
```

## Configuration Options

### ChaintracksServiceOptions

```typescript
interface ChaintracksServiceOptions {
  // Chain: 'main' or 'test'
  chain: Chain

  // Routing prefix for all endpoints (e.g., '/api/v1')
  routingPrefix: string

  // Custom Chaintracks instance (optional)
  // Defaults to createDefaultNoDbChaintracksOptions()
  chaintracks?: Chaintracks

  // Custom Services instance (optional)
  // Defaults to new Services(chain)
  services?: Services

  // Server port (optional)
  // Defaults to 3011 if not specified
  port?: number
}
```

### createDefaultNoDbChaintracksOptions Parameters

```typescript
function createDefaultNoDbChaintracksOptions(
  chain: Chain,                    // 'main' or 'test'
  whatsonchainApiKey?: string,    // WhatsOnChain API key
  maxPerFile?: number,            // Headers per bulk file (default: 100000)
  maxRetained?: number,           // Bulk files to retain (default: 2)
  fetch?: ChaintracksFetchApi,    // Custom fetch implementation
  cdnUrl?: string,                // CDN URL for bulk headers
  liveHeightThreshold?: number,   // Live vs bulk threshold (default: 2000)
  reorgHeightThreshold?: number,  // Max reorg depth (default: 400)
  bulkMigrationChunkSize?: number,// Migration batch size (default: 500)
  batchInsertLimit?: number,      // Insert batch size (default: 400)
  addLiveRecursionLimit?: number  // Missing header recursion (default: 36)
): ChaintracksOptions
```

## Error Handling

All endpoints use consistent error handling:

```typescript
try {
  const result = await someOperation()
  res.status(200).json({ status: 'success', value: result })
} catch (err) {
  res.status(500).json({
    status: 'error',
    code: 'ERR_INTERNAL',
    description: err?.message || 'An internal error has occurred.'
  })
}
```

Error codes follow the `WERR_*` pattern from `@bsv/wallet-toolbox`.

## Lifecycle Management

### Startup

```typescript
// Create service
const service = new ChaintracksService(options)

// Start server (this awaits initialization)
await service.startJsonRpcServer(port)
```

### Shutdown

```typescript
// Graceful shutdown
await service.stopJsonRpcServer()

// This automatically:
// - Closes HTTP server
// - Stops all ingestors
// - Destroys chaintracks storage
// - Cleans up resources
```

### Health Monitoring

Monitor service health via `/getInfo` endpoint:

```typescript
const info = await fetch('http://localhost:3011/getInfo').then(r => r.json())

// Check if synchronized
const isSynced = info.value.heightLive >= info.value.heightBulk

// Check lag behind network
const presentHeight = await fetch('http://localhost:3011/getPresentHeight')
  .then(r => r.json())
const lag = presentHeight.value - info.value.heightLive
```

## Best Practices

1. **Use WhatsOnChain API Key**
   - Get free API key at https://whatsonchain.com/
   - Increases rate limits and reliability
   - Configure via `WHATSONCHAIN_API_KEY` environment variable

2. **Implement Graceful Shutdown**
   - Always handle SIGINT and SIGTERM signals
   - Call `stopJsonRpcServer()` before exit
   - Wait for cleanup to complete

3. **Monitor Service Health**
   - Regularly poll `/getInfo` endpoint
   - Track `heightLive` to ensure synchronization
   - Monitor lag behind `presentHeight`

4. **Use Routing Prefix for Versioning**
   - Set `routingPrefix: '/api/v1'` for API versioning
   - Allows multiple API versions on same server
   - Enables gradual migration strategies

5. **Subscribe to Events for Real-time Updates**
   - Use `subscribeHeaders()` for new block notifications
   - Use `subscribeReorgs()` to handle chain reorganizations
   - Important for applications that need real-time data

6. **Handle Chain Reorganizations**
   - Subscribe to reorg events
   - Update application state when reorgs occur
   - Consider reorg depth when confirming transactions

## Troubleshooting

### Server won't start

- Check port is not already in use: `lsof -i :3011`
- Verify Node.js version: `node --version` (requires Node.js 18+)
- Check for TypeScript compilation errors: `npm run build`

### Headers not synchronizing

- Check internet connection
- Verify WhatsOnChain API key is valid
- Check logs for ingestor errors
- Try increasing `addLiveRecursionLimit`

### High memory usage

- Reduce `maxRetained` (fewer bulk files in memory)
- Reduce `maxPerFile` (smaller bulk files)
- Consider implementing database storage for production

## Performance Considerations

### Memory Usage

The NoDb storage keeps headers in memory:
- Each header: ~80 bytes
- Bulk files: `maxPerFile` × 80 bytes × `maxRetained`
- Live headers: `liveHeightThreshold` × 80 bytes
- Default config: ~16-20 MB memory usage

### Network Traffic

- Initial sync: Downloads bulk headers from CDN
- Live updates: Polls WhatsOnChain every ~100 seconds
- With API key: Better rate limits and reliability

### Response Times

- Header queries: < 1ms (in-memory lookup)
- Chain tip: < 1ms (cached)
- Present height: < 1s (cached for 1 minute)
- Bulk header fetch: Depends on CDN/network

## Production Deployment

For production use, consider:

1. **Use Database Storage**
   - Implement persistent storage with MySQL/PostgreSQL
   - Use `ChaintracksStorageKnex` instead of NoDb
   - See wallet-toolbox documentation for database setup

2. **Configure Services Redundancy**
   - Multiple ARC endpoints
   - Multiple WhatsOnChain endpoints
   - Failover configuration

3. **Monitoring**
   - Set up health check endpoint monitoring
   - Alert on synchronization lag
   - Monitor memory usage

4. **Load Balancing**
   - Deploy multiple instances behind load balancer
   - Share database for consistency
   - Use sticky sessions for event subscriptions

5. **Security**
   - Use HTTPS with reverse proxy (nginx/caddy)
   - Rate limit API endpoints
   - Validate API key for write operations

## Related Documentation

- **@bsv/wallet-toolbox**: https://github.com/bsv-blockchain/wallet-toolbox
- **BSV SDK**: https://github.com/bsv-blockchain/ts-sdk
- **WhatsOnChain API**: https://developers.whatsonchain.com/

## License

MIT

## Support

For issues and questions:
- wallet-toolbox: https://github.com/bsv-blockchain/wallet-toolbox/issues
- BSV Discord: https://discord.gg/bsv
