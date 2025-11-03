import { Currency, ItemDetails } from "../types/types";
import { BrowserManager } from "./BrowserManager";
import { PageDataExtractor } from "./PageDataExtractor";
import { ItemDataTransformer } from "./ItemDataTransformer";

export class SteamMarketScraper {
  private browserManager: BrowserManager;
  private pageDataExtractor: PageDataExtractor;
  private dataTransformer: ItemDataTransformer;

  constructor() {
    this.browserManager = new BrowserManager();
    this.pageDataExtractor = new PageDataExtractor();
    this.dataTransformer = new ItemDataTransformer();
  }

  async initialize(): Promise<void> {
    await this.browserManager.initialize();
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async scrapeItemByName(
    appId: string,
    itemName: string,
    currency: Currency = Currency.USD,
    maxRetries: number = 3,
    retryDelay: number = 2000
  ): Promise<ItemDetails> {
    const page = this.browserManager.getPage();

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`\nAttempt ${attempt}/${maxRetries} for item: ${itemName}`);

        // Construct the market listing URL (prices are fetched in USD, then converted)
        const marketHashName = encodeURIComponent(itemName);
        const itemUrl = `https://steamcommunity.com/market/listings/${appId}/${marketHashName}`;

        console.log(`Navigating to: ${itemUrl}`);
        await page.goto(itemUrl, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });

        // Wait for the page to load
        await page.waitForSelector(".market_listing_largeimage", {
          timeout: 15000,
        });

        // Wait for order book to load (buy/sell orders load via AJAX)
        console.log("Waiting for order book to load...");

        // Wait a bit for AJAX to start loading
        await this.delay(2000);

        try {
          await page.waitForSelector(
            "#market_commodity_buyrequests_table, #market_commodity_forsale_table, .market_commodity_orders_table",
            {
              timeout: 15000,
            }
          );
          console.log(
            "Order book tables found, waiting for data to populate..."
          );
          // Give it more time for the data to fully populate
          await this.delay(3000);
        } catch (error) {
          console.warn("Order book tables not found, continuing anyway...");
          await this.delay(2000);
        }

        console.log("Scraping item details...");

        const itemData = await this.pageDataExtractor.extractItemData(page);

        console.log("✓ Successfully scraped item data");

        // Transform raw data to ItemDetails with proper currency conversion
        const convertedData = this.dataTransformer.transformToItemDetails(
          itemData,
          currency
        );

        return convertedData;
      } catch (error) {
        lastError = error as Error;
        console.error(
          `✗ Attempt ${attempt} failed:`,
          error instanceof Error ? error.message : error
        );

        if (attempt < maxRetries) {
          console.log(`Waiting ${retryDelay}ms before retry...`);
          await this.delay(retryDelay);

          // Optionally reload the page for a fresh start
          try {
            await page.reload({
              waitUntil: "networkidle2",
              timeout: 10000,
            });
          } catch (reloadError) {
            console.warn("Failed to reload page, continuing anyway...");
          }
        }
      }
    }

    // If all retries failed, throw the last error
    throw new Error(
      `Failed to scrape item "${itemName}" after ${maxRetries} attempts. Last error: ${lastError?.message}`
    );
  }

  async close(): Promise<void> {
    await this.browserManager.close();
  }
}
