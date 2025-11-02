import puppeteer, { Browser, Page } from "puppeteer";
import { Currency, ItemDetails } from "../types/types";

export class SteamMarketScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private readonly EUR_TO_USD_RATE = 1.154730220179047;

  async initialize(): Promise<void> {
    console.log("Launching browser...");
    const isProduction = process.env.NODE_ENV === "production";

    this.browser = await puppeteer.launch({
      headless: isProduction ? true : false, // Headless in production, visible in development
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    this.page = await this.browser.newPage();

    // Set a realistic viewport and user agent
    await this.page.setViewport({ width: 1920, height: 1080 });
    await this.page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private convertPrice(priceString: string, targetCurrency: Currency): string {
    // Extract numeric value from price string (e.g., "$47.87 USD" -> 47.87)
    const match = priceString.match(/[\d,.]+/);
    if (!match) return priceString;

    const numericValue = parseFloat(match[0].replace(/,/g, ""));
    if (isNaN(numericValue)) return priceString;

    // Prices from Steam are always in USD, convert if needed
    if (targetCurrency === Currency.EUR) {
      const eurValue = numericValue / this.EUR_TO_USD_RATE;
      return `€${eurValue.toFixed(2)} EUR`;
    }

    return priceString; // Return as-is for USD
  }

  async scrapeItemByName(
    appId: string,
    itemName: string,
    currency: Currency = Currency.USD,
    maxRetries: number = 3,
    retryDelay: number = 2000
  ): Promise<ItemDetails> {
    if (!this.page) {
      throw new Error("Browser not initialized. Call initialize() first.");
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`\nAttempt ${attempt}/${maxRetries} for item: ${itemName}`);

        // Construct the market listing URL (prices are fetched in USD, then converted)
        const marketHashName = encodeURIComponent(itemName);
        const itemUrl = `https://steamcommunity.com/market/listings/${appId}/${marketHashName}`;

        console.log(`Navigating to: ${itemUrl}`);
        await this.page.goto(itemUrl, {
          waitUntil: "networkidle2",
          timeout: 30000,
        });

        // Wait for the page to load
        await this.page.waitForSelector(".market_listing_largeimage", {
          timeout: 15000,
        });

        // Wait for order book to load (buy/sell orders load via AJAX)
        console.log("Waiting for order book to load...");

        // Wait a bit for AJAX to start loading
        await this.delay(2000);

        try {
          await this.page.waitForSelector(
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

        const itemData = await this.page.evaluate(() => {
          // Helper function to clean price strings
          const cleanPrice = (text: string | null | undefined): string => {
            if (!text) return "N/A";
            return text.trim().replace(/\s+/g, " ");
          };

          // Get item name and image
          const itemNameElement = document.querySelector(
            ".market_listing_largeimage img"
          ) as HTMLImageElement;
          const imageUrl = itemNameElement?.src || "";
          const itemName = itemNameElement?.alt || "";

          // Get lowest price
          const lowestPriceElement = document.querySelector(
            ".market_listing_price_with_fee"
          );
          const lowestPrice = cleanPrice(lowestPriceElement?.textContent);

          // Get median price
          const medianPriceElement = document.querySelector(
            ".market_commodity_orders_header_promote"
          );
          const medianPrice = cleanPrice(medianPriceElement?.textContent);

          // Get volume (number sold in last 24 hours)
          const volumeElement = document.querySelector(
            ".market_commodity_orders_block:nth-child(2) span"
          );
          const volume = cleanPrice(volumeElement?.textContent);

          // Get highest buy order (first row in buy orders table)
          let highestBuyOrder: { price: string; quantity: string } | null =
            null;

          // Try multiple selectors for buy orders
          let buyOrderRows = document.querySelectorAll(
            "#market_commodity_buyrequests_table tbody tr"
          );

          if (buyOrderRows.length === 0) {
            buyOrderRows = document.querySelectorAll(
              "#market_commodity_buyrequests table tbody tr"
            );
          }

          if (buyOrderRows.length === 0) {
            buyOrderRows = document.querySelectorAll(
              ".market_commodity_orders_table tbody tr"
            );
          }

          // Get the second row (first row is header with <th>, second row has actual data)
          if (buyOrderRows.length > 1) {
            const dataRow = buyOrderRows[1]; // Skip header row at index 0
            const cells = dataRow.querySelectorAll("td");
            if (cells.length >= 2) {
              highestBuyOrder = {
                price: cleanPrice(cells[0]?.textContent),
                quantity: cleanPrice(cells[1]?.textContent),
              };
            }
          }

          // Get lowest sell order (first row in sell orders table)
          let lowestSellOrder: { price: string; quantity: string } | null =
            null;

          // Try multiple selectors for sell orders
          let sellOrderRows = document.querySelectorAll(
            "#market_commodity_forsale_table tbody tr"
          );

          if (sellOrderRows.length === 0) {
            sellOrderRows = document.querySelectorAll(
              "#market_commodity_forsale table tbody tr"
            );
          }

          if (sellOrderRows.length === 0) {
            sellOrderRows = document.querySelectorAll(
              ".market_commodity_orders_table tbody tr"
            );
          }

          // Get the second row (first row is header with <th>, second row has actual data)
          if (sellOrderRows.length > 1) {
            const dataRow = sellOrderRows[1]; // Skip header row at index 0
            const cells = dataRow.querySelectorAll("td");
            if (cells.length >= 2) {
              lowestSellOrder = {
                price: cleanPrice(cells[0]?.textContent),
                quantity: cleanPrice(cells[1]?.textContent),
              };
            }
          }

          // Get app ID and market hash name from URL
          const urlParts = window.location.pathname.split("/");
          const appId = urlParts[3] || "";
          const marketHashName = decodeURIComponent(urlParts[4] || "");

          return {
            itemName,
            appId,
            marketHashName,
            lowestPrice,
            medianPrice,
            volume,
            highestBuyOrder,
            lowestSellOrder,
            imageUrl,
            url: window.location.href,
          };
        });

        console.log("✓ Successfully scraped item data");

        // Convert prices to target currency
        const convertedData: ItemDetails = {
          ...itemData,
          currency: currency,
          lowestPrice: this.convertPrice(itemData.lowestPrice, currency),
          medianPrice: this.convertPrice(itemData.medianPrice, currency),
          highestBuyOrder: itemData.highestBuyOrder
            ? {
                price: this.convertPrice(
                  itemData.highestBuyOrder.price,
                  currency
                ),
                quantity: itemData.highestBuyOrder.quantity,
              }
            : null,
          lowestSellOrder: itemData.lowestSellOrder
            ? {
                price: this.convertPrice(
                  itemData.lowestSellOrder.price,
                  currency
                ),
                quantity: itemData.lowestSellOrder.quantity,
              }
            : null,
        };

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
            await this.page.reload({
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
    if (this.browser) {
      console.log("Closing browser...");
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}
