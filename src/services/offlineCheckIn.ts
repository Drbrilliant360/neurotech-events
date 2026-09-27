import * as api from "./platformApi";

const DB = "neurotech-check-in-v1";
const STORE = "state";
const DEVICE_KEY = "neurotech.checkin.device";

export interface OfflineState {
  eventId: string;
  manifest: api.OfflineManifestDto;
  queue: api.OfflineScanDto[];
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function read(eventId: string): Promise<OfflineState | undefined> {
  const db = await openDb();
  return new Promise<OfflineState | undefined>((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(eventId);
    request.onsuccess = () => resolve(request.result as OfflineState | undefined);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

async function write(state: OfflineState): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(state, state.eventId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  }).finally(() => db.close());
}

function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_KEY, id); }
  return id;
}

export async function downloadManifest(eventId: string): Promise<OfflineState> {
  const state = { eventId, manifest: await api.fetchOfflineManifest(eventId), queue: (await read(eventId))?.queue ?? [] };
  await write(state);
  return state;
}

export async function offlineStatus(eventId: string): Promise<OfflineState | undefined> { return read(eventId); }

export async function queueScan(eventId: string, code: string): Promise<{ matched: boolean; label?: string; queued: number }> {
  const state = await read(eventId);
  if (!state || Date.parse(state.manifest.expires_at) <= Date.now()) throw new Error("Offline roster is missing or expired. Use manual verification until online.");
  const needle = code.trim().toUpperCase();
  const entry = state.manifest.entries.find((item) => item.qr_payload === code.trim() || item.ticket_number.toUpperCase() === needle);
  if (!entry) return { matched: false, queued: state.queue.length };
  if (!state.queue.some((item) => item.code === code.trim())) {
    state.queue.push({ client_operation_id: crypto.randomUUID(), code: code.trim(), scanned_at: new Date().toISOString() });
    await write(state);
  }
  return { matched: true, label: `${entry.attendee_name} · ${entry.ticket_name}`, queued: state.queue.length };
}

export async function reconcile(eventId: string): Promise<api.OfflineOutcomeDto[]> {
  const state = await read(eventId);
  if (!state?.queue.length) return [];
  const result = await api.reconcileOfflineScans(eventId, state.manifest.token, deviceId(), state.queue);
  const completed = new Set(result.outcomes.map((item) => item.client_operation_id));
  state.queue = state.queue.filter((item) => !completed.has(item.client_operation_id));
  await write(state);
  return result.outcomes;
}
