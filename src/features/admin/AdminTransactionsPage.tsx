import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, StatusPill } from "../../components/shared/Widgets";
import { formatMoney, paymentMethodLabel } from "../../lib/money";
import {
  fetchAdminPayments,
  fetchProviderBalance,
  fetchProviderTransactions,
  isLivePaymentsEnabled,
  PaymentApiError,
  providerAmount,
  providerCustomer,
  verifyAdminPayment,
  type ProviderBalance,
  type ProviderTransaction,
  type RemotePayment,
} from "../../services/payments";

const TOKEN_KEY = "neurotech.events.admin-token";
const LIVE = isLivePaymentsEnabled();

function readToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function when(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function AdminTransactionsPage() {
  const [token, setToken] = useState(readToken);
  const [draft, setDraft] = useState("");
  const [balance, setBalance] = useState<ProviderBalance | null>(null);
  const [provider, setProvider] = useState<ProviderTransaction[]>([]);
  const [platform, setPlatform] = useState<RemotePayment[]>([]);
  const [platformTotal, setPlatformTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [bal, prov, plat] = await Promise.all([
        fetchProviderBalance(token),
        fetchProviderTransactions(token, { limit: 200 }),
        fetchAdminPayments(token, { page_size: 200 }),
      ]);
      setBalance(bal);
      setProvider(prov.items);
      setPlatform(plat.items);
      setPlatformTotal(plat.total);
      setLoadedAt(new Date());
    } catch (err) {
      if (err instanceof PaymentApiError && (err.status === 401 || err.status === 403)) {
        setError("The admin token was rejected by the server.");
      } else {
        setError(err instanceof PaymentApiError ? err.message : "Could not load transactions.");
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // Defer so the fetch (and its loading state) starts after the render that produced `load`.
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function connect() {
    const value = draft.trim();
    if (!value) return;
    try {
      sessionStorage.setItem(TOKEN_KEY, value);
    } catch {
      // Session storage may be unavailable; the token still works for this page load.
    }
    setToken(value);
    setDraft("");
  }

  function forget() {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
    setToken("");
    setBalance(null);
    setProvider([]);
    setPlatform([]);
    setError(null);
  }

  async function verify(id: string) {
    try {
      const updated = await verifyAdminPayment(token, id);
      setPlatform((items) => items.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(err instanceof PaymentApiError ? err.message : "Verification failed.");
    }
  }

  const needle = query.trim().toLowerCase();
  const providerRows = useMemo(
    () =>
      provider.filter((item) => {
        const itemStatus = (item.status ?? "").toLowerCase();
        if (status !== "all" && itemStatus !== status) return false;
        if (!needle) return true;
        const haystack = [item.reference, item.id, item.external_reference, providerCustomer(item), item.customer?.phone, item.customer?.email, JSON.stringify(item.metadata ?? {})]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      }),
    [provider, status, needle],
  );

  const providerStatuses = useMemo(() => Array.from(new Set(provider.map((item) => (item.status ?? "").toLowerCase()).filter(Boolean))).sort(), [provider]);
  const providerCompleted = provider.filter((item) => (item.status ?? "").toLowerCase() === "completed");
  const providerVolume = providerCompleted.reduce((sum, item) => sum + providerAmount(item), 0);
  const platformPaid = platform.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amount, 0);

  if (!LIVE) {
    return (
      <div>
        <h1>All transactions</h1>
        <EmptyState title="Live payments are not configured" body="Set VITE_API_BASE_URL to the backend URL to see real transactions from the payment provider." />
      </div>
    );
  }

  return (
    <div>
      <div className="nt-page-intro">
        <div>
          <p className="nt-kicker">Super admin · Provider account</p>
          <h1>All transactions</h1>
          <p className="nt-lede">Every payment on the Snippe account, including ones made outside this platform, plus the payments this platform created and verified.</p>
        </div>
      </div>

      {!token ? (
        <section className="nt-card nt-form-card" style={{ maxWidth: 560 }}>
          <p className="nt-kicker">Access</p>
          <h2>Enter the admin token</h2>
          <p className="nt-muted">This token is set on the server as ADMIN_API_TOKEN and is checked on every request. It is kept in this browser session only.</p>
          <div className="nt-toolbar" style={{ marginTop: 16 }}>
            <input className="nt-search" type="password" autoComplete="off" value={draft} placeholder="Admin API token" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && connect()} aria-label="Admin API token" />
            <button type="button" className="nt-btn" onClick={connect} disabled={!draft.trim()}>Connect</button>
          </div>
          {error ? <p className="nt-auth-error" role="alert">{error}</p> : null}
        </section>
      ) : (
        <>
          <div className="nt-grid stats">
            <div className="nt-card">Provider balance {balance ? formatMoney(balance.available, balance.currency) : "…"}</div>
            <div className="nt-card">Provider transactions {provider.length}</div>
            <div className="nt-card">Completed volume {formatMoney(providerVolume)}</div>
            <div className="nt-card">Platform payments {platformTotal} · paid {formatMoney(platformPaid)}</div>
          </div>

          <div className="nt-toolbar">
            <input className="nt-search" value={query} placeholder="Search reference, customer, phone, metadata…" onChange={(e) => setQuery(e.target.value)} aria-label="Search transactions" />
            <select className="nt-chip" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by provider status">
              <option value="all">All statuses</option>
              {providerStatuses.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <button type="button" className="nt-chip" onClick={load} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
            <button type="button" className="nt-chip" onClick={forget}>Forget token</button>
            {loadedAt ? <span className="nt-muted">Updated {loadedAt.toLocaleTimeString()}</span> : null}
          </div>
          {error ? <p className="nt-auth-error" role="alert">{error}</p> : null}

          <h2 style={{ marginTop: 24 }}>Provider account · {providerRows.length} of {provider.length}</h2>
          <div className="nt-table-wrap">
            <table className="nt-table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Channel</th>
                  <th>Amount</th>
                  <th>Net</th>
                  <th>Status</th>
                  <th>Metadata</th>
                </tr>
              </thead>
              <tbody>
                {providerRows.length === 0 ? (
                  <tr><td colSpan={8} className="nt-muted">{loading ? "Loading…" : "No transactions match."}</td></tr>
                ) : (
                  providerRows.map((item, index) => {
                    const key = `${item.id ?? item.reference ?? "row"}-${index}`;
                    const metadata = item.metadata ? Object.entries(item.metadata).map(([k, v]) => `${k}=${String(v)}`).join(" · ") : "";
                    return (
                      <tr key={key}>
                        <td>{when(item.created_at)}</td>
                        <td><code>{item.reference ?? item.id}</code>{item.external_reference && item.external_reference !== "NA" ? <div className="nt-muted">{item.external_reference}</div> : null}</td>
                        <td>{providerCustomer(item)}<div className="nt-muted">{item.customer?.phone ?? item.customer?.email ?? ""}</div></td>
                        <td>{item.channel?.provider ?? item.payment_type ?? "—"}</td>
                        <td>{formatMoney(providerAmount(item))}</td>
                        <td>{item.settlement?.net?.value != null ? formatMoney(item.settlement.net.value) : "—"}</td>
                        <td><StatusPill value={item.status ?? "unknown"} />{item.failure_reason ? <div className="nt-muted">{item.failure_reason}</div> : null}</td>
                        <td className="nt-muted">{metadata || "—"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <h2 style={{ marginTop: 32 }}>Platform payments · {platformTotal}</h2>
          <div className="nt-table-wrap">
            <table className="nt-table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Reference</th>
                  <th>Attendee</th>
                  <th>Event · ticket</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Provider ref</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {platform.length === 0 ? (
                  <tr><td colSpan={9} className="nt-muted">{loading ? "Loading…" : "No platform payments yet."}</td></tr>
                ) : (
                  platform.map((item) => (
                    <tr key={item.id}>
                      <td>{when(item.created_at)}</td>
                      <td><code>{item.reference}</code></td>
                      <td>{item.attendee_name}<div className="nt-muted">{item.attendee_email}</div></td>
                      <td>{item.event_title}<div className="nt-muted">{item.ticket_name} · {item.ticket_number}</div></td>
                      <td>{formatMoney(item.amount, item.currency)}</td>
                      <td>{paymentMethodLabel(item.method)}</td>
                      <td><StatusPill value={item.status} /></td>
                      <td className="nt-muted">{item.provider_reference ?? "—"}</td>
                      <td>
                        {item.status === "pending" || item.status === "processing" ? (
                          <button type="button" className="nt-chip" onClick={() => verify(item.id)}>Verify now</button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
