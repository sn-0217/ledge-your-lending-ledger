import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  getDb,
  LEDGE_COLLECTIONS,
  migrateLegacyLocalDatabase,
  setActiveDatabaseUser,
  type LedgeCollection,
  type SyncOutboxEntry,
} from "@/lib/db";
import { getSupabaseClient } from "@/lib/supabase";

export type CloudSyncStatus = "connecting" | "synced" | "offline" | "error";

export interface CloudSyncState {
  status: CloudSyncStatus;
  message: string;
  lastSyncedAt: number | null;
}

interface CloudRecord {
  owner_id: string;
  collection: LedgeCollection;
  record_id: string;
  payload: Record<string, unknown>;
  revision: number;
  client_updated_at: number;
  updated_at: string;
  deleted_at: string | null;
}

interface SyncCandidate {
  ownerId: string;
  collection: LedgeCollection;
  recordId: string;
  payload: Record<string, unknown> | null;
  deleted: boolean;
  changedAt: number;
  source: "local" | "outbox" | "remote";
}

const EMPTY_STATE: CloudSyncState = {
  status: "connecting",
  message: "Preparing cloud sync…",
  lastSyncedAt: null,
};

let state = EMPTY_STATE;
const listeners = new Set<(next: CloudSyncState) => void>();
let connectedUserId: string | null = null;
let activeChannel: RealtimeChannel | null = null;
let activeDisposer: (() => void) | null = null;
let flushPromise: Promise<void> | null = null;

function setState(next: CloudSyncState) {
  state = next;
  for (const listener of listeners) listener(next);
}

export function getCloudSyncState(): CloudSyncState {
  return state;
}

export function subscribeCloudSync(listener: (next: CloudSyncState) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function disconnectCloudSync() {
  activeDisposer?.();
}

function makeKey(collection: LedgeCollection, recordId: string) {
  return `${collection}:${recordId}`;
}

function collectionForTable(table: string): LedgeCollection | null {
  return LEDGE_COLLECTIONS.includes(table as LedgeCollection) ? (table as LedgeCollection) : null;
}

function recordTimestamp(record: Record<string, unknown>) {
  const updatedAt = Number(record.updatedAt ?? 0);
  const createdAt = Number(record.createdAt ?? 0);
  return Math.max(updatedAt, createdAt);
}

function currentDb() {
  return getDb();
}

async function readLocalRecords(): Promise<SyncCandidate[]> {
  const db = currentDb();
  const result: SyncCandidate[] = [];
  const tables = [db.people, db.categories, db.transactions, db.chittis, db.chittiPayments];
  for (const table of tables) {
    const collection = collectionForTable(table.name);
    if (!collection) continue;
    const records = (await table.toArray()) as unknown as Array<Record<string, unknown>>;
    for (const record of records) {
      if (typeof record.id !== "string") continue;
      result.push({
        ownerId: connectedUserId!,
        collection,
        recordId: record.id,
        payload: record,
        deleted: false,
        changedAt: recordTimestamp(record),
        source: "local",
      });
    }
  }
  return result;
}

async function readRemoteRecords(userId: string): Promise<CloudRecord[]> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured for this app.");

  const pageSize = 500;
  const records: CloudRecord[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("ledge_records")
      .select(
        "owner_id,collection,record_id,payload,revision,client_updated_at,updated_at,deleted_at",
      )
      .eq("owner_id", userId)
      .order("client_updated_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as CloudRecord[];
    records.push(...page);
    if (page.length < pageSize) break;
  }
  return records;
}

async function readOutbox(userId: string): Promise<SyncOutboxEntry[]> {
  return currentDb().syncOutbox.where("ownerId").equals(userId).toArray();
}

function preferCandidate(previous: SyncCandidate | undefined, next: SyncCandidate) {
  if (!previous || next.changedAt > previous.changedAt) return next;
  if (next.changedAt < previous.changedAt) return previous;
  const priority = { local: 1, remote: 2, outbox: 3 };
  return priority[next.source] > priority[previous.source] ? next : previous;
}

function remoteCandidate(row: CloudRecord): SyncCandidate {
  return {
    ownerId: row.owner_id,
    collection: row.collection,
    recordId: row.record_id,
    payload: row.payload,
    deleted: Boolean(row.deleted_at),
    changedAt: Number(row.client_updated_at || recordTimestamp(row.payload)),
    source: "remote",
  };
}

function outboxCandidate(entry: SyncOutboxEntry): SyncCandidate {
  return {
    ownerId: entry.ownerId,
    collection: entry.collection,
    recordId: entry.recordId,
    payload: entry.payload,
    deleted: entry.operation === "delete",
    changedAt: entry.changedAt,
    source: "outbox",
  };
}

function chooseCandidates(
  userId: string,
  local: SyncCandidate[],
  outbox: SyncOutboxEntry[],
  remote: CloudRecord[],
) {
  const chosen = new Map<string, SyncCandidate>();
  for (const candidate of [
    ...remote.map(remoteCandidate),
    ...local,
    ...outbox.map(outboxCandidate),
  ]) {
    if (candidate.ownerId !== userId) continue;
    const key = makeKey(candidate.collection, candidate.recordId);
    chosen.set(key, preferCandidate(chosen.get(key), candidate));
  }
  return chosen;
}

async function applyLocalCandidate(candidate: SyncCandidate) {
  const db = currentDb();
  const record = candidate.payload;
  switch (candidate.collection) {
    case "people":
      if (candidate.deleted || !record) await db.people.delete(candidate.recordId);
      else await db.people.put(record as never);
      break;
    case "categories":
      if (candidate.deleted || !record) await db.categories.delete(candidate.recordId);
      else await db.categories.put(record as never);
      break;
    case "transactions":
      if (candidate.deleted || !record) await db.transactions.delete(candidate.recordId);
      else await db.transactions.put(record as never);
      break;
    case "chittis":
      if (candidate.deleted || !record) await db.chittis.delete(candidate.recordId);
      else await db.chittis.put(record as never);
      break;
    case "chittiPayments":
      if (candidate.deleted || !record) await db.chittiPayments.delete(candidate.recordId);
      else await db.chittiPayments.put(record as never);
      break;
  }
}

async function writeBatch(candidates: SyncCandidate[]): Promise<CloudRecord[]> {
  if (candidates.length === 0) return [];
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured for this app.");
  const { data, error } = await client.rpc("ledge_sync_write_batch", {
    p_changes: candidates.map((candidate) => ({
      collection: candidate.collection,
      record_id: candidate.recordId,
      payload: candidate.payload ?? { id: candidate.recordId, updatedAt: candidate.changedAt },
      client_updated_at: candidate.changedAt,
      deleted: candidate.deleted,
    })),
  });
  if (error) throw error;
  return (data ?? []) as CloudRecord[];
}

async function removeOutboxEntry(entry: SyncOutboxEntry) {
  const table = currentDb().syncOutbox;
  const current = await table.get([entry.ownerId, entry.collection, entry.recordId]);
  if (current && current.changedAt <= entry.changedAt) {
    await table.delete([entry.ownerId, entry.collection, entry.recordId]);
  }
}

async function reconcileAccount(userId: string) {
  const [local, outbox, remote] = await Promise.all([
    readLocalRecords(),
    readOutbox(userId),
    readRemoteRecords(userId),
  ]);
  const chosen = chooseCandidates(userId, local, outbox, remote);
  const remoteByKey = new Map(remote.map((row) => [makeKey(row.collection, row.record_id), row]));
  const pendingWrites: SyncCandidate[] = [];
  const localApplications: SyncCandidate[] = [];
  const clearOutbox: SyncCandidate[] = [];

  for (const candidate of chosen.values()) {
    const server = remoteByKey.get(makeKey(candidate.collection, candidate.recordId));
    if (candidate.source === "remote") {
      localApplications.push(candidate);
      clearOutbox.push(candidate);
    } else if (!server || candidate.changedAt >= Number(server.client_updated_at || 0)) {
      pendingWrites.push(candidate);
    } else {
      localApplications.push(remoteCandidate(server));
      clearOutbox.push(remoteCandidate(server));
    }
  }

  for (const candidate of localApplications) await applyLocalCandidate(candidate);

  const written = await writeBatch(pendingWrites);
  for (const row of written) {
    const candidate = remoteCandidate(row);
    const localCandidate = pendingWrites.find(
      (item) => item.collection === row.collection && item.recordId === row.record_id,
    );
    if (!localCandidate || candidate.changedAt > localCandidate.changedAt) {
      await applyLocalCandidate(candidate);
    }
    clearOutbox.push(localCandidate ?? candidate);
  }

  for (const candidate of clearOutbox) {
    const entry = outbox.find(
      (item) => item.collection === candidate.collection && item.recordId === candidate.recordId,
    );
    if (entry) await removeOutboxEntry({ ...entry, changedAt: candidate.changedAt });
  }

  setState({ status: "synced", message: "All changes are synced", lastSyncedAt: Date.now() });
}

export async function queueCloudUpsert(
  collection: LedgeCollection,
  record: Record<string, unknown>,
) {
  if (!connectedUserId || typeof record.id !== "string") return;
  const db = currentDb();
  const previous = await db.syncOutbox.get([connectedUserId, collection, record.id]);
  await db.syncOutbox.put({
    ownerId: connectedUserId,
    collection,
    recordId: record.id,
    operation: "upsert",
    payload: record,
    changedAt: Math.max(Date.now(), recordTimestamp(record), (previous?.changedAt ?? 0) + 1),
  });
  void flushCloudOutbox().catch((error) => reportSyncError(error));
}

export async function queueCloudDelete(
  collection: LedgeCollection,
  recordId: string,
  changedAt = Date.now(),
) {
  if (!connectedUserId) return;
  const db = currentDb();
  const previous = await db.syncOutbox.get([connectedUserId, collection, recordId]);
  await db.syncOutbox.put({
    ownerId: connectedUserId,
    collection,
    recordId,
    operation: "delete",
    payload: null,
    changedAt: Math.max(Date.now(), changedAt, (previous?.changedAt ?? 0) + 1),
  });
  void flushCloudOutbox().catch((error) => reportSyncError(error));
}

function reportSyncError(error: unknown) {
  const message = error instanceof Error ? error.message : "Cloud sync failed.";
  setState({
    status: navigator.onLine ? "error" : "offline",
    message,
    lastSyncedAt: state.lastSyncedAt,
  });
}

export async function flushCloudOutbox() {
  if (!connectedUserId || !navigator.onLine) {
    if (connectedUserId) {
      setState({
        status: "offline",
        message: "Changes are saved on this device and will sync when online",
        lastSyncedAt: state.lastSyncedAt,
      });
    }
    return;
  }
  if (flushPromise) return flushPromise;

  const userId = connectedUserId;
  flushPromise = (async () => {
    const db = currentDb();
    while (connectedUserId === userId) {
      const entries = (await db.syncOutbox.where("ownerId").equals(userId).toArray()).slice(0, 100);
      if (entries.length === 0) break;
      setState({
        status: "connecting",
        message: "Syncing changes…",
        lastSyncedAt: state.lastSyncedAt,
      });
      const rows = await writeBatch(entries.map(outboxCandidate));
      for (const row of rows) {
        const candidate = remoteCandidate(row);
        const pending = entries.find(
          (entry) => entry.collection === row.collection && entry.recordId === row.record_id,
        );
        if (pending && candidate.changedAt > pending.changedAt) {
          await applyLocalCandidate(candidate);
        }
        if (pending) await removeOutboxEntry(pending);
      }
    }
    if (connectedUserId === userId) {
      setState({ status: "synced", message: "All changes are synced", lastSyncedAt: Date.now() });
    }
  })().finally(() => {
    flushPromise = null;
  });
  return flushPromise;
}

function applyRealtimeRow(row: CloudRecord, onRemoteChange: () => void) {
  if (row.owner_id !== connectedUserId || !LEDGE_COLLECTIONS.includes(row.collection)) return;
  void (async () => {
    const db = currentDb();
    const key = [row.owner_id, row.collection, row.record_id] as [string, LedgeCollection, string];
    const [outbox, local] = await Promise.all([
      db.syncOutbox.get(key),
      (
        db[row.collection] as unknown as {
          get(id: string): Promise<Record<string, unknown> | undefined>;
        }
      ).get(row.record_id),
    ]);
    const remote = remoteCandidate(row);
    const localTimestamp = local ? recordTimestamp(local) : 0;
    const pendingTimestamp = outbox?.changedAt ?? 0;
    if (Math.max(localTimestamp, pendingTimestamp) > remote.changedAt) return;
    await applyLocalCandidate(remote);
    if (outbox && outbox.changedAt <= remote.changedAt) await removeOutboxEntry(outbox);
    onRemoteChange();
    setState({ status: "synced", message: "All changes are synced", lastSyncedAt: Date.now() });
  })().catch(reportSyncError);
}

export async function connectCloudSync(userId: string, onRemoteChange: () => void) {
  activeDisposer?.();
  connectedUserId = userId;
  setActiveDatabaseUser(userId);
  setState({ status: "connecting", message: "Connecting to your Ledge data…", lastSyncedAt: null });

  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured for this app.");

  let disposed = false;
  let bootstrapping = true;
  const pendingRows: CloudRecord[] = [];
  let channel: RealtimeChannel | null = null;
  const onOnline = () => void syncNow();
  const onVisibility = () => {
    if (document.visibilityState === "visible") void syncNow();
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisibility);
    if (channel) void client.removeChannel(channel);
    if (activeChannel === channel) activeChannel = null;
    if (connectedUserId === userId) connectedUserId = null;
    if (activeDisposer === dispose) activeDisposer = null;
    setActiveDatabaseUser(null);
  };
  activeDisposer = dispose;

  const startRealtime = () => {
    if (disposed || channel) return;
    channel = client
      .channel(`ledge-records-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ledge_records", filter: `owner_id=eq.${userId}` },
        (event) => {
          const row = (event.new ?? event.old) as CloudRecord | undefined;
          if (!row?.collection || !row.record_id) return;
          if (bootstrapping) pendingRows.push(row);
          else applyRealtimeRow(row, onRemoteChange);
        },
      )
      .subscribe((status, error) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          setState({
            status: "synced",
            message: "Realtime sync connected",
            lastSyncedAt: state.lastSyncedAt,
          });
          void flushCloudOutbox().catch(reportSyncError);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          reportSyncError(error ?? new Error("Realtime connection failed."));
        } else if (status === "CLOSED") {
          setState({
            status: "offline",
            message: "Realtime connection closed",
            lastSyncedAt: state.lastSyncedAt,
          });
        }
      });
    activeChannel = channel;
  };

  const syncNow = async () => {
    if (disposed || connectedUserId !== userId) return;
    bootstrapping = true;
    try {
      await reconcileAccount(userId);
      bootstrapping = false;
      while (pendingRows.length) {
        const row = pendingRows.shift();
        if (row) applyRealtimeRow(row, onRemoteChange);
      }
      await flushCloudOutbox();
    } catch (error) {
      bootstrapping = false;
      reportSyncError(error);
    }
  };

  try {
    await migrateLegacyLocalDatabase(userId);
    if (disposed) return dispose;
    startRealtime();
    await syncNow();
  } catch (error) {
    reportSyncError(error);
  }
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisibility);
  if (disposed) {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisibility);
  }
  return dispose;
}
