import { Currency, ItemDetails } from "../types/types";
import { PriceConverter } from "./PriceConverter";
import { RawItemData } from "./PageDataExtractor";

export class ItemDataTransformer {
  private priceConverter: PriceConverter;

  constructor() {
    this.priceConverter = new PriceConverter();
  }

  transformToItemDetails(
    rawData: RawItemData,
    targetCurrency: Currency
  ): ItemDetails {
    // Parse string prices to numbers and convert to target currency
    const lowestPriceUSD = this.priceConverter.parsePrice(rawData.lowestPrice);
    const volumeNum = this.priceConverter.parseQuantity(rawData.volume);

    const convertedData: ItemDetails = {
      ...rawData,
      currency: targetCurrency,
      lowestPrice: this.priceConverter.convertPrice(lowestPriceUSD, targetCurrency),
      volume: volumeNum,
      highestBuyOrder: rawData.highestBuyOrder
        ? {
            price: this.priceConverter.convertPrice(
              this.priceConverter.parsePrice(rawData.highestBuyOrder.price),
              targetCurrency
            ),
            quantity: this.priceConverter.parseQuantity(rawData.highestBuyOrder.quantity),
          }
        : null,
      lowestSellOrder: rawData.lowestSellOrder
        ? {
            price: this.priceConverter.convertPrice(
              this.priceConverter.parsePrice(rawData.lowestSellOrder.price),
              targetCurrency
            ),
            quantity: this.priceConverter.parseQuantity(rawData.lowestSellOrder.quantity),
          }
        : null,
    };

    return convertedData;
  }
}
