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
        enhancedApiUrl: 'https://esp32-ventilation-api.azurewebsites.net/api/GetEnhancedDashboardData',
        doorAnalyticsApiUrl: 'https://esp32-ventilation-api.azurewebsites.net/api/GetEnhancedDoorAnalytics',
        snapshotApiUrl: 'https://esp32-ventilation-api.azurewebsites.net/api/GetDashboardSnapshot',
        historyApiUrl: 'https://esp32-ventilation-api.azurewebsites.net/api/GetVentilationHistory'
    };
};

export class DataManager {
    constructor() {
        this.cache = {
            statusData: { data: null, timestamp: null, ttl: 30000 }, // 30s TTL
            historyData: new Map(), // Keyed by hours parameter
            enhancedData: { data: null, timestamp: null, ttl: 30000 }, // 30s TTL
            snapshotData: { data: null, timestamp: null, ttl: 30000 } // 30s TTL
        };
        
        this.subscribers = {
            status: [],
            history: [],
            enhanced: [],
            snapshot: []
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
        
        console.log('DataManager: Fetching fresh status data via snapshot');
        // Use snapshot instead of direct call
        const snapshot = await this.getDashboardSnapshot(forceRefresh, 24);
        const data = snapshot.status;
        
        if (!data) throw new Error('Status data missing from snapshot');
        
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
        
        console.log(`DataManager: Fetching fresh history data for ${hours}h via snapshot`);
        // Use snapshot instead of direct call
        const snapshot = await this.getDashboardSnapshot(forceRefresh, hours);
        const data = snapshot.history;
        
        if (!data) throw new Error('History data missing from snapshot');
        
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

    // Get Dashboard Snapshot (Consolidated Data)
    async getDashboardSnapshot(forceRefresh = false, hours = 24) {
        const cache = this.cache.snapshotData;
        const useCache = (hours === 24); // Only cache the default 24h snapshot in the main slot
        
        if (useCache && !forceRefresh && cache.data && Date.now() - cache.timestamp < cache.ttl) {
            console.log('DataManager: Using cached snapshot data');
            return cache.data;
        }

        // Try to fetch from history API if requesting > 24 hours
        if (hours > 24) {
            try {
                console.log(`DataManager: Attempting to fetch long-term history (${hours}h) from GetVentilationHistory`);
                const historyUrl = this.config.historyApiUrl || 'https://esp32-ventilation-api.azurewebsites.net/api/GetVentilationHistory';
                const endpoint = `${historyUrl}?deviceId=ESP32-Ventilation-01&hours=${hours}`;
                
                // Use the dashboard's authentication system
                const headers = DashboardUtils.getAuthHeaders();
                
                const response = await fetch(endpoint, { headers });
                
                if (response.ok) {
                    const historyData = await response.json();
                    if (historyData.data && Array.isArray(historyData.data)) {
                        console.log(`DataManager: Successfully fetched ${historyData.data.length} items from GetVentilationHistory`);
                        
                        // Construct a snapshot-like object
                        const snapshot = {
                            ...historyData,
                            history: historyData.data, // Map 'data' to 'history'
                            fromHistoryApi: true
                        };
                        
                        // We don't cache long-term history in the snapshot slot
                        return snapshot;
                    }
                } else {
                    console.warn(`DataManager: GetVentilationHistory returned ${response.status}`);
                }
            } catch (e) {
                console.warn('DataManager: Failed to fetch from GetVentilationHistory, falling back to snapshot', e);
            }
        }
        
        console.log(`DataManager: Fetching fresh dashboard snapshot (hours=${hours})`);
        // Use default deviceId and hours if not specified in config (though config usually has URLs only)
        // We append params to the URL
        const endpoint = `${this.config.snapshotApiUrl}?deviceId=ESP32-Ventilation-01&hours=${hours}`;
        
        const data = await this._deduplicatedFetch(endpoint, `snapshot-${hours}`);
        
        // DEBUG: Log the size of the history data received
        if (data && data.history) {
            const historyLen = Array.isArray(data.history) ? data.history.length : 'not-array';
            console.log(`DataManager: DEBUG - Received snapshot for hours=${hours}. History length: ${historyLen}`);
            if (Array.isArray(data.history) && data.history.length > 0) {
                const first = data.history[0];
                const last = data.history[data.history.length - 1];
                const firstTime = first.timestamp ? new Date(first.timestamp * 1000).toLocaleString() : 'N/A';
                const lastTime = last.timestamp ? new Date(last.timestamp * 1000).toLocaleString() : 'N/A';
                console.log(`DataManager: DEBUG - History range: ${firstTime} to ${lastTime}`);
            }
        } else {
            console.log(`DataManager: DEBUG - No history data in snapshot for hours=${hours}`);
        }
        
        if (useCache) {
            cache.data = data;
            cache.timestamp = Date.now();
            this._notifySubscribers('snapshot', data);
        }
        
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

        // Use the dashboard's authentication system
        const headers = DashboardUtils.getAuthHeaders();
        
        const request = fetch(endpoint, {
            method: 'GET',
            headers: headers
        }).then(response => {
            // Check for authentication failures
            if (response.status === 401 || response.status === 403) {
                console.error(`DataManager: Authentication failed (${response.status}) - redirecting to login`);
                // Clear auth data
                if (typeof localStorage !== 'undefined') {
                    localStorage.removeItem('esp32-auth-token');
                    localStorage.removeItem('esp32-auth-email');
                }
                // Redirect to login page
                window.location.href = 'login.html';
                throw new Error('Authentication expired - redirecting to login');
            }
            
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
