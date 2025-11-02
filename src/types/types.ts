export enum Currency {
  USD = "USD",
  EUR = "EUR",
}

export interface ItemDetails {
  itemName: string;
  appId: string;
  marketHashName: string;
  currency: Currency;
  lowestPrice: string;
  medianPrice: string;
  volume: string;
  highestBuyOrder: { price: string; quantity: string } | null;
  lowestSellOrder: { price: string; quantity: string } | null;
  imageUrl: string;
  url: string;
}
