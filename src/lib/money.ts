const TZS = new Intl.NumberFormat("en-TZ", {
  style: "decimal",
  maximumFractionDigits: 0,
});

export function formatMoney(amount: number, currency = "TZS"): string {
  if (amount === 0) return "Free";
  return `${currency} ${TZS.format(amount)}`;
}

export function fromLowestPrice(prices: number[], currency = "TZS"): string {
  if (prices.length === 0) return "—";
  const min = Math.min(...prices);
  if (min === 0) return "Free";
  return `From ${formatMoney(min, currency)}`;
}

export function computeVat(subtotal: number, vatPercent: number): number {
  return Math.round(subtotal * (vatPercent / 100));
}

export function paymentMethodLabel(method: string): string {
  switch (method) {
    case "mpesa":
      return "Vodacom M-Pesa";
    case "airtel":
      return "Airtel Money";
    case "mixx":
      return "Mixx by Yas";
    case "halopesa":
      return "HaloPesa";
    case "card":
      return "Card";
    case "bank":
      return "Bank transfer";
    default:
      return method;
  }
}

export function isMobileMoney(method: string): boolean {
  return method === "mpesa" || method === "airtel" || method === "mixx" || method === "halopesa";
}
