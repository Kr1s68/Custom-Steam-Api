import { Currency } from "../types/types";

export class PriceConverter {
  private readonly EUR_TO_USD_RATE = 1.154730220179047;

  parsePrice(priceString: string): number {
    // Extract numeric value from price string (e.g., "$47.87 USD" -> 47.87)
    const match = priceString.match(/[\d,.]+/);
    if (!match) return 0;

    const numericValue = parseFloat(match[0].replace(/,/g, ""));
    return isNaN(numericValue) ? 0 : numericValue;
  }

  convertPrice(priceUSD: number, targetCurrency: Currency): number {
    // Prices from Steam are always in USD, convert if needed
    if (targetCurrency === Currency.EUR) {
      const eurValue = priceUSD / this.EUR_TO_USD_RATE;
      return Math.round(eurValue * 100) / 100; // Round to 2 decimal places
    }

    return Math.round(priceUSD * 100) / 100; // Return USD rounded to 2 decimals
  }

  parseQuantity(quantityString: string): number {
    return parseInt(quantityString.replace(/[^\d]/g, "")) || 0;
  }
}
