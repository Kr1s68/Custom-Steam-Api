export enum Currency {
  USD = "USD",
  EUR = "EUR",
}

export interface ItemDetails {
  itemName: string;
  appId: string;
  marketHashName: string;
  currency: Currency;
  lowestPrice: number;
  volume: number;
  highestBuyOrder: { price: number; quantity: number } | null;
  lowestSellOrder: { price: number; quantity: number } | null;
  url: string;
}
