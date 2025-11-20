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

  private async debugPageState(page: any): Promise<string> {
    try {
      const pageInfo = await page.evaluate(() => {
        const url = window.location.href;
        const title = document.title;
        const hasAgeGate = !!document.querySelector(".agegate_birthday_selector");
        const hasError = !!document.querySelector(".error_ctn");
        const bodyText = document.body.innerText.substring(0, 500);

        // Check for various market-related elements
        const marketElements = {
          largeImage: !!document.querySelector(".market_listing_largeimage"),
          itemImg: !!document.querySelector(".market_listing_item_img"),
          pageFullWidth: !!document.querySelector(".market_page_fullwidth"),
          listingNav: !!document.querySelector(".market_listing_nav"),
          largeItemInfo: !!document.querySelector("#largeiteminfo"),
          priceElement: !!document.querySelector(".market_listing_price_with_fee"),
          orderTables: !!document.querySelector(".market_commodity_orders_table"),
        };

        // Get all divs with market-related classes
        const allMarketClasses: string[] = [];
        document.querySelectorAll('[class*="market"]').forEach((el) => {
          if (el.className && typeof el.className === 'string') {
            allMarketClasses.push(el.className);
          }
        });

        return {
          url,
          title,
          hasAgeGate,
          hasError,
          marketElements,
          firstFewMarketClasses: allMarketClasses.slice(0, 10),
          bodyText,
        };
      });

      return JSON.stringify(pageInfo, null, 2);
    } catch (error) {
      return `Failed to get page info: ${error}`;
    }
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
          waitUntil: "networkidle0",
          timeout: 30000,
        });

        // Give the page more time to fully load JavaScript
        console.log("Waiting for page to fully load...");
        await this.delay(3000);

        // Scroll the page to trigger any lazy-loading
        console.log("Scrolling to trigger lazy-loaded elements...");
        await page.evaluate(() => {
          window.scrollTo(0, 300);
        });
        await this.delay(1000);
        await page.evaluate(() => {
          window.scrollTo(0, 0);
        });
        await this.delay(1000);

        // Check if we're on an age gate or error page
        const pageState = await page.evaluate(() => {
          return {
            hasAgeGate: !!document.querySelector(".agegate_birthday_selector"),
            hasError: !!document.querySelector(".error_ctn"),
            currentUrl: window.location.href,
          };
        });

        if (pageState.hasAgeGate) {
          console.log("Age gate detected, submitting age verification...");

          // Try to submit the age gate
          try {
            await page.evaluate(() => {
              const viewButton = document.querySelector(
                "#view_product_page_btn"
              ) as HTMLElement;
              if (viewButton) viewButton.click();
            });
            await this.delay(2000);
          } catch (ageError) {
            console.warn("Could not bypass age gate automatically");
          }
        }

        if (pageState.hasError) {
          const debugInfo = await this.debugPageState(page);
          throw new Error(`Steam error page detected. Page info: ${debugInfo}`);
        }

        // Wait for market content to load - use multiple selector strategies
        console.log("Waiting for market listing to load...");

        // Try multiple selectors for confirming page loaded
        const selectors = [
          ".market_listing_largeimage",
          ".market_listing_item_img",
          ".market_page_fullwidth",
          ".market_listing_nav",
          "#largeiteminfo",
        ];

        let elementFound = false;
        for (const selector of selectors) {
          try {
            await page.waitForSelector(selector, {
              timeout: 5000,
              visible: true,
            });
            console.log(`✓ Found element: ${selector}`);
            elementFound = true;
            break;
          } catch (e) {
            console.log(`✗ Selector not found: ${selector}`);
          }
        }

        if (!elementFound) {
          // Last resort: check if the page has the item name in the title
          const hasCorrectTitle = await page.evaluate(() => {
            return document.title.includes("Listings for");
          });

          if (hasCorrectTitle) {
            console.log("Page loaded but using alternative verification method");
            elementFound = true;
          }
        }

        if (!elementFound) {
          // If main selector fails, check page state and provide detailed error
          const debugInfo = await this.debugPageState(page);
          console.error("Failed to find market listing. Debug info:", debugInfo);

          throw new Error(
            `Market listing not found. The page may have redirected or Steam is blocking the request. Debug info: ${debugInfo}`
          );
        }

        console.log("Market listing found, waiting for order book...");

        // Wait for order book to load (buy/sell orders load via AJAX)
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

          // For next attempt, try going to Steam homepage first to establish session
          if (attempt === 1) {
            console.log("Establishing Steam session before retry...");
            try {
              await page.goto("https://steamcommunity.com/market/", {
                waitUntil: "domcontentloaded",
                timeout: 10000,
              });
              await this.delay(1000);
            } catch (sessionError) {
              console.warn("Failed to establish session, continuing anyway...");
            }
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
