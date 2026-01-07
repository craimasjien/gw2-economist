---
name: GW2 Economist App
overview: Build a full-stack TanStack Start application with Drizzle ORM and PostgreSQL that fetches Guild Wars 2 trading post and recipe data, caches it locally, and helps users determine whether to buy or craft items based on market prices.
todos:
  - id: project-setup
    content: Initialize TanStack Start project with pnpm and install dependencies
    status: completed
  - id: docker-db
    content: Create Docker Compose for PostgreSQL and environment configuration
    status: completed
    dependencies:
      - project-setup
  - id: db-schema
    content: Define Drizzle schema for items, recipes, and prices tables
    status: pending
    dependencies:
      - docker-db
  - id: gw2-api-client
    content: Implement GW2 API client with file cache toggle
    status: pending
    dependencies:
      - project-setup
  - id: sync-scripts
    content: Create pnpm sync commands for items, recipes, and prices
    status: pending
    dependencies:
      - db-schema
      - gw2-api-client
  - id: craft-calculator
    content: Build craft cost calculator service with recursive recipe analysis
    status: pending
    dependencies:
      - db-schema
  - id: server-functions
    content: Create TanStack Start server functions for item search and analysis
    status: pending
    dependencies:
      - craft-calculator
  - id: frontend-ui
    content: Build search UI and craft analysis display components
    status: pending
    dependencies:
      - server-functions
  - id: tests
    content: Write unit and integration tests following TDD approach
    status: pending
    dependencies:
      - project-setup
---

# Guild Wars 2 Economist Application

## Architecture Overview

```mermaid
graph TB
    subgraph client [Client Layer]
        UI[React UI]
        TanStackRouter[TanStack Router]
    end
    
    subgraph server [Server Layer]
        ServerFn[Server Functions]
        CraftCalc[Craft Calculator Service]
        DataSync[Data Sync Service]
    end
    
    subgraph data [Data Layer]
        Cache[File Cache Adapter]
        GW2API[GW2 API Client]
        DrizzleORM[Drizzle ORM]
    end
    
    subgraph storage [Storage]
        PostgreSQL[(PostgreSQL)]
        FileCache[Local JSON Files]
    end
    
    UI --> TanStackRouter
    TanStackRouter --> ServerFn
    ServerFn --> CraftCalc
    ServerFn --> DataSync
    CraftCalc --> DrizzleORM
    DataSync --> GW2API
    DataSync --> Cache
    GW2API --> FileCache
    Cache --> FileCache
    DrizzleORM --> PostgreSQL
    DataSync --> DrizzleORM
```



## Project Structure

```javascript
gw2-economist/
├── docker-compose.yml
├── drizzle/                    # Generated migrations
├── drizzle.config.ts
├── .env.example
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── app/
│   ├── client.tsx
│   ├── router.tsx
│   ├── routes/
│   │   ├── __root.tsx
│   │   ├── index.tsx           # Home/search page
│   │   └── items/
│   │       └── $itemId.tsx     # Item detail with craft analysis
│   └── components/
│       ├── ItemSearch.tsx
│       ├── CraftAnalysis.tsx
│       └── PriceDisplay.tsx
├── server/
│   ├── db/
│   │   ├── index.ts            # Drizzle client
│   │   └── schema.ts           # Database schema
│   ├── services/
│   │   ├── gw2-api/
│   │   │   ├── client.ts       # GW2 API client with caching
│   │   │   ├── types.ts        # GW2 API types
│   │   │   └── cache.ts        # File cache implementation
│   │   ├── items.service.ts
│   │   ├── recipes.service.ts
│   │   └── craft-calculator.service.ts
│   └── functions/
│       ├── items.ts            # Server functions for items
│       ├── recipes.ts          # Server functions for recipes
│       └── craft-analysis.ts   # Server functions for analysis
├── scripts/
│   ├── sync-items.ts           # Sync all items from API
│   ├── sync-recipes.ts         # Sync all recipes from API
│   ├── sync-prices.ts          # Sync trading post prices
│   └── sync-all.ts             # Combined sync script
├── cache/                      # Local file cache (gitignored)
└── tests/
    ├── services/
    │   └── craft-calculator.test.ts
    └── setup.ts
```



## Phase 1: Project Foundation

### 1.1 Initialize TanStack Start Project

Create a new TanStack Start project with pnpm:

```bash
pnpm create @tanstack/start .
```

Install additional dependencies:

```bash
pnpm add drizzle-orm postgres dotenv zod
pnpm add -D drizzle-kit vitest @testing-library/react jsdom tsx
```



### 1.2 Docker Compose Setup

Create `docker-compose.yml` for PostgreSQL:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: gw2economist
      POSTGRES_PASSWORD: gw2economist
      POSTGRES_DB: gw2economist
    ports:
    - "5432:5432"
    volumes:
    - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```



### 1.3 Environment Configuration

Create `.env.example` with all required variables:

```env
DATABASE_URL=postgres://gw2economist:gw2economist@localhost:5432/gw2economist
GW2_API_KEY=your_api_key_here
USE_FILE_CACHE=true
CACHE_DIR=./cache
SYNC_INTERVAL_HOURS=1
```



## Phase 2: Database Layer

### 2.1 Drizzle Schema

Define schema in `server/db/schema.ts` with three main tables:| Table | Purpose | Key Fields ||-------|---------|------------|| `items` | All GW2 items | id, name, type, rarity, icon, vendorValue || `recipes` | Crafting recipes | id, outputItemId, outputCount, disciplines, ingredients (JSON) || `prices` | Trading post prices | itemId, buyPrice, sellPrice, supply, demand, updatedAt |

### 2.2 Database Client

Create `server/db/index.ts` using Drizzle with the postgres driver, configured via `DATABASE_URL` environment variable.

## Phase 3: GW2 API Integration

### 3.1 API Client with Cache Toggle

Implement `server/services/gw2-api/client.ts`:

- Wraps GW2 API v2 endpoints (`/items`, `/recipes`, `/commerce/prices`)
- Checks `USE_FILE_CACHE` env var before making requests
- When cache enabled: reads/writes JSON files to `cache/` directory
- Handles rate limiting with exponential backoff
- Batch requests (API supports up to 200 IDs per request)

Key endpoints to integrate:

- `GET /v2/items` - Item metadata
- `GET /v2/recipes` - Recipe data  
- `GET /v2/commerce/prices` - Trading post prices

### 3.2 File Cache Implementation

Create `server/services/gw2-api/cache.ts`:

```typescript
interface CacheAdapter {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, data: T): Promise<void>
  has(key: string): Promise<boolean>
}
```



- Store data as JSON files in `cache/{endpoint}/{id}.json`
- Include TTL metadata for cache invalidation

## Phase 4: Data Sync Scripts

### 4.1 Sync Commands

Add to `package.json`:

```json
{
  "scripts": {
    "sync:items": "tsx scripts/sync-items.ts",
    "sync:recipes": "tsx scripts/sync-recipes.ts", 
    "sync:prices": "tsx scripts/sync-prices.ts",
    "sync:all": "tsx scripts/sync-all.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```



### 4.2 Sync Logic

Each sync script will:

1. Fetch all IDs from the API (e.g., `/v2/items` returns all item IDs)
2. Batch fetch details (200 items per request)
3. Upsert into database using Drizzle
4. Track sync progress with logging

The hourly sync can be triggered via cron job or external scheduler using `pnpm sync:prices` (prices change most frequently).

## Phase 5: Craft Calculator Service

### 5.1 Core Algorithm

Implement `server/services/craft-calculator.service.ts`:

```typescript
interface CraftAnalysis {
  item: Item
  buyPrice: number           // Direct purchase cost
  craftCost: number          // Total materials cost
  recommendation: 'buy' | 'craft'
  savings: number            // Absolute savings
  savingsPercent: number     // Percentage savings
  materials: MaterialBreakdown[]
}

interface MaterialBreakdown {
  item: Item
  quantity: number
  unitPrice: number
  totalPrice: number
  canCraft: boolean
  craftCost?: number         // Recursive analysis if craftable
}
```

The calculator recursively analyzes nested recipes (e.g., Bolt of Gossamer requires Gossamer Scraps, which might be craftable from something else).

### 5.2 Server Functions

Create server functions in `server/functions/craft-analysis.ts`:

```typescript
export const analyzeCraftCost = createServerFn({ method: 'GET' })
  .validator(z.object({ itemId: z.number() }))
  .handler(async ({ data }) => {
    // Use CraftCalculator service
  })

export const searchItems = createServerFn({ method: 'GET' })
  .validator(z.object({ query: z.string() }))
  .handler(async ({ data }) => {
    // Search items by name
  })
```



## Phase 6: Frontend UI

### 6.1 Routes

| Route | Component | Purpose ||-------|-----------|---------|| `/` | Home | Item search with autocomplete || `/items/:itemId` | ItemDetail | Craft analysis display |

### 6.2 Components

- **ItemSearch**: Autocomplete search using server function
- **CraftAnalysis**: Displays buy vs craft comparison with visual breakdown
- **PriceDisplay**: Formats GW2 currency (gold/silver/copper)
- **MaterialTree**: Recursive display of material requirements

## Phase 7: Testing Strategy (TDD)

### 7.1 Test Setup

Configure Vitest with:

- `vitest.config.ts` for test configuration
- `tests/setup.ts` for database mocks and test utilities

### 7.2 Test Categories

1. **Unit Tests**: Craft calculator logic, price formatting, cache adapter
2. **Integration Tests**: Database queries, API client with mocked responses
3. **Component Tests**: React components with Testing Library

Example test for craft calculator:

```typescript
describe('CraftCalculatorService', () => {
  it('recommends buying when cheaper than crafting', async () => {
    // Given: Item costs 100c, materials cost 150c
    // When: Analyze craft cost
    // Then: Recommendation is 'buy'
  })
  
  it('handles recursive recipes', async () => {
    // Given: Item A requires Item B, which requires Item C
    // When: Analyze craft cost
    // Then: Returns full material tree
  })
})
```



## Data Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant ServerFn
    participant CraftCalc
    participant DB
    participant GW2API
    
    Note over GW2API,DB: Hourly Sync (Background)
    GW2API->>DB: Sync items, recipes, prices
    
    Note over User,DB: User Request Flow
    User->>UI: Search "Gossamer Bolt"
    UI->>ServerFn: searchItems(query)
    ServerFn->>DB: SELECT items WHERE name LIKE
    DB-->>UI: Item results
    
    User->>UI: Select item
    UI->>ServerFn: analyzeCraftCost(itemId)
    ServerFn->>CraftCalc: calculate(itemId)
    CraftCalc->>DB: Get recipe + material prices
    CraftCalc-->>ServerFn: CraftAnalysis result
    ServerFn-->>UI: Display recommendation
```



## Implementation Order

Execute phases in order, with tests written before implementation (TDD):

1. Phase 1: Project setup and dependencies
2. Phase 2: Database schema and migrations
3. Phase 3: GW2 API client with caching