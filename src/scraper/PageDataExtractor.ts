import { Page } from "puppeteer";

export interface RawItemData {
  itemName: string;
  appId: string;
  marketHashName: string;
  lowestPrice: string;
  medianPrice: string;
  volume: string;
  highestBuyOrder: { price: string; quantity: string } | null;
  lowestSellOrder: { price: string; quantity: string } | null;
  imageUrl: string;
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
  }
}
