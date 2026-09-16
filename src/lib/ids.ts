export function createId(prefix: string): string {
  const rand = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${rand.slice(0, 12)}`;
}

export function ticketNumber(seq: number): string {
  return `NTS-${String(seq).padStart(6, "0")}`;
}

export function paymentReference(seq: number): string {
  return `TXN-${String(90000 + seq)}`;
}

export function certificateCode(seq: number): string {
  return `CERT-NT-${String(seq).padStart(4, "0")}`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}
