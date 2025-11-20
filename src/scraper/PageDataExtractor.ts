import { Page } from "puppeteer";

export interface RawItemData {
  itemName: string;
  appId: string;
  marketHashName: string;
  lowestPrice: string;
  volume: string;
  highestBuyOrder: { price: string; quantity: string } | null;
  lowestSellOrder: { price: string; quantity: string } | null;
  url: string;
}

export class PageDataExtractor {
  async extractItemData(page: Page): Promise<RawItemData> {
    return await page.evaluate(() => {
      // Helper function to clean price strings
      const cleanPrice = (text: string | null | undefined): string => {
        if (!text) return "N/A";
        return text.trim().replace(/\s+/g, " ");
      };

      // Get item name with multiple fallback selectors
      let itemName = "";
      const itemImgSelectors = [
        ".market_listing_largeimage img",
        ".market_listing_item_img img",
        ".market_listing_nav img",
        "img.market_listing_item_img",
      ];

      for (const selector of itemImgSelectors) {
        const element = document.querySelector(selector) as HTMLImageElement;
        if (element?.alt) {
          itemName = element.alt;
          break;
        }
      }

      // If still no name, try to get it from the page title or meta tags
      if (!itemName) {
        const titleMatch = document.title.match(/Steam Community Market :: Listings for (.+)/);
        if (titleMatch) {
          itemName = titleMatch[1];
        }
      }

      // Get lowest price with fallback selectors
      let lowestPrice = "N/A";
      const priceSelectors = [
        ".market_listing_price_with_fee",
        ".market_listing_price",
        ".normal_price",
      ];

      for (const selector of priceSelectors) {
        const element = document.querySelector(selector);
        if (element?.textContent) {
          lowestPrice = cleanPrice(element.textContent);
          break;
        }
      }

      // Get volume (number sold in last 24 hours) with fallbacks
      let volume = "N/A";
      const volumeSelectors = [
        ".market_commodity_orders_block:nth-child(2) span",
        ".market_commodity_orders_header_promote",
        ".market_commodity_orders_block span",
      ];

      for (const selector of volumeSelectors) {
        const element = document.querySelector(selector);
        if (element?.textContent && element.textContent.includes("sold")) {
          volume = cleanPrice(element.textContent);
          break;
        }
      }

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
        volume,
        highestBuyOrder,
        lowestSellOrder,
        url: window.location.href,
      };
    });
  }
}
