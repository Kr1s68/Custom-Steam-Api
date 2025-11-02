# Steam Market Scraper API

A TypeScript-based REST API for scraping Steam market data using Puppeteer and Express.

I've decided to build this cause I think it's outrageous that valve don't provide their own steam market api, since it's the most used video game item market on the internet and the items on there HAVE REAL VALUE.

Also fuck the people that charge 10+ euros a month for a simple web scraper market api, they are greedy assholes.

## Installation

```bash
npm install
```

## Configuration

**IMPORTANT:** Before running the server, you must configure your own API keys.

### Setting Up API Keys

1. Open the `.env` file in the project root directory
2. Modify the `VALID_API_KEYS` variable to include your own custom API keys:

```env
# Server Configuration
PORT=3000

# Valid API Keys (comma-separated)
# REPLACE 'your-secret-api-key-here' WITH YOUR OWN SECURE API KEY(S)
VALID_API_KEYS=your-secret-api-key-here

# Environment
NODE_ENV=development
```

### API Key Guidelines

- **Keep them secure** - API keys should be treated like passwords
- **Use strong keys** - Generate random, hard-to-guess strings
- **Multiple keys** - You can add multiple keys separated by commas:
  ```env
  VALID_API_KEYS=key1-abc123,key2-def456,key3-ghi789
  ```

### Example: Generating a Secure API Key

You can generate a random API key using Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Or use any random string generator. Example result:

```env
VALID_API_KEYS=9a4f2c8d5b7e3a1f6d9e2b8c5a7f3d1e
```

**Remember:** Restart the server after modifying the `.env` file.

## Usage

### Development Mode

```bash
npm run dev
```

Server will start on `http://localhost:3000`

### Production Build and Run

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── index.ts                      # Express server entry point
├── types/
│   └── types.ts                  # TypeScript interfaces and enums
├── scraper/
│   └── SteamMarketScraper.ts     # Puppeteer scraping logic
└── routes/
    └── itemRoutes.ts             # API route handlers
```

## Authentication

All API endpoints (except `/` and `/api/health`) require authentication via API key.

### Methods to Provide API Key

1. **Via Header** (recommended):

   ```bash
   curl -H "x-api-key: API_KEY" http://localhost:3000/api/item?appId=730&itemName=...
   ```

2. **Via Query Parameter**:
   ```
   GET /api/item?appId=730&itemName=...&apiKey=API_KEY
   ```

### Error Responses

**401 Unauthorized** - Missing API key:

```json
{
  "success": false,
  "error": "Access Denied",
  "message": "API key is required. Provide it via 'x-api-key' header or 'apiKey' query parameter."
}
```

**403 Forbidden** - Invalid API key:

```json
{
  "success": false,
  "error": "Access Denied",
  "message": "Invalid API key."
}
```

## API Endpoints

### `GET /`

Returns API information and available endpoints.

**Response:**

```json
{
  "message": "Steam Market Scraper API",
  "version": "1.0.0",
  "endpoints": { ... },
  "examples": { ... }
}
```

### `GET /api/health`

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "scraperInitialized": true
}
```

### `GET /api/item`

Scrape Steam market item data. **Requires authentication.**

**Query Parameters:**

- `appId` (required): Steam app ID (e.g., `730` for CS2)
- `itemName` (required): Item name (e.g., `AK-47 | Redline (Field-Tested)`)
- `currency` (optional): `USD` or `EUR` (defaults to `USD`)
- `apiKey` (optional): API key (can also be provided via `x-api-key` header)

**Example Request with Header:**

```bash
curl -H "x-api-key: API_KEY" \
  "http://localhost:3000/api/item?appId=730&itemName=AK-47%20%7C%20Redline%20%28Field-Tested%29&currency=EUR"
```

**Example Request with Query Parameter:**

```
GET /api/item?appId=730&itemName=AK-47 | Redline (Field-Tested)&currency=EUR&apiKey=API_KEY
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "itemName": "AK-47 | Redline (Field-Tested)",
    "appId": "730",
    "marketHashName": "AK-47 | Redline (Field-Tested)",
    "currency": "EUR",
    "lowestPrice": "€41.42 EUR",
    "medianPrice": "€48.31 EUR",
    "volume": "150",
    "highestBuyOrder": {
      "price": "€40.50 EUR",
      "quantity": "25"
    },
    "lowestSellOrder": {
      "price": "€41.42 EUR",
      "quantity": "10"
    },
    "imageUrl": "https://...",
    "url": "https://steamcommunity.com/market/listings/730/AK-47%20%7C%20Redline%20%28Field-Tested%29"
  }
}
```

## Features

- **REST API** with Express.js
- **API Key Authentication** - Secure access control with configurable API keys
- **Currency Conversion** between USD and EUR (hardcoded rate: 1.154730220179047)
- **Automatic Retry Logic** with configurable retries
- **Browser Reuse** - Single browser instance shared across requests
- **Type-Safe** with TypeScript interfaces
- **Error Handling** with descriptive error messages

## Currency Support

Currently supports:

- **USD** (US Dollar) - Default
- **EUR** (Euro) - Converted from USD using fixed rate

Prices are fetched in USD from Steam and converted to EUR if requested.

## Common Steam App IDs

- `730` - Counter-Strike 2 (CS2)
- `440` - Team Fortress 2
- `570` - Dota 2
- `252490` - Rust

## Notes

- **Security:** Always replace the default API key (`your-secret-api-key-here`) with your own secure keys before deploying or sharing this API.
- **Environment Variables:** The `.env` file contains sensitive information. Never commit it to version control (it's already in `.gitignore`).
- The scraper runs in **non-headless mode** by default (browser is visible). Set `headless: true` in `SteamMarketScraper.ts` for production.
- Browser instance is initialized on first API request and reused for subsequent requests.
- Be respectful of Steam's servers - the scraper includes built-in delays.
- The API handles SIGINT/SIGTERM for graceful shutdown and browser cleanup.

## Error Handling

The API returns appropriate HTTP status codes:

- `200` - Success
- `400` - Bad request (missing/invalid parameters)
- `404` - Endpoint not found
- `500` - Internal server error (scraping failed)

Example error response:

```json
{
  "success": false,
  "error": "Failed to scrape item after 3 attempts. Last error: ..."
}
```

## Development

The project uses:

- **TypeScript** for type safety
- **Express** for REST API
- **Puppeteer** for web scraping
- **ts-node** for development

## License

MIT
