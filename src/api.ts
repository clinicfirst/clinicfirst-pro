import { syncEngine } from './lib/syncEngine';

const TOKEN_KEY = 'clinicfirst_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const method = options.method || 'GET';
  const isOnline = syncEngine.isOnline;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Offline Read (GET)
  if (!isOnline && method === 'GET') {
    const cached = await syncEngine.getLocalCache(endpoint);
    if (cached) {
      console.log(`[Offline-First] Serving from local DB cache: ${endpoint}`);
      return cached as T;
    }
    throw new Error('You are offline and no cached data is available for this request.');
  }

  // Offline Write (Mutation)
  if (!isOnline && ['POST', 'PUT', 'DELETE'].includes(method)) {
    console.log(`[Offline-First] Queuing mutation for sync: ${method} ${endpoint}`);
    
    // Parse body if it exists
    let parsedBody = null;
    if (options.body && typeof options.body === 'string') {
       try { parsedBody = JSON.parse(options.body); } catch(e) {}
    }
    
    await syncEngine.queueApiMutation(endpoint, method, parsedBody);
    
    // Return a mock success response so UI can proceed optimistically
    return { success: true, offline: true, _optimistic: true } as unknown as T;
  }

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }

    // Update offline cache for GET requests
    if (method === 'GET') {
      await syncEngine.setLocalCache(endpoint, data);
    }

    return data as T;
  } catch (error) {
    // Fallback if fetch fails (e.g. network dropped just now)
    if (method === 'GET') {
      const cached = await syncEngine.getLocalCache(endpoint);
      if (cached) {
        console.log(`[Offline-First Fallback] Served from cache: ${endpoint}`);
        return cached as T;
      }
    }
    throw error;
  }
}
