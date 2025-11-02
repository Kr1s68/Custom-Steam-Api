import { Router, Request, Response } from "express";
import { SteamMarketScraper } from "../scraper/SteamMarketScraper";
import { Currency } from "../types/types";
import { validateApiKey } from "../middleware/auth";

const router = Router();

// Initialize a single scraper instance to reuse browser
let scraper: SteamMarketScraper | null = null;

// Initialize scraper on first request
async function initializeScraper() {
  if (!scraper) {
    scraper = new SteamMarketScraper();
    await scraper.initialize();
  }
  return scraper;
}

/**
 * GET /api/item
 * Query params:
 *   - appId: string (e.g., "730" for CS2)
 *   - itemName: string (e.g., "AK-47 | Redline (Field-Tested)")
 *   - currency: "USD" | "EUR" (optional, defaults to USD)
 *   - apiKey: string (optional, can also be provided via x-api-key header)
 *
 * Example: /api/item?appId=730&itemName=AK-47 | Redline (Field-Tested)&currency=EUR&apiKey=Krisakabg2
 */
router.get("/item", validateApiKey, async (req: Request, res: Response) => {
  try {
    const { appId, itemName, currency } = req.query;

    // Validate required parameters
    if (!appId || typeof appId !== "string") {
      return res.status(400).json({
        error: "Missing or invalid 'appId' parameter",
        example: "/api/item?appId=730&itemName=AK-47 | Redline (Field-Tested)&currency=USD",
      });
    }

    if (!itemName || typeof itemName !== "string") {
      return res.status(400).json({
        error: "Missing or invalid 'itemName' parameter",
        example: "/api/item?appId=730&itemName=AK-47 | Redline (Field-Tested)&currency=USD",
      });
    }

    // Validate and parse currency
    let parsedCurrency: Currency = Currency.USD;
    if (currency) {
      if (currency !== "USD" && currency !== "EUR") {
        return res.status(400).json({
          error: "Invalid 'currency' parameter. Must be 'USD' or 'EUR'",
          example: "/api/item?appId=730&itemName=AK-47 | Redline (Field-Tested)&currency=EUR",
        });
      }
      parsedCurrency = currency as Currency;
    }

    // Initialize scraper if needed
    const scraperInstance = await initializeScraper();

    // Scrape the item
    console.log(`API Request: Scraping ${itemName} for app ${appId} in ${parsedCurrency}`);
    const itemData = await scraperInstance.scrapeItemByName(
      appId,
      itemName,
      parsedCurrency
    );

    // Return the data
    res.json({
      success: true,
      data: itemData,
    });
  } catch (error) {
    console.error("Error in /api/item:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    scraperInitialized: scraper !== null,
  });
});

// Cleanup on process exit
process.on("SIGINT", async () => {
  console.log("\nReceived SIGINT, cleaning up...");
  if (scraper) {
    await scraper.close();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nReceived SIGTERM, cleaning up...");
  if (scraper) {
    await scraper.close();
  }
  process.exit(0);
});

export default router;
