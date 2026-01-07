---
name: GW2 Economist App
overview: Build a full-stack TanStack Start application with Drizzle ORM and PostgreSQL that fetches Guild Wars 2 trading post and recipe data, caches it locally, and helps users determine whether to buy or craft items based on market prices. Uses TDD methodology—tests are written before implementation for each feature.
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
    content: Define Drizzle schema for items, recipes, and prices tables (tests first)
    status: pending
    dependencies:
      - docker-db
  - id: gw2-api-client
    content: Implement GW2 API client with file cache toggle (tests first)
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
    content: Build craft cost calculator service with recursive recipe analysis (tests first)
    status: pending
    dependencies:
      - db-schema
  - id: server-functions
    content: Create TanStack Start server functions for item search and analysis (tests first)
    status: pending
    dependencies:
      - craft-calculator
  - id: frontend-ui
    content: Build search UI and craft analysis display components (tests first)
    status: pending
    dependencies:
      - server-functions
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



## TDD Methodology

This project follows **Test-Driven Development (TDD)**. For each feature:

1. **Red**: Write a failing test that defines expected behavior
2. **Green**: Write minimal code to make the test pass
3. **Refactor**: Clean up code while keeping tests green

### Test Categories

| Category | Tools | Purpose ||----------|-------|---------|| Unit Tests | Vitest | Pure logic: craft calculator, price formatting, cache adapter || Integration Tests | Vitest + test DB | Database queries, API client with mocked responses || Component Tests | Vitest + Testing Library | React components with user interactions |

### Test File Conventions

- Test files live alongside source: `*.test.ts` or in `tests/` directory
- Use descriptive test names: `it('recommends buying when market price is lower than craft cost')`
- Mock external dependencies (GW2 API, database) for unit tests

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
USE_FILE_CACHE=true
CACHE_DIR=./cache
SYNC_INTERVAL_HOURS=1
```

> **Note**: No API key required! The endpoints we use (`/v2/items`, `/v2/recipes`, `/v2/commerce/prices`) are public.

## Phase 2: Database Layer

### 2.1 Tests First: Schema Validation

Write tests before implementing the schema:

```typescript
// tests/db/schema.test.ts
describe('Database Schema', () => {
  it('items table has required columns', () => {
    // Verify schema exports have correct column definitions
  })
  
  it('recipes ingredients column accepts valid JSON structure', () => {
    // Test JSON serialization/deserialization
  })
  
  it('prices table has composite key on itemId', () => {
    // Verify primary key constraints
  })
})
```



### 2.2 Drizzle Schema

Define schema in `server/db/schema.ts` with three main tables:| Table | Purpose | Key Fields ||-------|---------|------------|| `items` | All GW2 items | id, name, type, rarity, icon, vendorValue || `recipes` | Crafting recipes | id, outputItemId, outputCount, disciplines, ingredients (JSON) || `prices` | Trading post prices | itemId, buyPrice, sellPrice, supply, demand, updatedAt |

### 2.3 Database Client

Create `server/db/index.ts` using Drizzle with the postgres driver, configured via `DATABASE_URL` environment variable.

## Phase 3: GW2 API Integration

### 3.1 Tests First: API Client & Cache

Write tests before implementing:

```typescript
// tests/services/gw2-api/cache.test.ts
describe('CacheAdapter', () => {
  it('returns null for missing cache entries', async () => {})
  it('stores and retrieves data correctly', async () => {})
  it('respects TTL and expires old entries', async () => {})
})

// tests/services/gw2-api/client.test.ts
describe('GW2ApiClient', () => {
  it('fetches items by ID array', async () => {})
  it('uses cache when USE_FILE_CACHE is true', async () => {})
  it('batches requests in chunks of 200', async () => {})
  it('handles rate limiting with retry', async () => {})
})
```



### 3.2 API Client with Cache Toggle

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

### 3.3 File Cache Implementation

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

### 5.1 Tests First: Craft Calculator Logic

This is the core business logic—write comprehensive tests first:

```typescript
// tests/services/craft-calculator.test.ts
describe('CraftCalculatorService', () => {
  it('recommends buying when market price is lower than craft cost', async () => {
    // Given: Item costs 100c to buy, materials cost 150c
    // When: Analyze craft cost
    // Then: Recommendation is 'buy', savings = 50c
  })
  
  it('recommends crafting when cheaper than buying', async () => {
    // Given: Item costs 200c to buy, materials cost 120c
    // When: Analyze craft cost
    // Then: Recommendation is 'craft', savings = 80c
  })
  
  it('handles recursive recipes correctly', async () => {
    // Given: Item A requires Item B, which requires Item C
    // When: Analyze craft cost
    // Then: Returns full material tree with nested costs
  })
  
  it('uses buy price when sub-material is cheaper to buy than craft', async () => {
    // Given: Sub-material craft cost > buy price
    // When: Analyze parent item
    // Then: Uses buy price for that sub-material
  })
  
  it('returns null for items without recipes', async () => {})
  it('handles items with no trading post listing', async () => {})
})
```



### 5.2 Core Algorithm

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

### 5.3 Server Functions

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

### 6.1 Tests First: Component Tests

Write component tests before building the UI:

```typescript
// tests/components/PriceDisplay.test.tsx
describe('PriceDisplay', () => {
  it('formats 12345 copper as 1g 23s 45c', () => {})
  it('omits gold when value is less than 100s', () => {})
  it('handles zero value', () => {})
})

// tests/components/ItemSearch.test.tsx
describe('ItemSearch', () => {
  it('shows loading state while searching', () => {})
  it('displays search results', () => {})
  it('navigates to item detail on selection', () => {})
})

// tests/components/CraftAnalysis.test.tsx
describe('CraftAnalysis', () => {
  it('displays buy recommendation with green highlight', () => {})
  it('displays craft recommendation with blue highlight', () => {})
  it('shows material breakdown tree', () => {})
})
```



### 6.2 Routes

| Route | Component | Purpose ||-------|-----------|---------|| `/` | Home | Item search with autocomplete || `/items/:itemId` | ItemDetail | Craft analysis display |

### 6.3 Components

- **ItemSearch**: Autocomplete search using server function
- **CraftAnalysis**: Displays buy vs craft comparison with visual breakdown
- **PriceDisplay**: Formats GW2 currency (gold/silver/copper)
- **MaterialTree**: Recursive display of material requirements

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