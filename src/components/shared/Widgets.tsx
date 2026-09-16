export function MediaTile({ label, height = 160 }: { label: string; height?: number }) {
  return (
    <div className="nt-media" style={{ minHeight: height, height }} aria-hidden="true">
      {label}
    </div>
  );
}

export function StatusPill({ value }: { value: string }) {
  const key = value.toLowerCase();
  const cls =
    key.includes("paid") || key.includes("confirm") || key.includes("publish") || key.includes("success") || key === "done" || key === "live"
      ? "ok"
      : key.includes("pend") || key.includes("process") || key.includes("draft") || key.includes("schedul")
        ? "warn"
        : key.includes("fail") || key.includes("cancel") || key.includes("refund")
          ? "bad"
          : "neutral";
  return <span className={`nt-badge ${cls}`}>{value}</span>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="nt-empty">
      <strong>{title}</strong>
      <p className="nt-muted">{body}</p>
    </div>
  );
}
