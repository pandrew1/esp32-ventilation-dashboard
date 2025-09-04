// Data Manager Module
// Centralized API calls with intelligent caching and subscription system

export class DataManager {
    constructor() {
        this.cache = {
            statusData: { data: null, timestamp: null, ttl: 30000 }, // 30s TTL
            historyData: new Map(), // Keyed by hours parameter
            enhancedData: { data: null, timestamp: null, ttl: 30000 } // 30s TTL
        };
        
        this.subscribers = {
            status: [],
            history: [],
            enhanced: []
        };
        
        this.activeRequests = new Map();
    }

    // Single source API calls with intelligent caching
    async getStatusData(forceRefresh = false) {
        const cache = this.cache.statusData;
        
        if (!forceRefresh && cache.data && Date.now() - cache.timestamp < cache.ttl) {
            console.log('DataManager: Using cached status data');
            return cache.data;
        }
        
        console.log('DataManager: Fetching fresh status data');
        const data = await this._deduplicatedFetch('/api/GetVentilationStatus', 'status');
        
        cache.data = data;
        cache.timestamp = Date.now();
        
        this._notifySubscribers('status', data);
        return data;
    }

    async getHistoryData(hours = 24, forceRefresh = false) {
        const cacheKey = `${hours}h`;
        const cached = this.cache.historyData.get(cacheKey);
        
        if (!forceRefresh && cached && Date.now() - cached.timestamp < 45000) { // 45s TTL
            console.log(`DataManager: Using cached history data for ${hours}h`);
            return cached.data;
        }
        
        console.log(`DataManager: Fetching fresh history data for ${hours}h`);
        const data = await this._deduplicatedFetch(`/api/GetVentilationHistory?hours=${hours}`, `history-${hours}`);
        
        this.cache.historyData.set(cacheKey, {
            data,
            timestamp: Date.now()
        });
        
        this._notifySubscribers('history', { hours, data });
        return data;
    }

    async getEnhancedData(forceRefresh = false) {
        const cache = this.cache.enhancedData;
        
        if (!forceRefresh && cache.data && Date.now() - cache.timestamp < cache.ttl) {
            console.log('DataManager: Using cached enhanced data');
            return cache.data;
        }
        
        console.log('DataManager: Fetching fresh enhanced data');
        const data = await this._deduplicatedFetch('/api/GetEnhancedDashboardData', 'enhanced');
        
        cache.data = data;
        cache.timestamp = Date.now();
        
        this._notifySubscribers('enhanced', data);
        return data;
    }

    // Subscription system for data updates
    subscribe(dataType, callback) {
        if (this.subscribers[dataType]) {
            this.subscribers[dataType].push(callback);
        }
    }

    unsubscribe(dataType, callback) {
        if (this.subscribers[dataType]) {
            const index = this.subscribers[dataType].indexOf(callback);
            if (index > -1) {
                this.subscribers[dataType].splice(index, 1);
            }
        }
    }

    // Request deduplication to prevent multiple simultaneous calls
    async _deduplicatedFetch(endpoint, requestKey) {
        if (this.activeRequests.has(requestKey)) {
            console.log(`DataManager: Deduplicating request for ${requestKey}`);
            return this.activeRequests.get(requestKey);
        }

        // Use global getAuthHeaders function from main dashboard
        const headers = getAuthHeaders();
        
        const request = fetch(endpoint, {
            method: 'GET',
            headers: headers
        }).then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        });
        
        this.activeRequests.set(requestKey, request);
        
        try {
            const result = await request;
            console.log(`DataManager: ${endpoint} fetched and cached successfully`);
            return result;
        } catch (error) {
            console.error(`DataManager: Error fetching ${endpoint}:`, error);
            throw error;
        } finally {
            this.activeRequests.delete(requestKey);
        }
    }

    _notifySubscribers(dataType, data) {
        this.subscribers[dataType].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`DataManager: Error in ${dataType} subscriber:`, error);
            }
        });
    }

    // Clear all cached data
    clearCache() {
        this.cache.statusData = { data: null, timestamp: null, ttl: 30000 };
        this.cache.historyData.clear();
        this.cache.enhancedData = { data: null, timestamp: null, ttl: 30000 };
        console.log('DataManager: Cache cleared');
    }
}

// Create singleton instance
export const dataManager = new DataManager();
