// utils/functionCache.ts
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

interface CacheItem<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
}

interface FunctionCacheDB extends DBSchema {
  "cached-functions": {
    key: string;
    value: CacheItem<any>;
  };
}

class FunctionCache {
  private db: Promise<IDBPDatabase<FunctionCacheDB>>;

  constructor() {
    this.db = openDB<FunctionCacheDB>("function-cache", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("cached-functions")) {
          db.createObjectStore("cached-functions", { keyPath: "key" });
        }
      },
    });
  }

  private isExpired(timestamp: number, ttl: number): boolean {
    return Date.now() - timestamp > ttl;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const db = await this.db;
      const item = await db.get("cached-functions", key);

      if (!item) {
        return null; // não existe no cache
      }

      if (this.isExpired(item.timestamp, item.ttl)) {
        await db.delete("cached-functions", key);
        return null; // expirou, foi removido
      }

      return item.value as T;
    } catch (error) {
      console.warn("Erro ao buscar cache:", error);
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    ttlMs: number = 2 * 30 * 24 * 60 * 60 * 1000,
  ): Promise<void> {
    try {
      const db = await this.db;
      await db.put("cached-functions", {
        key,
        value,
        timestamp: Date.now(),
        ttl: ttlMs,
      });
    } catch (error) {
      console.warn("Erro ao salvar cache:", error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const db = await this.db;
      await db.delete("cached-functions", key);
    } catch (error) {
      console.warn("Erro ao deletar cache:", error);
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.db;
      await db.clear("cached-functions");
    } catch (error) {
      console.warn("Erro ao limpar cache:", error);
    }
  }

  async size(): Promise<number> {
    try {
      const db = await this.db;
      return await db.count("cached-functions");
    } catch (error) {
      console.warn("Erro ao contar cache:", error);
      return 0;
    }
  }
}

const functionCache = new FunctionCache();

// Função principal que você vai usar
export async function getCache<T>(key: string): Promise<T | null> {
  return await functionCache.get<T>(key);
}

// Função para salvar no cache
export async function setCache<T>(
  key: string,
  value: T,
  ttlDias: number = 2 * 30, // 2 meses por padrão
): Promise<void> {
  const ttlMs = ttlDias * 24 * 60 * 60 * 1000;
  await functionCache.set(key, value, ttlMs);
}

// Utilitários extras
export const cacheUtils = {
  delete: (key: string) => functionCache.delete(key),
  clear: () => functionCache.clear(),
  size: () => functionCache.size(),
};
