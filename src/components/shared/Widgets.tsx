export function MediaTile({
  label,
  height = 160,
  src,
}: {
  label: string;
  height?: number;
  src?: string;
}) {
  return (
    <div
      className={`nt-media${src ? " has-image" : ""}`}
      style={{ minHeight: height, height }}
      aria-hidden={src ? undefined : true}
    >
      {src ? <img src={src} alt={label} loading="lazy" decoding="async" /> : label}
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
