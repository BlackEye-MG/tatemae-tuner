
/**
 * Smart Caching Service
 * Uses chrome.storage.local to cache AI responses.
 * Goals: Reduce API costs and enable instant mode switching.
 */

interface CacheEntry {
    value: string;
    timestamp: number;
}

// interface CacheStorage removed as it was unused

const CACHE_PREFIX = 'ai_cache_';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours

/**
 * Generates a consistent cache key based on input parameters.
 * Normalizes input by trimming whitespace.
 */
export const generateCacheKey = (input: string, mode: string, model: string): string => {
    // We trim whitespace but preserve case/punctuation as they affect tone
    const normalizedInput = input.trim();
    // Create a unique key
    return `${CACHE_PREFIX}${mode}_${model}_${btoa(encodeURIComponent(normalizedInput))}`;
};

/**
 * Retrieves a cached response if it exists and hasn't expired.
 */
export const getCachedResponse = async (key: string): Promise<string | null> => {
    try {
        if (typeof chrome === 'undefined' || !chrome.storage) return null;

        const result = await chrome.storage.local.get(key);
        const entry = result[key] as CacheEntry | undefined;

        if (!entry) return null;

        // Check TTL
        if (Date.now() - entry.timestamp > TTL_MS) {
            // Expired, clean it up asynchronously
            chrome.storage.local.remove(key);
            return null;
        }

        return entry.value;
    } catch (error) {
        console.warn('Cache retrieval failed:', error);
        return null;
    }
};

/**
 * Stores a response in the cache with the current timestamp.
 */
export const setCachedResponse = async (key: string, value: string): Promise<void> => {
    try {
        if (typeof chrome === 'undefined' || !chrome.storage) return;

        const entry: CacheEntry = {
            value,
            timestamp: Date.now()
        };

        await chrome.storage.local.set({ [key]: entry });
    } catch (error) {
        console.warn('Cache storage failed:', error);
    }
};

/**
 * Optional: Prune all expired or old cache entries.
 * Can be called on startup or periodically.
 */
export const pruneCache = async (): Promise<void> => {
    try {
        if (typeof chrome === 'undefined' || !chrome.storage) return;

        const allData = await chrome.storage.local.get(null);
        const keysToRemove: string[] = [];
        const now = Date.now();

        for (const [key, value] of Object.entries(allData)) {
            if (key.startsWith(CACHE_PREFIX)) {
                const entry = value as CacheEntry;
                if (now - entry.timestamp > TTL_MS) {
                    keysToRemove.push(key);
                }
            }
        }

        if (keysToRemove.length > 0) {
            await chrome.storage.local.remove(keysToRemove);
            console.log(`Pruned ${keysToRemove.length} expired cache entries.`);
        }
    } catch (error) {
        console.error('Cache pruning failed:', error);
    }
};

/**
 * Clears all AI cache entries regardless of expiration.
 */
export const clearAllCache = async (): Promise<void> => {
    try {
        if (typeof chrome === 'undefined' || !chrome.storage) return;

        const allData = await chrome.storage.local.get(null);
        const keysToRemove: string[] = Object.keys(allData).filter(key => key.startsWith(CACHE_PREFIX));

        if (keysToRemove.length > 0) {
            await chrome.storage.local.remove(keysToRemove);
            console.log(`Cleared ${keysToRemove.length} cache entries.`);
        }
    } catch (error) {
        console.error('Cache clearing failed:', error);
    }
};
