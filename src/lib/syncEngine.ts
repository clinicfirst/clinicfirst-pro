import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import { getStoredToken } from '../api';

interface SyncSchema extends DBSchema {
  apiMutations: {
    key: string;
    value: {
      id: string;
      endpoint: string;
      method: string;
      payload: any;
      timestamp: number;
      status: 'pending' | 'syncing' | 'failed';
      retryCount: number;
      error?: string;
    };
    indexes: {
      'by-status': string;
      'by-timestamp': number;
    };
  };
  localCache: {
    key: string;
    value: {
      cacheKey: string;
      data: any;
      updatedAt: number;
    };
  };
}

class SyncEngine {
  private dbPromise: Promise<IDBPDatabase<SyncSchema>>;
  public isOnline: boolean = navigator.onLine;
  private syncInterval: any = null;

  constructor() {
    this.dbPromise = openDB<SyncSchema>('clinicfirst-sync-db', 2, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (oldVersion < 2) {
          if (db.objectStoreNames.contains('mutations')) db.deleteObjectStore('mutations');
        }
        if (!db.objectStoreNames.contains('apiMutations')) {
          const store = db.createObjectStore('apiMutations', { keyPath: 'id' });
          store.createIndex('by-status', 'status');
          store.createIndex('by-timestamp', 'timestamp');
        }
        if (!db.objectStoreNames.contains('localCache')) {
          db.createObjectStore('localCache', { keyPath: 'cacheKey' });
        }
      },
    });

    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    this.startSyncLoop();
    this.setupRealtimeSubscriptions();
  }

  private handleOnline() {
    this.isOnline = true;
    console.log('[SyncEngine] Network online. Triggering sync...');
    this.syncPendingMutations();
  }

  private handleOffline() {
    this.isOnline = false;
    console.log('[SyncEngine] Network offline. Mutations will be queued.');
  }

  private startSyncLoop() {
    this.syncInterval = setInterval(() => {
      if (this.isOnline) {
        this.syncPendingMutations();
      }
    }, 15000);
  }

  private setupRealtimeSubscriptions() {
    // Listen to changes on ALL tables to invalidate caches in real-time
    supabase.channel('custom-all-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          console.log('[SyncEngine] Real-time Supabase update received:', payload);
          // Dispatch event so UI can refresh
          window.dispatchEvent(new CustomEvent('supabase-realtime-update', { detail: payload }));
        }
      )
      .subscribe();
  }

  async queueApiMutation(endpoint: string, method: string, payload: any) {
    const db = await this.dbPromise;
    const mutation = {
      id: uuidv4(),
      endpoint,
      method,
      payload,
      timestamp: Date.now(),
      status: 'pending' as const,
      retryCount: 0,
    };
    await db.put('apiMutations', mutation);
    
    if (this.isOnline) {
      this.syncPendingMutations();
    }
    return mutation.id;
  }

  async syncPendingMutations() {
    if (!this.isOnline) return;
    const db = await this.dbPromise;
    const tx = db.transaction('apiMutations', 'readwrite');
    const store = tx.objectStore('apiMutations');
    const index = store.index('by-status');
    const pending = await index.getAll('pending');
    
    pending.sort((a, b) => a.timestamp - b.timestamp);

    for (const mutation of pending) {
      try {
        mutation.status = 'syncing';
        await store.put(mutation);

        const token = getStoredToken();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(mutation.endpoint, {
          method: mutation.method,
          headers,
          body: mutation.payload ? JSON.stringify(mutation.payload) : undefined,
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `Request failed with status ${response.status}`);
        }

        await store.delete(mutation.id);
        console.log(`[SyncEngine] Synced API mutation ${mutation.id}`);
      } catch (err: any) {
        console.error(`[SyncEngine] Failed to sync mutation ${mutation.id}:`, err);
        mutation.status = 'pending';
        mutation.retryCount += 1;
        mutation.error = err.message || String(err);
        await store.put(mutation);
      }
    }
    await tx.done;
  }

  async setLocalCache(cacheKey: string, data: any) {
    const db = await this.dbPromise;
    await db.put('localCache', {
      cacheKey,
      data,
      updatedAt: Date.now()
    });
  }

  async getLocalCache(cacheKey: string) {
    const db = await this.dbPromise;
    const result = await db.get('localCache', cacheKey);
    return result ? result.data : null;
  }
}

export const syncEngine = new SyncEngine();
