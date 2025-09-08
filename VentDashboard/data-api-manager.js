// Data Manager Module
// Centralized API calls with intelligent caching and subscription system

// Import CONFIG from dashboard.js
// Note: This assumes CONFIG is available globally or passed to DataManager
const getApiConfig = () => {
    if (typeof CONFIG !== 'undefined') {
        return CONFIG;
    }
    // Fallback configuration
    return {
        statusApiUrl: 'https://esp32-ventilation-api.azurewebsites.net/api/GetVentilationStatus',
        historyApiUrl: 'https://esp32-ventilation-api.azurewebsites.net/api/GetVentilationHistory',
        enhancedApiUrl: 'https://esp32-ventilation-api.azurewebsites.net/api/GetEnhancedDashboardData',
        doorAnalyticsApiUrl: 'https://esp32-ventilation-api.azurewebsites.net/api/GetEnhancedDoorAnalytics'
    };
};

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
        this.config = getApiConfig();
    }

    // Single source API calls with intelligent caching
    async getStatusData(forceRefresh = false) {
        const cache = this.cache.statusData;
        
        if (!forceRefresh && cache.data && Date.now() - cache.timestamp < cache.ttl) {
            console.log('DataManager: Using cached status data');
            return cache.data;
        }
        
        console.log('DataManager: Fetching fresh status data');
        const data = await this._deduplicatedFetch(this.config.statusApiUrl, 'status');
        
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
        const data = await this._deduplicatedFetch(`${this.config.historyApiUrl}?hours=${hours}`, `history-${hours}`);
        
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
        const data = await this._deduplicatedFetch(this.config.enhancedApiUrl, 'enhanced');
        
        cache.data = data;
        cache.timestamp = Date.now();
        
        this._notifySubscribers('enhanced', data);
        return data;
    }

    // Get door analytics data for CSV export
    async getDoorAnalyticsData(timeRange = '24h', analysis = 'raw-transitions') {
        console.log(`DataManager: Fetching door analytics data for ${timeRange}`);
        const endpoint = `${this.config.doorAnalyticsApiUrl}?timeRange=${timeRange}&analysis=${analysis}&deviceId=ESP32-Ventilation-01`;
        
        try {
            const data = await this._deduplicatedFetch(endpoint, `door-analytics-${timeRange}-${analysis}`);
            console.log(`DataManager: Door analytics data received - ${data.totalTransitions || 0} transitions`);
            return data;
        } catch (error) {
            console.error('DataManager: Error fetching door analytics data:', error);
            throw error;
        }
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

        // Use the dashboard's authentication system
        const headers = DashboardUtils.getAuthHeaders();
        
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
