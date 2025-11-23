// lib/db-browser.ts
// Browser-based database using IndexedDB (no Cloudflare needed)

const DB_NAME = "x402_guard_db";
const DB_VERSION = 1;

// Initialize IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains("users")) {
        const usersStore = db.createObjectStore("users", { keyPath: "id", autoIncrement: true });
        usersStore.createIndex("privy_id", "privy_id", { unique: true });
        usersStore.createIndex("wallet_address", "wallet_address", { unique: false });
      }

      if (!db.objectStoreNames.contains("guards")) {
        const guardsStore = db.createObjectStore("guards", { keyPath: "id", autoIncrement: true });
        guardsStore.createIndex("user_id", "user_id", { unique: false });
        guardsStore.createIndex("guard_address", "guard_address", { unique: true });
      }

      if (!db.objectStoreNames.contains("transactions")) {
        const txStore = db.createObjectStore("transactions", { keyPath: "id", autoIncrement: true });
        txStore.createIndex("guard_id", "guard_id", { unique: false });
      }

      if (!db.objectStoreNames.contains("endpoints")) {
        const endpointsStore = db.createObjectStore("endpoints", { keyPath: "id", autoIncrement: true });
        endpointsStore.createIndex("guard_id", "guard_id", { unique: false });
      }
    };
  });
}

// Helper to get store
async function getStore(storeName: string, mode: IDBTransactionMode = "readonly") {
  const db = await openDB();
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

// ===== USER OPERATIONS =====

export interface User {
  id?: number;
  privy_id: string;
  wallet_address: string;
  created_at?: string;
}

export async function getUser(privyId?: string, walletAddress?: string): Promise<User | null> {
  const store = await getStore("users");

  if (privyId) {
    const index = store.index("privy_id");
    return new Promise((resolve, reject) => {
      const request = index.get(privyId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  if (walletAddress) {
    const index = store.index("wallet_address");
    return new Promise((resolve, reject) => {
      const request = index.get(walletAddress.toLowerCase());
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  return null;
}

export async function createUser(privyId: string, walletAddress: string): Promise<User> {
  // Check if user exists
  const existing = await getUser(privyId);
  
  if (existing) {
    // Update wallet address
    const store = await getStore("users", "readwrite");
    const updated = { ...existing, wallet_address: walletAddress.toLowerCase() };
    
    return new Promise((resolve, reject) => {
      const request = store.put(updated);
      request.onsuccess = () => resolve(updated);
      request.onerror = () => reject(request.error);
    });
  }

  // Create new user
  const store = await getStore("users", "readwrite");
  const user: User = {
    privy_id: privyId,
    wallet_address: walletAddress.toLowerCase(),
    created_at: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const request = store.add(user);
    request.onsuccess = () => {
      resolve({ ...user, id: request.result as number });
    };
    request.onerror = () => reject(request.error);
  });
}

// ===== GUARD OPERATIONS =====

export interface Guard {
  id?: number;
  user_id: number;
  guard_address: string;
  name: string;
  daily_limit: string;
  per_transaction_limit: string;
  approval_threshold: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export async function getGuardByAddress(guardAddress: string): Promise<Guard | null> {
  const store = await getStore("guards");
  const index = store.index("guard_address");

  return new Promise((resolve, reject) => {
    const request = index.get(guardAddress.toLowerCase());
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getGuards(userId: number): Promise<Guard[]> {
  const store = await getStore("guards");
  const index = store.index("user_id");

  return new Promise((resolve, reject) => {
    const request = index.getAll(userId);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function createGuard(params: {
  userId: number;
  guardAddress: string;
  name: string;
  dailyLimit: string;
  perTransactionLimit: string;
  approvalThreshold: string;
}): Promise<Guard> {
  const store = await getStore("guards", "readwrite");
  const guard: Guard = {
    user_id: params.userId,
    guard_address: params.guardAddress.toLowerCase(),
    name: params.name,
    daily_limit: params.dailyLimit,
    per_transaction_limit: params.perTransactionLimit,
    approval_threshold: params.approvalThreshold,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const request = store.add(guard);
    request.onsuccess = () => {
      resolve({ ...guard, id: request.result as number });
    };
    request.onerror = () => reject(request.error);
  });
}

export async function updateGuard(params: {
  guardId: number;
  name?: string;
  dailyLimit?: string;
  perTransactionLimit?: string;
  approvalThreshold?: string;
  isActive?: boolean;
}): Promise<Guard> {
  const store = await getStore("guards", "readwrite");

  return new Promise(async (resolve, reject) => {
    const getRequest = store.get(params.guardId);
    getRequest.onsuccess = () => {
      const guard = getRequest.result;
      if (!guard) {
        reject(new Error("Guard not found"));
        return;
      }

      const updated: Guard = {
        ...guard,
        name: params.name ?? guard.name,
        daily_limit: params.dailyLimit ?? guard.daily_limit,
        per_transaction_limit: params.perTransactionLimit ?? guard.per_transaction_limit,
        approval_threshold: params.approvalThreshold ?? guard.approval_threshold,
        is_active: params.isActive ?? guard.is_active,
        updated_at: new Date().toISOString(),
      };

      const putRequest = store.put(updated);
      putRequest.onsuccess = () => resolve(updated);
      putRequest.onerror = () => reject(putRequest.error);
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

// ===== TRANSACTION OPERATIONS =====

export interface Transaction {
  id?: number;
  guard_id: number;
  tx_hash?: string;
  amount: string;
  recipient: string;
  endpoint_used?: string;
  status: "pending" | "success" | "failed";
  error_message?: string;
  created_at?: string;
}

export async function logTransaction(params: {
  guardId: number;
  txHash?: string;
  amount: string;
  recipient: string;
  endpointUsed?: string;
  status: "pending" | "success" | "failed";
  errorMessage?: string;
}): Promise<Transaction> {
  const store = await getStore("transactions", "readwrite");
  const tx: Transaction = {
    guard_id: params.guardId,
    tx_hash: params.txHash,
    amount: params.amount,
    recipient: params.recipient,
    endpoint_used: params.endpointUsed,
    status: params.status,
    error_message: params.errorMessage,
    created_at: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const request = store.add(tx);
    request.onsuccess = () => {
      resolve({ ...tx, id: request.result as number });
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getTransactions(guardId: number, limit: number = 50): Promise<Transaction[]> {
  const store = await getStore("transactions");
  const index = store.index("guard_id");

  return new Promise((resolve, reject) => {
    const request = index.getAll(guardId);
    request.onsuccess = () => {
      const results = request.result || [];
      // Sort by created_at descending and limit
      const sorted = results
        .sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
        })
        .slice(0, limit);
      resolve(sorted);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getDailySpend(guardId: number): Promise<{ total: number }> {
  const store = await getStore("transactions");
  const index = store.index("guard_id");

  return new Promise((resolve, reject) => {
    const request = index.getAll(guardId);
    request.onsuccess = () => {
      const transactions = request.result || [];
      const today = new Date().toISOString().split("T")[0];
      
      const dailyTotal = transactions
        .filter((tx: Transaction) => {
          const txDate = new Date(tx.created_at || 0).toISOString().split("T")[0];
          return tx.status === "success" && txDate === today;
        })
        .reduce((sum: number, tx: Transaction) => sum + parseFloat(tx.amount), 0);

      resolve({ total: dailyTotal });
    };
    request.onerror = () => reject(request.error);
  });
}

// ===== ENDPOINT OPERATIONS =====

export interface Endpoint {
  id?: number;
  guard_id: number;
  url: string;
  description?: string;
  created_at?: string;
}

export async function getEndpoints(guardId: number): Promise<Endpoint[]> {
  const store = await getStore("endpoints");
  const index = store.index("guard_id");

  return new Promise((resolve, reject) => {
    const request = index.getAll(guardId);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function addEndpoint(params: {
  guardId: number;
  url: string;
  description?: string;
}): Promise<Endpoint> {
  const store = await getStore("endpoints", "readwrite");
  const endpoint: Endpoint = {
    guard_id: params.guardId,
    url: params.url,
    description: params.description,
    created_at: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const request = store.add(endpoint);
    request.onsuccess = () => {
      resolve({ ...endpoint, id: request.result as number });
    };
    request.onerror = () => reject(request.error);
  });
}

export async function removeEndpoint(endpointId: number): Promise<{ success: boolean }> {
  const store = await getStore("endpoints", "readwrite");

  return new Promise((resolve, reject) => {
    const request = store.delete(endpointId);
    request.onsuccess = () => resolve({ success: true });
    request.onerror = () => reject(request.error);
  });
}