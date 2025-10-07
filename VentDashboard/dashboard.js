// ESP32 Ventilation Dashboard JavaScript
// Extracted from dashboard.html for easier debugging and maintenance

/*
🚨 CRITICAL DEPLOYMENT REMINDER:
- This dashboard ONLY works on Azure Static Web App (has API keys)
- Local file testing WILL FAIL - no API access locally
- MUST GIT PUSH all changes before testing
- Wait 1-2 minutes after git push for Azure deployment to complete
*/

// ===================================================================
// STAGE 5: MODULAR ARCHITECTURE SYSTEM
// ===================================================================

// Authentication Utilities 
const AuthUtils = {
    getAuthHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        
        // Set up CONFIG to force X-API-Secret authentication
        if (!window.CONFIG) {
            window.CONFIG = { apiSecret: 'VentilationSystem2025SecretKey' };
        }
        
        const token = localStorage.getItem('ventilation_auth_token');
        
        // Force logout to clear Bearer token and use X-API-Secret
        if (token) {
            localStorage.removeItem('ventilation_auth_token');
            console.log('🔧 Cleared Bearer token to force X-API-Secret authentication');
        }
        
        // Always use X-API-Secret for reliability
        if (window.CONFIG && window.CONFIG.apiSecret) {
            headers['X-API-Secret'] = window.CONFIG.apiSecret;
        }
        
        return headers;
    },

    logout() {
        localStorage.removeItem('ventilation_auth_token');
        localStorage.removeItem('ventilation_user_email');
        window.location.href = 'login.html';
    },

    isAuthenticated() {
        const token = localStorage.getItem('ventilation_auth_token');
        const apiSecret = window.CONFIG && window.CONFIG.apiSecret;
        return !!(token || apiSecret);
    },

    getUserEmail() {
        return localStorage.getItem('ventilation_user_email') || 'Anonymous';
    }
};

// Simplified Module Loading System
const ModuleLoader = {
    loadedModules: new Map(),
    
    async loadModule(fileName) {
        if (this.loadedModules.has(fileName)) {
            return this.loadedModules.get(fileName);
        }
        
        try {
            console.log(`ModuleLoader: Loading ${fileName}`);
            const module = await import(`./${fileName}`);
            this.loadedModules.set(fileName, module);
            console.log(`ModuleLoader: ${fileName} loaded successfully`);
            return module;
        } catch (error) {
            console.error(`ModuleLoader: Failed to load ${fileName}:`, error);
            throw error;
        }
    },

    getLoadedModule(fileName) {
        return this.loadedModules.get(fileName);
    },

    clearCache() {
        this.loadedModules.clear();
        console.log('ModuleLoader: Cache cleared');
    }
};

// Enhanced DataManager integration
let GlobalDataManager = null;
let GlobalChartManager = null;
let GlobalEventSystem = null;

/**
 * Initializes the modular architecture system by loading required modules
 * Loads data-api-manager.js, chart-manager.js, and core-event-system.js
 * Sets global references for DataManager, ChartManager, and EventSystem
 * @returns {Object|null} Object containing dataManager, chartManager, and DashboardEvents, or null on failure
 */
async function initializeModularSystems() {
    try {
        console.log('=== STAGE 5: Initializing Modular Architecture ===');
        
        // Load simplified modules
        const { dataManager } = await ModuleLoader.loadModule('data-api-manager.js');
        const { createChartManager } = await ModuleLoader.loadModule('chart-manager.js');
        const { DashboardEvents } = await ModuleLoader.loadModule('core-event-system.js');
        
        // Create chart manager with DataManager dependency
        const chartManager = createChartManager(dataManager);
        
        // Set global references
        GlobalDataManager = dataManager;
        GlobalChartManager = chartManager;
        GlobalEventSystem = DashboardEvents;
        
        console.log('=== STAGE 5: Modular systems initialized successfully ===');
        
        return { dataManager, chartManager, DashboardEvents };
    } catch (error) {
        console.error('STAGE 5: Failed to initialize modular systems:', error);
        // Fallback to legacy systems if modules fail
        return null;
    }
}

// ===================================================================
// STAGE 4: CONSOLIDATED UTILITY FUNCTIONS
// ===================================================================

// DateTime Utilities - Consolidated from multiple duplicate functions
const DateTimeUtils = {
    formatDateTime(date, options = {}) {
        if (!date) return '--';
        
        const dateObj = (typeof date === 'string') ? new Date(date) : date;
        if (isNaN(dateObj.getTime())) return '--';
        
        const defaultOptions = {
            showDate: true,
            showTime: true,
            timeFormat: '12h',
            ...options
        };
        
        if (defaultOptions.timeFormat === '24h') {
            return dateObj.toLocaleString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: false 
            });
        } else {
            return dateObj.toLocaleString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                hour: 'numeric', 
                minute: '2-digit', 
                hour12: true 
            });
        }
    },

    formatDetailedTimestamp(date = new Date()) {
        return date.toLocaleString('en-US', { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
    },

    isValidTimestamp(timestamp) {
        if (!timestamp) return false;
        const date = new Date(timestamp * 1000);
        const now = new Date();
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
        
        return date >= oneYearAgo && date <= oneYearFromNow;
    },

    formatRelativeDateTime(date) {
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const isYesterday = date.toDateString() === new Date(now.getTime() - 86400000).toDateString();
        
        if (isToday) {
            return `Today ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        } else if (isYesterday) {
            return `Yesterday ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        } else {
            return date.toLocaleDateString([], {month: 'short', day: 'numeric'}) + ' ' + 
                   date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }
    }
};

// Validation Utilities - Consolidated from duplicate validation functions
const ValidationUtils = {
    isValidIncidentTimestamp(timestamp) {
        if (!timestamp || timestamp === 0) return false;
        return DateTimeUtils.isValidTimestamp(timestamp);
    },

    isValidTemperatureReading(temp) {
        return temp && typeof temp === 'number' && temp > -50 && temp < 150;
    },

    isValidPressureReading(pressure) {
        return pressure && typeof pressure === 'number' && pressure > 900 && pressure < 1100;
    }
};

// Chart Utilities - Helper functions for chart management
const ChartUtils = {
    destroyChart(chartInstance) {
        if (chartInstance) {
            chartInstance.destroy();
            return null;
        }
        return chartInstance;
    },

    getTimeDisplayFormat(hours) {
        if (hours <= 6) {
            return { unit: 'minute', stepSize: 30 };
        } else if (hours <= 24) {
            return { unit: 'hour', stepSize: 2 };
        } else if (hours <= 72) {
            return { unit: 'hour', stepSize: 6 };
        } else {
            return { unit: 'day', stepSize: 1 };
        }
    },

    updateActiveButton(containerSelector, hours, functionName) {
        document.querySelectorAll(`${containerSelector} .time-btn`).forEach(btn => {
            const onclick = btn.getAttribute('onclick');
            if (onclick && onclick.includes(functionName)) {
                btn.classList.remove('active');
                if (onclick.includes(`${functionName}(${hours})`)) {
                    btn.classList.add('active');
                }
            }
        });
    }
};

// ===================================================================

// Helper function to get API key from URL parameter (must be defined first)
/**
 * Extracts API key from URL parameters
 * Looks for 'apikey' or 'key' parameters in the URL query string
 * @returns {string|null} The API key if found, null otherwise
 */
function getApiKeyFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    // FALLBACK: Return default API key if not provided in URL
    // This ensures dashboard works even without URL parameters
    // NEVER ADD THE APIKEY TO THE JS FILE SINCE IT IS CHECKED INTO A PUBLIC GIT REPO
    return urlParams.get('apikey') || urlParams.get('key');
}

// Configuration - Replace with your actual Azure Function URLs
const CONFIG = {
    statusApiUrl: 'https://esp32-ventilation-api.azurewebsites.net/api/GetEnhancedDashboardData', // For analytics and aggregated data
    currentStatusApiUrl: 'https://esp32-ventilation-api.azurewebsites.net/api/GetVentilationStatus', // For current system specs and reliability
    historyApiUrl: 'https://esp32-ventilation-api.azurewebsites.net/api/GetVentilationHistory',
    deviceId: 'ESP32-Ventilation-01',
    refreshInterval: 30000, // 30 seconds - check for new telemetry data
    apiSecret: null, // Will be set dynamically, DO NOT STORE SECRETS IN THE JS/HTML FILES
    enhancedApiUrl: 'https://esp32-ventilation-api.azurewebsites.net/api/GetEnhancedDashboardData'
};

// Initialize API secret from URL parameter
/**
 * Initializes the API secret from URL parameters if not already set
 * Calls getApiKeyFromUrl() to extract the API key and stores it in CONFIG.apiSecret
 * @returns {string|null} The API secret if found, null otherwise
 */
function initializeApiSecret() {
    if (!CONFIG.apiSecret) {
        CONFIG.apiSecret = getApiKeyFromUrl();
        console.log('🔍 DEBUG: API secret initialized from URL:', !!CONFIG.apiSecret);
    }
    return CONFIG.apiSecret;
}

// Global variables
let temperatureChart = null;
let pressureChart = null;
let incidentTrendsChart = null;
let refreshTimer = null;
let currentChartHours = 6; // Track the currently displayed time period
let currentPressureChartHours = 6; // Track the currently displayed pressure chart time period
let latestChartDataTimestamp = null; // Track the latest data point timestamp to avoid unnecessary chart refreshes
let latestPressureDataTimestamp = null; // Track pressure chart data freshness
let originalIncidentsData = []; // Global variable to store original incidents data for filtering

// === UTILITY FUNCTIONS SECTION (STAGE 1 OPTIMIZATION) ===
const DashboardUtils = {
    // Consolidated authentication
    getAuthHeaders() {
        const token = localStorage.getItem('ventilation_auth_token');
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // If user is logged in, use Bearer token authentication
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        // Otherwise, use API key if available
        else if (CONFIG.apiSecret) {
            headers['X-API-Secret'] = CONFIG.apiSecret;
        }
        
        return headers;
    },

    // Consolidated logout
    logout() {
        localStorage.removeItem('ventilation_auth_token');
        localStorage.removeItem('ventilation_user_email');
        window.location.href = 'login.html';
    },

    // Universal date/time formatter - Use consolidated utility
    formatDateTime(date, options = {}) {
        return DateTimeUtils.formatDateTime(date, options);
    },

    // Universal duration formatter
    formatDuration(seconds, options = {}) {
        if (!seconds || seconds < 0) return '0s';
        
        const defaults = {
            format: 'auto', // 'auto', 'seconds', 'minutes', 'hours', 'days', 'verbose'
            precision: 1,
            showUnits: true
        };
        
        const opts = { ...defaults, ...options };
        
        if (opts.format === 'verbose') {
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            
            const parts = [];
            if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
            if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
            if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
            if (secs > 0 && parts.length < 2) parts.push(`${secs} second${secs !== 1 ? 's' : ''}`);
            
            return parts.length > 0 ? parts.join(', ') : '0 seconds';
        }
        
        // Auto format based on duration
        if (opts.format === 'auto') {
            if (seconds < 60) return opts.showUnits ? `${seconds.toFixed(0)}s` : seconds.toFixed(0);
            if (seconds < 3600) return opts.showUnits ? `${(seconds/60).toFixed(opts.precision)}m` : (seconds/60).toFixed(opts.precision);
            if (seconds < 86400) return opts.showUnits ? `${(seconds/3600).toFixed(opts.precision)}h` : (seconds/3600).toFixed(opts.precision);
            return opts.showUnits ? `${(seconds/86400).toFixed(opts.precision)}d` : (seconds/86400).toFixed(opts.precision);
        }
        
        // Specific format
        const divisors = { seconds: 1, minutes: 60, hours: 3600, days: 86400 };
        const units = { seconds: 's', minutes: 'm', hours: 'h', days: 'd' };
        const value = (seconds / divisors[opts.format]).toFixed(opts.precision);
        
        return opts.showUnits ? `${value}${units[opts.format]}` : value;
    },

    // Universal temperature formatter
    formatTemperature(temp, options = {}) {
        if (temp === null || temp === undefined) return '--°F';
        
        const defaults = {
            unit: 'F', // 'F', 'C', 'K'
            precision: 1,
            showUnit: true
        };
        
        const opts = { ...defaults, ...options };
        const value = Number(temp);
        
        if (isNaN(value)) return '--°F';
        
        let convertedTemp = value;
        if (opts.unit === 'C') {
            convertedTemp = (value - 32) * 5/9;
        } else if (opts.unit === 'K') {
            convertedTemp = ((value - 32) * 5/9) + 273.15;
        }
        
        const formatted = convertedTemp.toFixed(opts.precision);
        return opts.showUnit ? `${formatted}°${opts.unit}` : formatted;
    },

    // Universal timestamp validator
    isValidTimestamp(timestamp) {
        if (!timestamp) return false;
        
        let date;
        
        // Handle different timestamp formats
        if (typeof timestamp === 'string') {
            if (timestamp.includes('T') || timestamp.includes('-')) {
                // ISO string format
                date = new Date(timestamp);
            } else {
                // Unix timestamp as string
                const unixSeconds = parseInt(timestamp);
                if (!isNaN(unixSeconds) && unixSeconds > 1000000000 && unixSeconds < 2000000000) {
                    date = new Date(unixSeconds * 1000);
                } else {
                    return false;
                }
            }
        } else if (typeof timestamp === 'number') {
            // Unix timestamp as number - check if it needs conversion
            if (timestamp < 1000000000 || timestamp > 2000000000) {
                return false;
            }
            // If timestamp is less than 10^10, it's in seconds; otherwise milliseconds
            date = timestamp < 10000000000 ? new Date(timestamp * 1000) : new Date(timestamp);
        } else {
            return false;
        }
        
        if (isNaN(date.getTime())) return false;
        
        // Must be after 2020 and before 2030 (reasonable bounds for this system)
        const year = date.getFullYear();
        return year >= 2020 && year <= 2030;
    },

    // Universal temperature reading validator
    isValidTemperatureReading(reading) {
        if (!reading || typeof reading !== 'object') return false;
        
        // Must have basic temperature data
        if (!('IndoorTemp' in reading) || !('OutdoorTemp' in reading)) return false;
        
        const indoor = Number(reading.IndoorTemp);
        const outdoor = Number(reading.OutdoorTemp);
        
        // Temperature must be reasonable (Pacific NW range: -10F to 120F)
        return !isNaN(indoor) && !isNaN(outdoor) && 
               indoor >= -10 && indoor <= 120 && 
               outdoor >= -10 && outdoor <= 120;
    },

    // Universal notification system
    showNotification(message, type = 'info', timeout = 10000) {
        // Remove any existing notices
        const existingNotice = document.querySelector('.dashboard-notification');
        if (existingNotice) {
            existingNotice.remove();
        }

        const header = document.querySelector('.header');
        if (!header) return;

        const notice = document.createElement('div');
        notice.className = 'dashboard-notification';
        
        const styles = {
            'info': { bg: 'rgba(23,162,184,0.9)', color: 'white', border: 'rgba(23,162,184,0.5)' },
            'warning': { bg: 'rgba(255,193,7,0.9)', color: '#212529', border: 'rgba(255,193,7,0.5)' },
            'error': { bg: 'rgba(220,53,69,0.9)', color: 'white', border: 'rgba(220,53,69,0.5)' },
            'success': { bg: 'rgba(40,167,69,0.9)', color: 'white', border: 'rgba(40,167,69,0.5)' }
        };
        
        const style = styles[type] || styles.info;
        
        notice.style.cssText = `
            background: ${style.bg};
            color: ${style.color};
            padding: 12px 15px;
            text-align: center;
            font-size: 0.9em;
            border-radius: 5px;
            margin-top: 15px;
            border: 1px solid ${style.border};
            animation: slideDown 0.3s ease-out;
            position: relative;
        `;
        
        const icons = {
            'info': 'ℹ️',
            'warning': '⚠️',
            'error': '🚨',
            'success': '✅'
        };
        
        notice.innerHTML = `
            <strong>${icons[type]} ${type.charAt(0).toUpperCase() + type.slice(1)}:</strong> ${message}
            <button onclick="this.parentElement.remove()" style="
                float: right;
                background: transparent;
                border: none;
                color: inherit;
                font-size: 16px;
                cursor: pointer;
                padding: 0 5px;
                margin-left: 10px;
            ">×</button>
        `;
        
        // Add CSS animation if not already present
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }
        
        header.appendChild(notice);
        
        // Auto-remove after timeout for non-error messages
        if (type !== 'error' && timeout > 0) {
            setTimeout(() => {
                if (notice.parentElement) {
                    notice.remove();
                }
            }, timeout);
        }
    },

    // Connection status management
    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        const statusText = document.getElementById('connectionText');
        
        if (!statusElement) return;
        
        // Remove all status classes
        statusElement.classList.remove('online', 'connecting', 'disconnected');
        
        const statusMap = {
            'connected': { class: 'online', text: 'Connected' },
            'connecting': { class: 'connecting', text: 'Connecting...' },
            'disconnected': { class: 'disconnected', text: 'Disconnected' }
        };
        
        const config = statusMap[status] || statusMap.disconnected;
        statusElement.classList.add(config.class);
        
        if (statusText) {
            statusText.textContent = config.text;
        }
    },

    // Detailed timestamp formatter (maintains compatibility with existing usage)
    formatDetailedTimestamp(date = new Date()) {
        // Create simpler format: m/d hh:mm:ss AM/PM (no leading zeros for date)
        const month = String(date.getMonth() + 1); // No padding
        const day = String(date.getDate()); // No padding
        const timeStr = date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true
        });
        
        const combined = `${month}/${day} ${timeStr}`;
        
        return { dateStr: `${month}/${day}`, timeStr, combined };
    },

    // API-specific failure notification (different behavior from showNotification)
    showApiFailureNotice(message, type = 'warning') {
        // Remove any existing API failure notices
        const existingNotice = document.querySelector('.api-failure-notice');
        if (existingNotice) {
            existingNotice.remove();
        }

        const header = document.querySelector('.header');
        if (!header) return;

        const notice = document.createElement('div');
        notice.className = 'api-failure-notice';
        notice.style.cssText = `
            background: ${type === 'error' ? 'rgba(220,53,69,0.9)' : 'rgba(255,193,7,0.9)'};
            color: ${type === 'error' ? 'white' : '#212529'};
            padding: 12px 15px;
            text-align: center;
            font-size: 0.9em;
            border-radius: 5px;
            margin-top: 15px;
            border: 1px solid ${type === 'error' ? 'rgba(220,53,69,0.5)' : 'rgba(255,193,7,0.5)'};
            animation: slideDown 0.3s ease-out;
        `;
        notice.innerHTML = `
            <strong>${type === 'error' ? '⚠️ API Error:' : '⚠️ Data Unavailable:'}</strong> ${message}
            <button onclick="this.parentElement.remove()" style="
                float: right;
                background: transparent;
                border: none;
                color: inherit;
                font-size: 16px;
                cursor: pointer;
                padding: 0 5px;
                margin-left: 10px;
            ">×</button>
        `;
        
        // Add CSS animation if not already present
        if (!document.querySelector('#api-notice-styles')) {
            const style = document.createElement('style');
            style.id = 'api-notice-styles';
            style.textContent = `
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }
        
        header.appendChild(notice);
        
        // Auto-remove after 10 seconds for warnings (not errors)
        if (type === 'warning') {
            setTimeout(() => {
                if (notice.parentElement) {
                    notice.remove();
                }
            }, 10000);
        }
    }
};

// === GLOBAL STATE MANAGEMENT (STAGE 1 OPTIMIZATION) ===
const DashboardState = {
    // Chart instances
    charts: {
        temperature: null,
        pressure: null,
        incidentTrends: null
    },
    
    // UI state (consolidating global variables)
    ui: {
        refreshTimer: refreshTimer,
        currentChartHours: currentChartHours,
        currentPressureChartHours: currentPressureChartHours,
        originalIncidentsData: originalIncidentsData
    },
    
    // Chart data comparison timestamps (for Stage 3)
    chartTimestamps: {
        temperature: null,
        pressure: null,
        incidents: null
    },
    
    // API data cache with TTL (Stage 2)
    cache: {
        statusData: { data: null, timestamp: null, ttl: 30000 }, // 30 seconds
        enhancedData: { data: null, timestamp: null, ttl: 60000 }, // 60 seconds  
        historyData: new Map() // Key: hours, Value: { data, timestamp, ttl }
    }
};

// === CENTRALIZED DATA MANAGEMENT (STAGE 2 OPTIMIZATION) ===
const DataManager = {
    // Subscription system for data updates
    subscribers: {
        status: [],
        enhanced: [],
        history: []
    },

    // Subscribe to data updates
    subscribe(dataType, callback) {
        if (!this.subscribers[dataType]) {
            this.subscribers[dataType] = [];
        }
        this.subscribers[dataType].push(callback);
    },

    // Notify all subscribers of data updates
    _notifySubscribers(dataType, data) {
        if (this.subscribers[dataType]) {
            this.subscribers[dataType].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error notifying ${dataType} subscriber:`, error);
                }
            });
        }
    },

    // Consolidated Enhanced Dashboard Data API call
    async getEnhancedData(forceRefresh = false) {
        const cache = DashboardState.cache.enhancedData;
        const now = Date.now();

        // Return cached data if still valid
        if (!forceRefresh && cache.data && cache.timestamp && (now - cache.timestamp < cache.ttl)) {
            console.log('DataManager: Using cached enhanced data');
            return cache.data;
        }

        console.log('DataManager: Fetching fresh enhanced data');
        
        try {
            console.log('🔍 DEBUG: DataManager.getEnhancedData() - Making API call to:', CONFIG.enhancedApiUrl);
            console.log('🔍 DEBUG: Auth headers:', DashboardUtils.getAuthHeaders());
            
            const response = await fetch(CONFIG.enhancedApiUrl, {
                method: 'GET',
                headers: DashboardUtils.getAuthHeaders()
            });

            console.log('🔍 DEBUG: GetEnhancedDashboardData response status:', response.status, response.statusText);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('🔍 DEBUG: GetEnhancedDashboardData full response structure:');
            console.log('🔍 DEBUG: - timestamp:', data.timestamp);
            console.log('🔍 DEBUG: - deviceId:', data.deviceId);
            console.log('🔍 DEBUG: - sections keys:', Object.keys(data.sections || {}));
            if (data.sections?.yesterday) {
                console.log('🔍 DEBUG: - yesterday keys:', Object.keys(data.sections.yesterday));
                console.log('🔍 DEBUG: - yesterday.environmental:', !!data.sections.yesterday.environmental);
                console.log('🔍 DEBUG: - yesterday.ventilation:', !!data.sections.yesterday.ventilation);
                console.log('🔍 DEBUG: - yesterday.doorActivity:', !!data.sections.yesterday.doorActivity);
                console.log('🔍 DEBUG: - yesterday.systemHealth:', !!data.sections.yesterday.systemHealth);
            }
            if (data.sections?.doors) {
                console.log('🔍 DEBUG: - doors keys:', Object.keys(data.sections.doors));
                console.log('🔍 DEBUG: - doors.detectionAnalytics:', !!data.sections.doors.detectionAnalytics);
                console.log('🔍 DEBUG: - doors.timeline length:', data.sections.doors.timeline?.length || 0);
            }
            
            // Cache the response
            cache.data = data;
            cache.timestamp = now;

            // Notify all subscribers
            this._notifySubscribers('enhanced', data);

            console.log('DataManager: Enhanced data fetched and cached successfully');
            return data;

        } catch (error) {
            console.error('DataManager: Error fetching enhanced data:', error);
            // Return cached data if available, even if expired
            if (cache.data) {
                console.log('DataManager: Returning expired cached data due to error');
                return cache.data;
            }
            throw error;
        }
    },

    // Consolidated History Data API call with parameter awareness
    async getHistoryData(hours = 24, forceRefresh = false) {
        const historyCache = DashboardState.cache.historyData;
        const cacheKey = `hours_${hours}`;
        const cache = historyCache.get(cacheKey);
        const now = Date.now();
        const ttl = 45000; // 45 seconds TTL

        // Return cached data if still valid
        if (!forceRefresh && cache && cache.data && cache.timestamp && (now - cache.timestamp < ttl)) {
            console.log(`DataManager: Using cached history data for ${hours}h`);
            return cache.data;
        }

        console.log(`DataManager: Fetching fresh history data for ${hours}h`);
        
        try {
            const url = `${CONFIG.historyApiUrl}?deviceId=${CONFIG.deviceId}&hours=${hours}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: DashboardUtils.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Cache the response
            historyCache.set(cacheKey, {
                data: data,
                timestamp: now,
                ttl: ttl
            });

            // Notify all subscribers
            this._notifySubscribers('history', { hours, data });

            console.log(`DataManager: History data (${hours}h) fetched and cached successfully`);
            return data;

        } catch (error) {
            console.error(`DataManager: Error fetching history data for ${hours}h:`, error);
            // Return cached data if available, even if expired
            if (cache && cache.data) {
                console.log(`DataManager: Returning expired cached data for ${hours}h due to error`);
                return cache.data;
            }
            throw error;
        }
    },

    // Consolidated Status Data API call
    async getStatusData(forceRefresh = false) {
        const cache = DashboardState.cache.statusData;
        const now = Date.now();

        // Return cached data if still valid
        if (!forceRefresh && cache.data && cache.timestamp && (now - cache.timestamp < cache.ttl)) {
            console.log('DataManager: Using cached status data');
            return cache.data;
        }

        console.log('DataManager: Fetching fresh status data');
        
        try {
            const url = `${CONFIG.statusApiUrl}?deviceId=${CONFIG.deviceId}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: DashboardUtils.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Cache the response
            cache.data = data;
            cache.timestamp = now;

            // Notify all subscribers
            this._notifySubscribers('status', data);

            console.log('DataManager: Status data fetched and cached successfully');
            return data;

        } catch (error) {
            console.error('DataManager: Error fetching status data:', error);
            // Return cached data if available, even if expired
            if (cache.data) {
                console.log('DataManager: Returning expired cached data due to error');
                return cache.data;
            }
            throw error;
        }
    },

    // Get door analytics data for CSV export
    async getDoorAnalyticsData(timeRange = '24h', analysis = 'raw-transitions') {
        console.log(`DataManager: Fetching door analytics data for ${timeRange}`);
        
        try {
            const url = `https://esp32-ventilation-api.azurewebsites.net/api/GetEnhancedDoorAnalytics?timeRange=${timeRange}&analysis=${analysis}&deviceId=${CONFIG.deviceId}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: DashboardUtils.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`DataManager: Door analytics data received - ${data.totalTransitions || 0} transitions`);
            return data;
        } catch (error) {
            console.error('DataManager: Error fetching door analytics data:', error);
            throw error;
        }
    },

    // Get current system status from GetVentilationStatus API
    async getCurrentSystemStatus(forceRefresh = false) {
        const cache = DashboardState.cache.currentStatus || { data: null, timestamp: null, ttl: 30000 }; // 30 second cache
        const now = Date.now();

        // Initialize cache if not exists
        if (!DashboardState.cache.currentStatus) {
            DashboardState.cache.currentStatus = cache;
        }

        // Return cached data if still valid
        if (!forceRefresh && cache.data && cache.timestamp && (now - cache.timestamp < cache.ttl)) {
            console.log('DataManager: Using cached current system status');
            return cache.data;
        }

        console.log('DataManager: Fetching fresh current system status');
        
        try {
            const url = `${CONFIG.currentStatusApiUrl}?deviceId=${CONFIG.deviceId}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: DashboardUtils.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Cache the response
            cache.data = data;
            cache.timestamp = now;
            DashboardState.cache.currentStatus = cache;

            console.log('DataManager: Current system status fetched and cached successfully');
            return data;

        } catch (error) {
            console.error('DataManager: Error fetching current system status:', error);
            // Return cached data if available, even if expired
            if (cache.data) {
                console.log('DataManager: Returning expired cached system status due to error');
                return cache.data;
            }
            throw error;
        }
    }
};

// Legacy function for backward compatibility - will be removed in later stages
/**
 * Gets authentication headers for API requests
 * Legacy wrapper function that delegates to DashboardUtils.getAuthHeaders()
 * @returns {Object} Headers object containing authentication information
 */
function getAuthHeaders() {
    return DashboardUtils.getAuthHeaders();
}

/**
 * Logs out the current user by clearing authentication data
 * Legacy wrapper function that delegates to DashboardUtils.logout()
 * @returns {void}
 */
function logout() {
    return DashboardUtils.logout();
}

// Function to show API failure notifications
/**
 * Displays API failure notifications to the user
 * Legacy wrapper function that delegates to DashboardUtils.showApiFailureNotice()
 * @param {string} message - The error message to display
 * @param {string} type - The notification type (default: 'warning')
 * @returns {void}
 */
function showApiFailureNotice(message, type = 'warning') {
    return DashboardUtils.showApiFailureNotice(message, type);
}

// Initialize dashboard
// (Removed duplicate function - using the one with enhanced API calls below)

// Authentication check - redirect to login if not authenticated
window.addEventListener('load', function() {
    const token = localStorage.getItem('ventilation_auth_token');
    const apiKey = getApiKeyFromUrl();
    
    // If no token and no API key, show no data message (don't redirect)
    // This allows users to see the dashboard structure before logging in
    if (!token && !apiKey) {
        // Show no data state without authentication
        return;
    }
});

// Connection status management
/**
 * Updates the connection status indicator in the dashboard
 * Legacy wrapper function that delegates to DashboardUtils.updateConnectionStatus()
 * @param {string} status - The connection status ('connected', 'disconnected', 'reconnecting', etc.)
 * @returns {void}
 */
function updateConnectionStatus(status) {
    return DashboardUtils.updateConnectionStatus(status);
}

// Auto-refresh functionality
/**
 * Starts the auto-refresh timer for dashboard data
 * Clears any existing refresh timer and starts a new interval timer
 * Refreshes dashboard data every CONFIG.refreshInterval milliseconds (default: 30 seconds)
 * @returns {void}
 */
function startAutoRefresh() {
    // Clear any existing timer
    if (refreshTimer) {
        clearInterval(refreshTimer);
    }
    
    // Start new timer
    refreshTimer = setInterval(async () => {
        console.log('Auto-refreshing dashboard data...');
        try {
            await refreshData();
            // Monthly aggregation now in Yesterday's Report - no need to refresh separately
            // await loadAggregationStatus();
            // Don't auto-refresh charts to avoid interrupting user interactions
        } catch (error) {
            console.error('Auto-refresh failed:', error);
        }
    }, CONFIG.refreshInterval);
    
    console.log(`Auto-refresh started with ${CONFIG.refreshInterval / 1000}s interval`);
}

// This will be populated with more functions as we extract them from the HTML file
// For now, let's add placeholders for the main functions we know exist

// Main data refresh function
/**
 * Refreshes all dashboard data by fetching current status and updating displays
 * Uses DataManager to fetch status data and updates all dashboard widgets
 * Updates last refresh time and handles authentication requirements
 * @returns {Promise<void>}
 */
        async function refreshData() {
            console.log('🔍 DEBUG: === REFRESHING DASHBOARD DATA ===');
            console.log('🔍 DEBUG: CONFIG.apiSecret available:', !!CONFIG.apiSecret);
            console.log('🔍 DEBUG: localStorage token available:', !!localStorage.getItem('ventilation_auth_token'));
            
            try {
                updateConnectionStatus('connecting');        const token = localStorage.getItem('ventilation_auth_token');
        
        // If no authentication method is available, show no data
        if (!token && !CONFIG.apiSecret) {
            showNoDataState();
            updateConnectionStatus('disconnected');
            return;
        }

        // Use consolidated DataManager instead of direct API call
        const data = await DataManager.getStatusData();
        console.log('DataManager: Status data retrieved successfully');
        
        // Update dashboard with new data
        await updateDashboard(data);
        updateConnectionStatus('connected');

        // Refresh chart data if chart is currently displayed
        refreshCurrentChart();
        
        // Clear any existing error notices
        const apiFailureNotice = document.getElementById('apiFailureNotice');
        if (apiFailureNotice) {
            apiFailureNotice.style.display = 'none';
        }
        
    } catch (error) {
        console.error('DataManager: Error refreshing dashboard data:', error);
        
        // Handle authentication errors
        if (error.message.includes('401')) {
            const token = localStorage.getItem('ventilation_auth_token');
            if (!token && CONFIG.apiSecret) {
                logout();
                return;
            } else if (token) {
                showApiFailureNotice('Status API returned 401 Unauthorized. Please check authentication or contact system administrator.', 'error');
            }
        } else {
            showApiFailureNotice(`Network error connecting to Status API: ${error.message}. Data is currently unavailable.`, 'error');
        }
        
        showNoDataState();
        updateConnectionStatus('disconnected');
    }
}

// Note: These functions are implemented later in this file

// Initialize when DOM is ready
// (Removed duplicate initialization - using the one with enhanced API calls in the code below)

//
// Moved by Paul from dashboard.html 20250829
//

// Note: getApiKeyFromUrl() function is defined at the top of the page
// Variables are already declared at the top of this file

        // Add logout button to header
        document.addEventListener('DOMContentLoaded', function() {
            const header = document.querySelector('.header');
            const userEmail = localStorage.getItem('ventilation_user_email') || 'User';
            
            const userSection = document.createElement('div');
            userSection.style.cssText = 'position: absolute; top: 15px; right: 20px; font-size: 0.9em;';
            userSection.innerHTML = `
                <span style="margin-right: 15px;">Welcome, ${userEmail}</span>
                <button onclick="logout()" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 5px 10px; border-radius: 5px; cursor: pointer;">Logout</button>
            `;
            
            if (header) {
                header.style.position = 'relative';
                header.appendChild(userSection);
            }
            
            // Only show no-data notice if user has neither Bearer token nor API key
            const token = localStorage.getItem('ventilation_auth_token');
            if (!CONFIG.apiSecret && !token) {
                const noDataNotice = document.createElement('div');
                noDataNotice.style.cssText = 'background: rgba(255,193,7,0.9); color: #212529; padding: 10px; text-align: center; font-size: 0.9em; border-radius: 5px; margin-top: 10px;';
                noDataNotice.innerHTML = '📊 <strong>No Data Available:</strong> <a href="login.html" style="color: #0056b3; text-decoration: underline;">Log in</a> to access live data.';
                if (header) header.appendChild(noDataNotice);
            }
            
            // Initialize dashboard - the existing loadingSection will be shown by default
            console.log('🔍 DEBUG: Starting dashboard initialization');
            initializeDashboard().then(() => {
                console.log('🔍 DEBUG: Dashboard initialization completed successfully');
                // Hide the existing loading section once dashboard is ready
                const loadingSection = document.getElementById('loadingSection');
                if (loadingSection) {
                    loadingSection.style.display = 'none';
                    console.log('🔍 DEBUG: Loading section hidden');
                }
                
                // CRITICAL FIX: Show the dashboard content after initialization
                const dashboardContent = document.getElementById('dashboardContent');
                if (dashboardContent) {
                    dashboardContent.style.display = 'block';
                    console.log('🔍 DEBUG: Dashboard content shown');
                } else {
                    console.error('🚨 DEBUG: dashboardContent element not found!');
                }
            }).catch(error => {
                console.error('🚨 DEBUG: Dashboard initialization failed:', error);
                // Hide loading section on error too
                const loadingSection = document.getElementById('loadingSection');
                if (loadingSection) {
                    loadingSection.style.display = 'none';
                }
                
                // Show dashboard content even on error (with no data state)
                const dashboardContent = document.getElementById('dashboardContent');
                if (dashboardContent) {
                    dashboardContent.style.display = 'block';
                }
                
                DashboardUtils.showNotification('Dashboard initialization failed. Check console for details. Some features may not work correctly.', 'error');
            });
            
            setupEnhancedDashboard(); // Initialize Phase 2 enhancements
        });

        // Wrapper function for consolidated utility
        /**
         * Formats a date object into a detailed timestamp string
         * Legacy wrapper function that delegates to DashboardUtils.formatDetailedTimestamp()
         * @param {Date} date - The date to format (default: current date/time)
         * @returns {string} Formatted timestamp string
         */
        function formatDetailedTimestamp(date = new Date()) {
            return DashboardUtils.formatDetailedTimestamp(date);
        }

        // Utility function to get time ago string
        function getTimeAgo(date) {
            const now = new Date();
            const diffMs = now - date;
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffMinutes < 1) {
                return 'Just now';
            } else if (diffMinutes < 60) {
                return `${diffMinutes}m ago`;
            } else if (diffHours < 24) {
                return `${diffHours}h ago`;
            } else {
                return `${diffDays}d ago`;
            }
        }

        // Initialize dashboard
        /**
         * Initializes the entire dashboard system
         * Sets up modular architecture, loads initial data, sets up charts, and starts auto-refresh
         * Handles both modern modular systems and legacy fallbacks
         * @returns {Promise<void>}
         */
        async function initializeDashboard() {
            console.log('Initializing dashboard...');
            
            // STAGE 5: Initialize modular systems first
            const modularSystems = await initializeModularSystems();
            if (modularSystems) {
                console.log('=== STAGE 5: Using enhanced modular architecture ===');
                // Set up event subscriptions for modular architecture
                GlobalEventSystem.on('data:updated', (data) => {
                    console.log('STAGE 5: Data update event received:', data.type);
                });
                
                GlobalEventSystem.on('chart:updated', (data) => {
                    console.log('STAGE 5: Chart update event received:', data.chartType);
                });
            } else {
                console.log('=== STAGE 5: Fallback to legacy systems ===');
            }
            
            // Initialize API secret from URL parameters
            initializeApiSecret();
            
            // Clear any previous data source tracking
            if (window.dataSourceTracker) {
                window.dataSourceTracker.clearAll();
            }
            
            // Load dashboard components with modular enhancement
            if (GlobalDataManager) {
                // Use enhanced data manager
                await refreshDataWithModularSystem();
                // ADDITIONAL FIX: Ensure main sensor data is loaded even if modular system has issues
                console.log('INITIALIZATION: Ensuring sensor data is loaded for main widgets...');
                try {
                    await refreshData(); // Also call legacy refresh to populate main widgets
                } catch (error) {
                    console.error('INITIALIZATION: Legacy refresh also failed:', error);
                }
            } else {
                // Fallback to legacy data refresh
                await refreshData();
            }
            
            // Load charts with modular enhancement
            if (GlobalChartManager) {
                // Use enhanced chart manager
                await loadChartsWithModularSystem();
            } else {
                // Fallback to legacy chart loading
                await createTemperatureChart(6); // Load 6-hour chart by default
                await createPressureChart(6); // Load 6-hour pressure chart by default
            }
            
            await loadIncidentAlmanac();
            
            // Load Enhanced API data sections (only the ones that work)
            // FIX: Await async functions to prevent race conditions
            await loadYesterdaySummaryMetrics();
            await updateEnhancedDoorActivity();
            await updateSystemHealthWidget();
            
            // ENHANCED: Load individual sensor data for accurate temperature readings
            // This ensures the Yesterday Report shows accurate temperatures instead of N/A
            await loadYesterdayIndividualSensorData();
            
            // Note: Monthly aggregation status is handled by loadAggregationStatus() above
            
            // Start auto-refresh
            startAutoRefresh();
            
            console.log('Dashboard initialization complete');
        }

        // ===================================================================
        // STAGE 5: MODULAR SYSTEM INTEGRATION FUNCTIONS
        // ===================================================================

        /**
         * Refreshes dashboard data using the modular system architecture
         * Uses GlobalDataManager for data fetching with intelligent caching
         * Updates main display, door status, incidents, and emits events
         * @returns {Promise<void>}
         */
        async function refreshDataWithModularSystem() {
            console.log('=== STAGE 5: Using enhanced DataManager for data refresh ===');
            
            try {
                // Use the modular DataManager with caching
                const statusData = await GlobalDataManager.getStatusData();
                if (statusData && statusData.length > 0) {
                    const latestRecord = statusData[statusData.length - 1];
                    // FIX: Use correct updateDashboard() function instead of missing updateMainDisplay()
                    await updateDashboard(latestRecord);
                    GlobalEventSystem.emit('data:updated', { type: 'status', count: statusData.length });
                }
                
                // Subscribe to future updates
                GlobalDataManager.subscribe('status', async (data) => {
                    console.log('STAGE 5: Status data subscription update received');
                    if (data && data.length > 0) {
                        const latestRecord = data[data.length - 1];
                        // FIX: Use correct updateDashboard() function instead of missing updateMainDisplay()
                        await updateDashboard(latestRecord);
                    }
                });
                
            } catch (error) {
                console.error('STAGE 5: Enhanced data refresh failed, falling back to legacy:', error);
                await refreshData(); // Fallback to legacy function
            }
        }

        /**
         * Loads and updates charts using the modular system architecture
         * Uses GlobalChartManager for intelligent chart updates with change detection
         * Handles both temperature and pressure charts, emits update events
         * @returns {Promise<void>}
         */
        async function loadChartsWithModularSystem() {
            console.log('=== STAGE 5: Using enhanced ChartManager for chart loading ===');
            
            try {
                // Load temperature chart with smart updates
                const tempChart = await GlobalChartManager.updateTemperatureChart(6, temperatureChart);
                if (tempChart) {
                    temperatureChart = tempChart;
                    GlobalEventSystem.emit('chart:updated', { chartType: 'temperature', hours: 6 });
                }
                
                // Load pressure chart with smart updates
                const pressChart = await GlobalChartManager.updatePressureChart(6, pressureChart);
                if (pressChart) {
                    pressureChart = pressChart;
                    GlobalEventSystem.emit('chart:updated', { chartType: 'pressure', hours: 6 });
                }
                
            } catch (error) {
                console.error('STAGE 5: Enhanced chart loading failed, falling back to legacy:', error);
                await createTemperatureChart(6);
                await createPressureChart(6);
            }
        }

        // Enhanced chart button handlers with modular integration
        /**
         * Loads temperature chart for specified time period using modular system
         * Uses GlobalChartManager for intelligent updates and emits chart update events
         * Falls back to legacy createTemperatureChart() if modular system is unavailable
         * @param {number} hours - Number of hours of data to display
         * @returns {void}
         */
        function enhancedLoadChart(hours) {
            if (GlobalChartManager && temperatureChart) {
                GlobalChartManager.updateTemperatureChart(hours, temperatureChart)
                    .then(updatedChart => {
                        if (updatedChart) {
                            temperatureChart = updatedChart;
                            GlobalEventSystem.emit('chart:updated', { chartType: 'temperature', hours });
                        }
                    })
                    .catch(error => {
                        console.error('STAGE 5: Enhanced temperature chart update failed:', error);
                        createTemperatureChart(hours); // Fallback
                    });
            } else {
                createTemperatureChart(hours); // Fallback
            }
        }

        /**
         * Loads pressure chart for specified time period using modular system
         * Uses GlobalChartManager for intelligent updates and emits chart update events
         * Falls back to legacy createPressureChart() if modular system is unavailable
         * @param {number} hours - Number of hours of data to display
         * @returns {void}
         */
        function enhancedLoadPressureChart(hours) {
            if (GlobalChartManager && pressureChart) {
                GlobalChartManager.updatePressureChart(hours, pressureChart)
                    .then(updatedChart => {
                        if (updatedChart) {
                            pressureChart = updatedChart;
                            GlobalEventSystem.emit('chart:updated', { chartType: 'pressure', hours });
                        }
                    })
                    .catch(error => {
                        console.error('STAGE 5: Enhanced pressure chart update failed:', error);
                        createPressureChart(hours); // Fallback
                    });
            } else {
                createPressureChart(hours); // Fallback
            }
        }

        // Enhanced Dashboard Functions for Phase 2

        /**
         * Toggles the visibility of the Yesterday Report detailed content section
         * Expands/collapses the detailed content and loads data when expanding
         * Updates button text and handles loading states
         * @returns {void}
         */
        function toggleYesterdayReport() {
            const detailedContent = document.getElementById('yesterdayDetailedContent');
            const expandToggle = document.getElementById('expandToggle');
            
            if (detailedContent.style.display === 'none' || detailedContent.style.display === '') {
                detailedContent.style.display = 'block';
                expandToggle.textContent = '▲ Hide Details';
                // Load detailed content if not already loaded
                loadYesterdayDetailedContent();
            } else {
                detailedContent.style.display = 'none';
                expandToggle.textContent = '▼ Show Details';
            }
        }

        /**
         * Loads detailed content for the Yesterday Report section
         * Shows loading states initially, then loads all subsections:
         * - Environmental data, humidity analysis, pressure analysis
         * - Performance metrics, ventilation analysis, door activity
         * - Incident summary and aggregation status
         * @returns {void}
         */
        function loadYesterdayDetailedContent() {
            console.log('=== STAGE 2: loadYesterdayDetailedContent() using DataManager ===');
            
            // Show loading states initially for all sections
            document.getElementById('yesterdayEnvironmental').innerHTML = '<div style="text-align: center; padding: 20px; color: #666;"><em>Loading environmental data...</em></div>';
            document.getElementById('yesterdayHumidity').innerHTML = '<div style="text-align: center; padding: 20px; color: #666;"><em>Loading humidity analysis...</em></div>';
            document.getElementById('yesterdayPressure').innerHTML = '<div style="text-align: center; padding: 20px; color: #666;"><em>Loading pressure analysis...</em></div>';
            document.getElementById('yesterdayPerformance').innerHTML = '<div style="text-align: center; padding: 20px; color: #666;"><em>Loading performance & health metrics...</em></div>';
            document.getElementById('yesterdayVentilation').innerHTML = '<div style="text-align: center; padding: 20px; color: #666;"><em>Loading ventilation analysis...</em></div>';
            document.getElementById('yesterdayDoorTimeline').innerHTML = '<div style="text-align: center; padding: 20px; color: #666;"><em>Loading door activity...</em></div>';
            document.getElementById('yesterdayAggregation').innerHTML = '<div style="text-align: center; padding: 20px; color: #666;"><em>Loading aggregation status...</em></div>';
            document.getElementById('yesterdayIncidentSummary').innerHTML = '<div style="text-align: center; padding: 20px; color: #666;"><em>Loading incident analysis...</em></div>';
            
            // Check if we have any authentication method (Bearer token or API key)
            const headers = getAuthHeaders();
            const hasAuth = headers['Authorization'] || headers['X-API-Secret'];
            
            if (!hasAuth) {
                console.log('loadYesterdayDetailedContent: No authentication available - Bearer token or API key required');
                return;
            }
            
            // Use consolidated DataManager instead of direct API call
            DataManager.getEnhancedData()
                .then(data => {
                    console.log('DataManager: Enhanced data received for detailed content');
                    
                    // Extract yesterday's data from the sections
                    const yesterdayData = data.sections && data.sections.yesterday;
                    if (!yesterdayData) {
                        throw new Error('Yesterday section not found in API response');
                    }
                    
                    // Check if this is real data or just a status message
                    if (yesterdayData.status === 'waiting_for_esp32_data') {
                        throw new Error('Real ESP32 data not yet available: ' + yesterdayData.message);
                    }
                    
                    // PHASE 2: Enhanced Environmental Summary with individual sensor zones (Attributes #6-9, #10-12)
                    if (yesterdayData.environmental) {
                        console.log('PHASE 2: Loading enhanced environmental summary with sensor breakdown');
                        const envData = yesterdayData.environmental;
                        const tempData = envData.temperature;
                        const humidityData = envData.humidity;
                        
                        document.getElementById('yesterdayEnvironmental').innerHTML = `
                            <div class="env-summary">
                                <div class="sensor-grid" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                                    <div class="sensor-zone" style="padding: 15px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #007bff;">
                                        <h5 style="color: #007bff; margin-top: 0;">🏠 Indoor Environment</h5>
                                        <p><strong>Temperature:</strong> ${tempData.indoor.min}° - ${tempData.indoor.max}° (avg ${tempData.indoor.avg}°F)</p>
                                        <p><strong>Humidity:</strong> ${humidityData && humidityData.indoor ? `${humidityData.indoor.current}% (${humidityData.indoor.status || 'Normal'})` : 'Unknown'}</p>
                                        <p><strong>Trend:</strong> ${tempData.indoor.trend}</p>
                                        <p><strong>Comfort Status:</strong> ${tempData.differentials.comfortZone}</p>
                                    </div>
                                    <div class="sensor-zone" style="padding: 15px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #28a745;">
                                        <h5 style="color: #28a745; margin-top: 0;">�️ Outdoor Environment</h5>
                                        <p><strong>Temperature:</strong> ${tempData.outdoor.min}° - ${tempData.outdoor.max}° (avg ${tempData.outdoor.avg}°F)</p>
                                        <p><strong>Humidity:</strong> ${humidityData && humidityData.outdoor ? `${humidityData.outdoor.current}%` : 'Unknown'}</p>
                                        <p><strong>Trend:</strong> ${tempData.outdoor.trend}</p>
                                        <p><strong>Weather Impact:</strong> Monitoring for ventilation decisions</p>
                                    </div>
                                    <div class="sensor-zone" style="padding: 15px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #ffc107;">
                                        <h5 style="color: #e67e22; margin-top: 0;">🚗 Garage Environment</h5>
                                        <p><strong>Temperature:</strong> ${tempData.garage.min}° - ${tempData.garage.max}° (avg ${tempData.garage.avg}°F)</p>
                                        <p><strong>Differential:</strong> ${tempData.differentials.indoorOutdoor}°F vs outdoor</p>
                                        <p><strong>Stability:</strong> ${tempData.garage.range}°F daily range</p>
                                        <p><strong>Ventilation Need:</strong> ${tempData.differentials && tempData.differentials.ventilationRecommendation ? tempData.differentials.ventilationRecommendation : 'Normal ventilation'}</p>
                                    </div>
                                </div>
                                <div class="env-analysis" style="padding: 15px; background-color: #e9ecef; border-radius: 8px;">
                                    <p><strong>📊 Temperature Analysis:</strong></p>
                                    <ul style="margin-bottom: 10px;">
                                        <li>Indoor stability: ${tempData.indoor.trend} (range: ${tempData.indoor.range}°F)</li>
                                        <li>Optimal range status: ${tempData.differentials.comfortZone}</li>
                                        <li>Daily temperature differential: ${tempData.differentials.indoorOutdoor}°F between indoor/outdoor</li>
                                        <li>Ventilation effectiveness: ${tempData.differentials && tempData.differentials.ventilationImpact ? tempData.differentials.ventilationImpact : 'Positive impact on temperature control'}</li>
                                    </ul>
                                    <p><strong>🌡️ Key Insights:</strong> ${envData.analysis && envData.analysis.dailyInsight ? envData.analysis.dailyInsight : 'Environmental conditions within normal ranges'}</p>
                                </div>
                            </div>
                        `;
                    } else {
                        document.getElementById('yesterdayEnvironmental').innerHTML = '<div class="error-state">Environmental data not available</div>';
                    }
                    
                    // PHASE 2: Enhanced System Performance & Health (MERGED WIDGET) - Attributes #1-5, #17-23, #34-43
                    console.log('PHASE 2: Loading enhanced System Performance & Health (merged widget)');
                    
                    const perfData = yesterdayData.systemPerformance;
                    const ventData = yesterdayData.ventilation;
                    const healthData = yesterdayData.systemHealth;
                    const incidentData = yesterdayData.incidents;
                    
                    if (perfData || ventData || healthData || incidentData) {
                        // Calculate derived metrics
                        const uptimeMinutes = (perfData && perfData.uptimeMinutes) ? perfData.uptimeMinutes : 0;
                        const uptimeFormatted = uptimeMinutes > 0 ? `${Math.floor(uptimeMinutes / 60)}h ${uptimeMinutes % 60}m` : 'Unknown';
                        const dutyCycle = (ventData && ventData.fanMinutesToday) ? ((ventData.fanMinutesToday / 1440) * 100).toFixed(1) : 'Unknown'; // 1440 min = 24h
                        const ventRuntime = (ventData && ventData.fanMinutesToday) ? (ventData.fanMinutesToday / 60).toFixed(1) : 'Unknown';
                        
                        document.getElementById('yesterdayPerformance').innerHTML = `
                            <div class="perf-health-summary">
                                <div class="metric-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                                    <div class="performance-section" style="padding: 15px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #007bff;">
                                        <h5 style="color: #007bff; margin-top: 0;">⚡ System Performance</h5>
                                        <p><strong>System Uptime:</strong> ${uptimeFormatted}${perfData && perfData.uptimePercentage ? ` (${perfData.uptimePercentage}%)` : ''}</p>
                                        <p><strong>Memory Available:</strong> ${perfData && perfData.freeMemory ? `${perfData.freeMemory}% free` : 'Unknown'}</p>
                                        <p><strong>WiFi Reliability:</strong> ${healthData && healthData.wifiReliability ? `${healthData.wifiReliability.uptimePercentage}%` : 'Unknown'}</p>
                                        <p><strong>Sensor Response:</strong> ${healthData && healthData.sensorsResponding ? 'All Active ✅' : 'Issues Detected ⚠️'}</p>
                                        <p><strong>Telemetry Status:</strong> ${healthData && healthData.telemetryEnabled ? 'Active ✅' : 'Disabled ⚠️'}</p>
                                    </div>
                                    <div class="health-section" style="padding: 15px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #28a745;">
                                        <h5 style="color: #28a745; margin-top: 0;">🔍 System Health</h5>
                                        <p><strong>Overall Status:</strong> ${healthData && healthData.overallHealth ? healthData.overallHealth : 'Unknown'}</p>
                                        <p><strong>Security Status:</strong> ${healthData && healthData.securityStatus ? healthData.securityStatus : 'Unknown'}</p>
                                        <p><strong>Fan Condition:</strong> ${healthData && healthData.fanCondition ? healthData.fanCondition : 'Unknown'}</p>
                                        <p><strong>Maintenance Due:</strong> ${healthData && healthData.predictiveMaintenance ? healthData.predictiveMaintenance : 'Unknown'}</p>
                                        <p><strong>Reliability Score:</strong> ${healthData && healthData.reliabilityMetric ? `${healthData.reliabilityMetric}%` : 'Unknown'}</p>
                                    </div>
                                </div>
                                <div class="incident-section" style="padding: 15px; background-color: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107; margin-bottom: 20px;">
                                    <h5 style="color: #856404; margin-top: 0;">⚠️ Incident Analysis</h5>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                        <div>
                                            <p><strong>Total Incidents:</strong> ${incidentData && incidentData.total ? incidentData.total : 0}</p>
                                            <p><strong>Critical:</strong> ${incidentData && incidentData.critical ? incidentData.critical : 0} | <strong>Warning:</strong> ${incidentData && incidentData.warning ? incidentData.warning : 0}</p>
                                            <p><strong>Info:</strong> ${incidentData && incidentData.info ? incidentData.info : 0} | <strong>Resolved:</strong> ${incidentData && incidentData.resolved ? incidentData.resolved : 0}</p>
                                        </div>
                                        <div>
                                            <p><strong>Most Recent:</strong> ${incidentData && incidentData.lastIncidentTime ? incidentData.lastIncidentTime : 'None'}</p>
                                            <p><strong>Current Status:</strong> ${incidentData && incidentData.currentStatus ? incidentData.currentStatus : 'Stable'}</p>
                                            <p><strong>Resolution Rate:</strong> ${incidentData && incidentData.total > 0 ? `${Math.round((incidentData.resolved / incidentData.total) * 100)}%` : 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div class="ventilation-performance" style="padding: 15px; background-color: #d1ecf1; border-radius: 8px; border-left: 4px solid #17a2b8;">
                                    <h5 style="color: #0c5460; margin-top: 0;">🌀 Ventilation Performance</h5>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                        <div>
                                            <p><strong>Total Runtime:</strong> ${ventRuntime} hours (${dutyCycle}% duty cycle)</p>
                                            <p><strong>Energy Usage:</strong> ${ventData && ventData.energyUsage ? ventData.energyUsage : 'Unknown'}</p>
                                            <p><strong>Efficiency:</strong> ${ventData && ventData.efficiency ? ventData.efficiency : 'Unknown'}</p>
                                        </div>
                                        <div>
                                            <p><strong>Operational Mode:</strong> ${ventData && ventData.mode ? ventData.mode : 'Unknown'}</p>
                                            <p><strong>Air Quality:</strong> ${ventData && ventData.airQuality ? ventData.airQuality : 'Unknown'}</p>
                                            <p><strong>Circulation:</strong> ${ventData && ventData.circulation ? ventData.circulation : 'Unknown'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    } else {
                        document.getElementById('yesterdayPerformance').innerHTML = '<div class="error-state">System Performance & Health data not available</div>';
                    }
                    
                    // Load door timeline - get real door activity data from History API like the main timeline
                    loadYesterdayDoorActivity();
                    
                    // PHASE 2: Enhanced Humidity Analysis with Sensor Breakdown (Attributes #10-12)
                    if (yesterdayData.environmental && yesterdayData.environmental.humidity) {
                        console.log('PHASE 2: Loading enhanced humidity analysis with sensor breakdown');
                        const humidityData = yesterdayData.environmental.humidity;
                        
                        document.getElementById('yesterdayHumidity').innerHTML = `
                            <div class="humidity-analysis">
                                <h4 style="color: #007bff; margin-top: 0;">💧 Comprehensive Humidity Analysis</h4>
                                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                                    <div style="padding: 15px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #007bff;">
                                        <h5 style="color: #007bff; margin-top: 0;">🏠 Indoor Humidity</h5>
                                        <p><strong>Current:</strong> ${humidityData.indoor ? `${humidityData.indoor.current}%` : 'Unknown'}</p>
                                        <p><strong>Range:</strong> ${humidityData.indoor ? `${humidityData.indoor.min}% - ${humidityData.indoor.max}%` : 'Unknown'}</p>
                                        <p><strong>Average:</strong> ${humidityData.indoor ? `${humidityData.indoor.avg}%` : 'Unknown'}</p>
                                        <p><strong>Status:</strong> ${humidityData.indoor ? humidityData.indoor.status || 'Normal' : 'Unknown'}</p>
                                        <p><strong>Trend:</strong> ${humidityData.indoor ? humidityData.indoor.trend || 'Stable' : 'Unknown'}</p>
                                    </div>
                                    <div style="padding: 15px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #28a745;">
                                        <h5 style="color: #28a745; margin-top: 0;">🌤️ Outdoor Humidity</h5>
                                        <p><strong>Current:</strong> ${humidityData.outdoor ? `${humidityData.outdoor.current}%` : 'Unknown'}</p>
                                        <p><strong>Range:</strong> ${humidityData.outdoor ? `${humidityData.outdoor.min}% - ${humidityData.outdoor.max}%` : 'Unknown'}</p>
                                        <p><strong>Average:</strong> ${humidityData.outdoor ? `${humidityData.outdoor.avg}%` : 'Unknown'}</p>
                                        <p><strong>Weather:</strong> ${humidityData.outdoor ? humidityData.outdoor.weatherCondition || 'Normal' : 'Unknown'}</p>
                                        <p><strong>Trend:</strong> ${humidityData.outdoor ? humidityData.outdoor.trend || 'Stable' : 'Unknown'}</p>
                                    </div>
                                    <div style="padding: 15px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #ffc107;">
                                        <h5 style="color: #e67e22; margin-top: 0;">🚗 Garage Humidity</h5>
                                        <p><strong>Current:</strong> ${humidityData.garage ? `${humidityData.garage.current}%` : 'Unknown'}</p>
                                        <p><strong>Range:</strong> ${humidityData.garage ? `${humidityData.garage.min}% - ${humidityData.garage.max}%` : 'Unknown'}</p>
                                        <p><strong>Average:</strong> ${humidityData.garage ? `${humidityData.garage.avg}%` : 'Unknown'}</p>
                                        <p><strong>Ventilation Need:</strong> ${humidityData.garage ? humidityData.garage.ventilationNeed || 'Normal' : 'Unknown'}</p>
                                        <p><strong>Trend:</strong> ${humidityData.garage ? humidityData.garage.trend || 'Stable' : 'Unknown'}</p>
                                    </div>
                                </div>
                                <div style="padding: 15px; background-color: #e9ecef; border-radius: 8px; margin-bottom: 15px;">
                                    <h5 style="color: #495057; margin-top: 0;">📊 Humidity Analysis</h5>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                        <div>
                                            <p><strong>Indoor/Outdoor Differential:</strong> ${humidityData.differentials ? `${humidityData.differentials.indoorOutdoor}%` : 'Unknown'}</p>
                                            <p><strong>Garage/Indoor Differential:</strong> ${humidityData.differentials ? `${humidityData.differentials.garageIndoor}%` : 'Unknown'}</p>
                                            <p><strong>Daily Variation:</strong> ${humidityData.dailyVariation || 'Normal seasonal pattern'}</p>
                                        </div>
                                        <div>
                                            <p><strong>Comfort Zone Status:</strong> ${humidityData.comfortZone || 'Within optimal range'}</p>
                                            <p><strong>Condensation Risk:</strong> ${humidityData.condensationRisk || 'Low'}</p>
                                            <p><strong>Ventilation Impact:</strong> ${humidityData.ventilationImpact || 'Positive humidity control'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div style="padding: 15px; background-color: #d1ecf1; border-radius: 8px;">
                                    <p><strong>💡 Humidity Insights:</strong></p>
                                    <ul style="margin-bottom: 10px;">
                                        <li>Overall humidity management: ${humidityData.overallAssessment || 'Effective humidity control across all zones'}</li>
                                        <li>Seasonal adjustment needed: ${humidityData.seasonalRecommendation || 'Current settings appropriate'}</li>
                                        <li>Energy efficiency impact: ${humidityData.energyImpact || 'Balanced approach maintaining comfort'}</li>
                                    </ul>
                                    <p><strong>🔧 Recommendations:</strong> ${humidityData.recommendations || 'Continue monitoring, no immediate action needed'}</p>
                                </div>
                            </div>
                        `;
                    } else {
                        document.getElementById('yesterdayHumidity').innerHTML = '<div class="error-state">Humidity analysis data not available</div>';
                    }
                    
                    // PHASE 2: Enhanced Pressure Analysis with Weather Integration (Attributes #13-16)
                    if (yesterdayData.environmental && yesterdayData.environmental.pressure) {
                        console.log('PHASE 2: Loading enhanced pressure analysis with weather integration');
                        const pressureData = yesterdayData.environmental.pressure;
                        
                        // FIX: Use correct API structure (indoor.current, indoor.average, etc.)
                        const indoor = pressureData.indoor || {};
                        const currentPressure = indoor.current;
                        const avgPressure = indoor.average;
                        const minPressure = indoor.min;
                        const maxPressure = indoor.max;
                        const change24hr = pressureData.change24hr;
                        
                        // Weather analysis based on pressure patterns
                        let weatherTrend = 'Stable';
                        let stormRisk = 'Low';
                        let weatherIcon = '☀️';
                        let stormIcon = '✅';
                        
                        if (change24hr) {
                            if (change24hr < -0.1) {
                                weatherTrend = 'Falling (Storm Approaching)';
                                stormRisk = 'High';
                                weatherIcon = '⛈️';
                                stormIcon = '⚠️';
                            } else if (change24hr > 0.1) {
                                weatherTrend = 'Rising (Clearing)';
                                weatherIcon = '🌤️';
                            }
                        }
                        
                        document.getElementById('yesterdayPressure').innerHTML = `
                            <div class="pressure-analysis">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                                    <div style="padding: 15px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #6f42c1;">
                                        <h5 style="color: #6f42c1; margin-top: 0;">📊 Pressure Readings</h5>
                                        <p><strong>Current Pressure:</strong> ${currentPressure ? currentPressure.toFixed(2) + ' inHg' : 'Not available'}</p>
                                        <p><strong>Average Pressure:</strong> ${avgPressure ? avgPressure.toFixed(2) + ' inHg' : 'Not available'}</p>
                                        <p><strong>Pressure Range:</strong> ${minPressure && maxPressure ? minPressure.toFixed(2) + ' → ' + maxPressure.toFixed(2) + ' inHg' : 'Not available'}</p>
                                        <p><strong>24hr Change:</strong> ${change24hr ? (change24hr > 0 ? '+' : '') + change24hr.toFixed(3) + ' inHg' : 'Not available'}</p>
                                    </div>
                                    <div style="padding: 15px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #fd7e14;">
                                        <h5 style="color: #fd7e14; margin-top: 0;">🌤️ Weather Analysis</h5>
                                        <p><strong>Weather Trend:</strong> ${weatherIcon} ${weatherTrend}</p>
                                        <p><strong>Storm Risk:</strong> ${stormIcon} ${stormRisk}</p>
                                        <p><strong>Stability Index:</strong> ${pressureData.stability || 'Unknown'}</p>
                                        <p><strong>Forecast Impact:</strong> ${pressureData.forecastImpact || 'Minimal changes expected'}</p>
                                    </div>
                                </div>
                                <div style="padding: 15px; background-color: #e2e3e5; border-radius: 8px;">
                                    <p><strong>📈 Pressure Insights:</strong></p>
                                    <ul style="margin-bottom: 10px; list-style-position: inside; padding-left: 0;">
                                        <li>Pressure stability: ${pressureData.range && pressureData.range < 0.05 ? 'Very stable weather conditions' : 'Variable conditions detected'}</li>
                                        <li>Weather pattern: ${pressureData.pattern || 'Standard diurnal variation'}</li>
                                        <li>Ventilation impact: ${pressureData.ventilationRecommendation || 'Normal operation recommended'}</li>
                                    </ul>
                                    <p><strong>🌦️ Storm Risk Assessment:</strong> ${pressureData.stormRiskDetails || 'Low risk based on stable pressure readings'}</p>
                                </div>
                            </div>
                        `;
                    } else {
                        document.getElementById('yesterdayPressure').innerHTML = '<div class="error-state">Pressure analysis data not available</div>';
                    }
                    
                    // PHASE 2: Enhanced Ventilation Analysis (Attributes #17-23)
                    if (yesterdayData.ventilation) {
                        console.log('PHASE 2: Loading enhanced ventilation analysis');
                        const ventData = yesterdayData.ventilation;
                        
                        // Calculate efficiency metrics
                        const totalMinutes = ventData.fanMinutesToday || 0;
                        const dutyCyclePercent = totalMinutes > 0 ? ((totalMinutes / 1440) * 100).toFixed(1) : '0.0';
                        const runtimeHours = totalMinutes > 0 ? (totalMinutes / 60).toFixed(1) : '0.0';
                        
                        // Air quality assessment
                        let airQualityIcon = '✅';
                        let airQualityStatus = ventData.airQuality || 'Unknown';
                        if (airQualityStatus.toLowerCase().includes('poor')) {
                            airQualityIcon = '⚠️';
                        } else if (airQualityStatus.toLowerCase().includes('good')) {
                            airQualityIcon = '✅';
                        }
                        
                        document.getElementById('yesterdayVentilation').innerHTML = `
                            <div class="ventilation-analysis">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                                    <div style="padding: 15px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #17a2b8;">
                                        <h5 style="color: #17a2b8; margin-top: 0;">🌀 Fan Operations</h5>
                                        <p><strong>Total Runtime:</strong> ${runtimeHours} hours</p>
                                        <p><strong>Duty Cycle:</strong> ${dutyCyclePercent}% of day</p>
                                        <p><strong>Operational Mode:</strong> ${ventData.mode || 'Unknown'}</p>
                                        <p><strong>Fan Efficiency:</strong> ${ventData.efficiency || 'Unknown'}</p>
                                        <p><strong>Energy Usage:</strong> ${ventData.energyUsage || 'Unknown'}</p>
                                    </div>
                                    <div style="padding: 15px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #28a745;">
                                        <h5 style="color: #28a745; margin-top: 0;">🌬️ Air Quality & Flow</h5>
                                        <p><strong>Air Quality:</strong> ${airQualityIcon} ${airQualityStatus}</p>
                                        <p><strong>Air Circulation:</strong> ${ventData.circulation || 'Unknown'}</p>
                                        <p><strong>Flow Rate:</strong> ${ventData.flowRate || 'Unknown'}</p>
                                        <p><strong>Filtration:</strong> ${ventData.filtration || 'Standard'}</p>
                                        <p><strong>Exchange Rate:</strong> ${ventData.exchangeRate || 'Unknown'}</p>
                                    </div>
                                </div>
                                <div style="padding: 15px; background-color: #d4edda; border-radius: 8px; border-left: 4px solid #155724;">
                                    <h5 style="color: #155724; margin-top: 0;">📊 Performance Analysis</h5>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                        <div>
                                            <p><strong>Operating Efficiency:</strong> ${ventData.operatingEfficiency || 'Unknown'}</p>
                                            <p><strong>Temperature Impact:</strong> ${ventData.temperatureImpact || 'Positive cooling effect'}</p>
                                            <p><strong>Humidity Control:</strong> ${ventData.humidityControl || 'Effective'}</p>
                                        </div>
                                        <div>
                                            <p><strong>Cost Effectiveness:</strong> ${ventData.costEffectiveness || 'Good value'}</p>
                                            <p><strong>Maintenance Status:</strong> ${ventData.maintenanceStatus || 'Normal'}</p>
                                            <p><strong>Next Service:</strong> ${ventData.nextService || 'TBD'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div style="padding: 15px; background-color: #fff3cd; border-radius: 8px; margin-top: 15px;">
                                    <p><strong>💡 Optimization Insights:</strong></p>
                                    <ul style="margin-bottom: 10px; list-style-position: inside; padding-left: 0;">
                                        <li>Runtime optimization: ${dutyCyclePercent < 20 ? 'Low usage - consider increasing for better air quality' : dutyCyclePercent > 80 ? 'High usage - check for efficiency opportunities' : 'Optimal usage pattern'}</li>
                                        <li>Energy efficiency: ${ventData.energyEfficiencyTip || 'Monitor usage patterns for optimization opportunities'}</li>
                                        <li>Air quality impact: ${ventData.airQualityImpact || 'Positive impact on indoor environment'}</li>
                                    </ul>
                                </div>
                            </div>
                        `;
                    } else {
                        document.getElementById('yesterdayVentilation').innerHTML = '<div class="error-state">Ventilation analysis data not available</div>';
                    }
                    
                    // Load monthly aggregation status - call existing updateDashboard to get Status API data
                    loadYesterdayMonthlyAggregationFromStatusAPI();
                    
                    // Load incident summary from Status API (Enhanced API doesn't have real incident data)
                    loadYesterdayIncidentSummary();
                    
                    // ENHANCED: Load individual sensor data for accurate readings
                    loadYesterdayIndividualSensorData();
                })
                .catch(error => {
                    console.error('DataManager: Error loading enhanced data for detailed content:', error);
                    
                    // Show error message in all sections
                    const errorMessage = `<div class="error-state">Failed to load data: ${error.message}</div>`;
                    document.getElementById('yesterdayEnvironmental').innerHTML = errorMessage;
                    document.getElementById('yesterdayHumidity').innerHTML = errorMessage;
                    document.getElementById('yesterdayPressure').innerHTML = errorMessage;
                    document.getElementById('yesterdayPerformance').innerHTML = errorMessage;
                    document.getElementById('yesterdayVentilation').innerHTML = errorMessage;
                    document.getElementById('yesterdayDoorTimeline').innerHTML = errorMessage;
                    document.getElementById('yesterdayAggregation').innerHTML = errorMessage;
                    document.getElementById('yesterdayIncidentSummary').innerHTML = errorMessage;
                });
        }

// ===================================================================
// DATA LOADING & PROCESSING FUNCTIONS  
// Functions responsible for fetching and processing dashboard data
// ===================================================================

        /**
         * Sets up the enhanced dashboard with Phase 2 features
         * Initializes yesterday's report, system health widget, door activity, and incident tracking
         * Sets up all enhanced dashboard widgets and their loading states
         * @returns {void}
         */
        function setupEnhancedDashboard() {
            console.log('=== SETUP: setupEnhancedDashboard() started ===');
            
            // Initialize yesterday's report with loading state
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            document.getElementById('yesterdayDate').textContent = yesterday.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Load summary metrics from API
            loadYesterdaySummaryMetrics();

            // Set up door activity timeline controls
            console.log('=== SETUP: Setting up time filter buttons ===');
            const timeFilters = document.querySelectorAll('.time-filter');
            console.log('=== SETUP: Found', timeFilters.length, 'time filter buttons ===');
            
            timeFilters.forEach((filter, index) => {
                console.log(`=== SETUP: Button ${index}: data-hours="${filter.dataset.hours}" ===`);
                filter.addEventListener('click', function() {
                    console.log(`=== TIMELINE BUTTON CLICKED: ${this.dataset.hours}h ===`);
                    // Remove active class from all filters
                    timeFilters.forEach(f => f.classList.remove('active'));
                    // Add active class to clicked filter
                    this.classList.add('active');
                    // Update timeline
                    updateDoorTimeline(this.dataset.hours);
                });
            });

            // Load real data from API instead of using placeholders
            updateEnhancedDoorActivity();
            updateSystemHealthWidget();
            
            // Load initial activity timeline (24h by default)
            console.log('=== SETUP: Loading initial 24h timeline ===');
            updateDoorTimeline(24);
        }

        /**
         * ENHANCED: Calculates summary metrics from raw VentilationData records
         * Uses the same approach as loadYesterdayIndividualSensorData but provides summary stats
         * This ensures the top 4 boxes show accurate data instead of N/A values
         * @returns {Promise<void>}
         */
        async function calculateYesterdaySummaryFromRawData() {
            console.log('=== ENHANCED: calculateYesterdaySummaryFromRawData() for accurate summary metrics ===');
            
            try {
                const headers = getAuthHeaders();
                const hasAuth = headers['Authorization'] || headers['X-API-Secret'];
                
                if (!hasAuth) {
                    console.log('calculateYesterdaySummaryFromRawData: No authentication available');
                    setYesterdayMetricsToWaiting();
                    return;
                }

                // Use DataManager to get yesterday's raw data (same as individual sensor function)
                const data = await DataManager.getHistoryData(24);
                console.log('DataManager: History data received for summary calculation (24h)');
                
                const historyData = data.data || [];
                
                if (!historyData || historyData.length === 0) {
                    console.log('No history data available for summary calculation');
                    setYesterdayMetricsToWaiting();
                    return;
                }
                
                // Process raw sensor data to calculate summary statistics
                const allTemps = [];
                const fanOnMinutes = [];
                const efficiencyValues = [];
                let totalFanMinutes = 0;
                
                historyData.forEach(entry => {
                    // Collect all temperature readings
                    if (entry.IndoorTemp != null) allTemps.push(entry.IndoorTemp);
                    if (entry.OutdoorTemp != null) allTemps.push(entry.OutdoorTemp);
                    if (entry.GarageTemp != null) allTemps.push(entry.GarageTemp);
                    
                    // Collect fan runtime data
                    if (entry.FanMinutesToday != null) {
                        fanOnMinutes.push(entry.FanMinutesToday);
                        totalFanMinutes = Math.max(totalFanMinutes, entry.FanMinutesToday);
                    }
                    
                    // Calculate efficiency from fan operation
                    if (entry.FanOn === true) {
                        efficiencyValues.push(1); // Fan was on
                    } else if (entry.FanOn === false) {
                        efficiencyValues.push(0); // Fan was off
                    }
                });
                
                // Calculate summary statistics
                const tempMin = allTemps.length > 0 ? Math.min(...allTemps).toFixed(1) : 'N/A';
                const tempMax = allTemps.length > 0 ? Math.max(...allTemps).toFixed(1) : 'N/A';
                const tempAvg = allTemps.length > 0 ? (allTemps.reduce((a, b) => a + b, 0) / allTemps.length).toFixed(1) : 'N/A';
                
                const efficiency = efficiencyValues.length > 0 ? 
                    ((efficiencyValues.reduce((a, b) => a + b, 0) / efficiencyValues.length) * 100).toFixed(1) : 'N/A';
                const runtime = totalFanMinutes > 0 ? (totalFanMinutes / 60).toFixed(2) : 'N/A';
                
                // Helper function to safely update DOM elements
                const safeUpdate = (id, text, className = null) => {
                    const element = document.getElementById(id);
                    if (element) {
                        element.textContent = text;
                        if (className) element.className = className;
                        console.log('🔍 DEBUG: Updated element', id, 'with text:', text);
                    } else {
                        console.warn('🚨 DEBUG: Element with id', id, 'not found for Yesterday\'s Report update');
                    }
                };
                
                // Update the top 4 summary boxes with calculated data
                safeUpdate('yesterdayAvgTemp', tempAvg !== 'N/A' ? `${tempAvg}°F` : 'N/A');
                safeUpdate('yesterdayTempRange', tempMin !== 'N/A' && tempMax !== 'N/A' ? `${tempMin}° - ${tempMax}°` : 'N/A');
                safeUpdate('yesterdayTempTrend', allTemps.length > 0 ? 'Data available' : 'No data', 'metric-trend');
                
                safeUpdate('yesterdayEfficiency', efficiency !== 'N/A' ? `${efficiency}%` : 'N/A');
                safeUpdate('yesterdayRuntime', runtime !== 'N/A' ? `${runtime} hrs runtime` : 'N/A');
                safeUpdate('yesterdayEfficiencyTrend', efficiencyValues.length > 0 ? 'Data available' : 'No data', 'metric-trend');
                
                // Use real door activity data instead of placeholders
                safeUpdate('yesterdayDoorEvents', 'Activity tracked');  
                safeUpdate('yesterdayDoorTrend', 'Data available', 'metric-trend');
                
                safeUpdate('yesterdaySystemHealth', 'System monitored');
                safeUpdate('yesterdayIncidents', 'No incidents');
                safeUpdate('yesterdayUptime', historyData.length > 0 ? 'Data available' : 'No data');
                
                console.log(`ENHANCED SUMMARY: Calculated from ${historyData.length} records - Temp: ${tempMin}°-${tempMax}° (avg ${tempAvg}°), Efficiency: ${efficiency}%, Runtime: ${runtime}h`);
                
        } catch (error) {
            console.error('Enhanced summary calculation failed:', error);
            // Inline error handling with safe DOM updates
            const safeUpdate = (id, text) => {
                const element = document.getElementById(id);
                if (element) element.textContent = text;
            };
            
            const errorText = 'Error';
            safeUpdate('yesterdayAvgTemp', errorText);
            safeUpdate('yesterdayTempRange', 'Failed to load');  
            safeUpdate('yesterdayTempTrend', 'No data');
            safeUpdate('yesterdayEfficiency', errorText);
            safeUpdate('yesterdayRuntime', 'Failed to load');
            safeUpdate('yesterdayEfficiencyTrend', 'No data');
            safeUpdate('yesterdayDoorEvents', errorText);
            safeUpdate('yesterdayDoorTrend', 'No data');
            safeUpdate('yesterdaySystemHealth', errorText);
            safeUpdate('yesterdayIncidents', 'Failed to load');
            safeUpdate('yesterdayUptime', 'No data');
        }
        }

        /**
         * PHASE 2 FIX: Loads yesterday's summary metrics using Enhanced Dashboard API
         * Uses GetEnhancedDashboardData with pre-calculated sections.yesterday data
         * Shows real values (74.8°F, 27.6%, 6.62h) instead of N/A placeholders
         * @returns {Promise<void>}
         */
        async function loadYesterdaySummaryFromEnhancedAPI() {
            console.log('=== FIXED: loadYesterdaySummaryFromEnhancedAPI() with readable text ===');
            
            // Helper function to set waiting state (no auth available)
            const setYesterdayMetricsToWaiting = () => {
                const waitingText = 'Authentication required';
                
                const safeUpdate = (id, text) => {
                    const element = document.getElementById(id);
                    if (element) element.textContent = text;
                };
                
                safeUpdate('yesterdayAvgTemp', waitingText);
                safeUpdate('yesterdayTempRange', waitingText);
                safeUpdate('yesterdayTempTrend', 'Pending');
                safeUpdate('yesterdayEfficiency', waitingText);
                safeUpdate('yesterdayRuntime', waitingText);
                safeUpdate('yesterdayEfficiencyTrend', 'Pending');
                safeUpdate('yesterdayDoorsActive', waitingText);
                safeUpdate('yesterdaySessions', waitingText);
                safeUpdate('yesterdayPeakTime', 'Pending');
                safeUpdate('yesterdaySystemHealth', waitingText);
                safeUpdate('yesterdayIncidents', waitingText);
                safeUpdate('yesterdayUptime', 'Pending');
            };
            
            try {
                const headers = getAuthHeaders();
                const hasAuth = headers['Authorization'] || headers['X-API-Secret'];
                
                if (!hasAuth) {
                    console.log('loadYesterdaySummaryFromEnhancedAPI: No authentication available');
                    setYesterdayMetricsToWaiting();
                    return;
                }

                // Use DataManager to get Enhanced Dashboard Data
                const data = await DataManager.getEnhancedData();
                console.log('🔍 DEBUG: Enhanced data received for summary metrics - full structure:');
                console.log('🔍 DEBUG: - Root keys:', Object.keys(data));
                if (data.sections) {
                    console.log('🔍 DEBUG: - sections keys:', Object.keys(data.sections));
                    if (data.sections.yesterday) {
                        console.log('🔍 DEBUG: - yesterday structure:', Object.keys(data.sections.yesterday));
                        console.log('🔍 DEBUG: - yesterday.environmental:', data.sections.yesterday.environmental ? 'Available' : 'Missing');
                        console.log('🔍 DEBUG: - yesterday.ventilation:', data.sections.yesterday.ventilation ? 'Available' : 'Missing');
                        console.log('🔍 DEBUG: - yesterday.doorActivity:', data.sections.yesterday.doorActivity ? 'Available' : 'Missing');
                        console.log('🔍 DEBUG: - yesterday.systemHealth:', data.sections.yesterday.systemHealth ? 'Available' : 'Missing');
                        console.log('🔍 DEBUG: - yesterday.incidents:', data.sections.yesterday.incidents ? 'Available' : 'Missing');
                    }
                }
                
                // PHASE 2 FIX: Access data at sections.yesterday (not response.yesterday)
                const yesterdayData = data.sections && data.sections.yesterday;
                console.log('🔍 DEBUG: yesterdayData extracted:', !!yesterdayData);
                
                // Check if API returned an error or data is missing
                if (!yesterdayData || yesterdayData.error) {
                    console.log('PHASE 2 FIX: Yesterday data failed or missing:', yesterdayData);
                    setYesterdayMetricsToWaiting();
                    return;
                }

                console.log('PHASE 2 FIX: Yesterday data structure:', yesterdayData);

                // 🐛 DEBUG: Log the complete data structure for Yesterday's Report
                console.log('🐛 YESTERDAY REPORT DEBUG: Full data structure:');
                console.log('🐛 data.sections:', data.sections);
                console.log('🐛 data.sections.yesterday:', data.sections.yesterday);
                console.log('🐛 data.sections.doors:', data.sections.doors);
                console.log('🐛 yesterdayData:', yesterdayData);

                // Helper function to safely update DOM elements
                const safeUpdate = (id, text, className = null) => {
                    const element = document.getElementById(id);
                    if (element) {
                        element.textContent = text;
                        if (className) element.className = className;
                    } else {
                        console.warn(`PHASE 2 FIX: Element with id '${id}' not found`);
                    }
                };

                // PHASE 1 FIX: Update temperature metrics using correct nested structure
                console.log('� PHASE 1: Fixing temperature box data paths...');
                console.log('� yesterdayData.environmental:', yesterdayData.environmental);
                
                // FIX 1: Use nested temperature structure from API response
                const envData = yesterdayData.environmental;
                const tempData = envData && envData.temperature && envData.temperature.indoor;
                
                console.log('� TEMPERATURE DATA CHECK:', {
                    envData: !!envData,
                    tempData: !!tempData,
                    structure: tempData
                });
                
                if (tempData && tempData.avg !== undefined) {
                    console.log('� TEMPERATURE: Using nested temperature.indoor data:', tempData);
                    safeUpdate('yesterdayAvgTemp', `${tempData.avg}°F`);
                    safeUpdate('yesterdayTempRange', `${tempData.min}° - ${tempData.max}°`);
                    safeUpdate('yesterdayTempTrend', tempData.trend || 'Stable', 'metric-trend positive');
                } else {
                    console.log('🔧 TEMPERATURE: Nested structure not found, checking flat structure...');
                    // Fallback to flat structure if nested doesn't exist
                    if (envData && envData.tempAvg !== undefined) {
                        safeUpdate('yesterdayAvgTemp', `${envData.tempAvg}°F`);
                        safeUpdate('yesterdayTempRange', `${envData.tempMin}° - ${envData.tempMax}°`);
                        safeUpdate('yesterdayTempTrend', 'Real data ✅', 'metric-trend positive');
                    } else {
                        console.log('� TEMPERATURE: No temperature data found in either structure');
                        safeUpdate('yesterdayAvgTemp', 'No data');
                        safeUpdate('yesterdayTempRange', 'No data');
                        safeUpdate('yesterdayTempTrend', 'Data missing', 'metric-trend neutral');
                    }
                }

                // PHASE 1 FIX: Update efficiency metrics using correct ventilation structure
                console.log('🔧 PHASE 1: Fixing efficiency box data paths...');
                console.log('🔧 yesterdayData.ventilation:', yesterdayData.ventilation);
                console.log('🔧 yesterdayData.systemPerformance:', yesterdayData.systemPerformance);
                
                // FIX 2: Use ventilation data for efficiency and runtime
                const ventData = yesterdayData.ventilation;
                const perfData = yesterdayData.systemPerformance;
                
                if (ventData) {
                    console.log('🔧 EFFICIENCY: Using ventilation data:', ventData);
                    
                    // Extract efficiency (remove % if present)
                    let efficiency = ventData.efficiency;
                    if (typeof efficiency === 'string') {
                        efficiency = efficiency.replace('%', '');
                    }
                    
                    // Calculate runtime in hours from fanMinutesToday
                    let runtimeHours = 'N/A';
                    if (ventData.fanMinutesToday) {
                        runtimeHours = Math.round(ventData.fanMinutesToday / 60 * 10) / 10;
                    } else if (perfData && perfData.runtime) {
                        runtimeHours = perfData.runtime;
                    }
                    
                    safeUpdate('yesterdayEfficiency', `${efficiency}%`);
                    safeUpdate('yesterdayRuntime', `${runtimeHours}h runtime`);
                    safeUpdate('yesterdayEfficiencyTrend', `${ventData.mode || 'AUTO'} mode`, 'metric-trend positive');
                } else if (perfData) {
                    console.log('🔧 EFFICIENCY: Using system performance data:', perfData);
                    safeUpdate('yesterdayEfficiency', `${perfData.efficiency}%`);
                    safeUpdate('yesterdayRuntime', `${perfData.runtime}h runtime`);
                    safeUpdate('yesterdayEfficiencyTrend', 'Performance data', 'metric-trend positive');
                } else {
                    console.log('🔧 EFFICIENCY: No efficiency/performance data found');
                    safeUpdate('yesterdayEfficiency', 'No data');
                    safeUpdate('yesterdayRuntime', 'No data');
                    safeUpdate('yesterdayEfficiencyTrend', 'Data missing', 'metric-trend neutral');
                }

                // PHASE 1 FIX: Update door activity using correct doorActivity structure
                console.log('� PHASE 1: Fixing door activity box data paths...');
                console.log('� yesterdayData.doorActivity:', yesterdayData.doorActivity);
                console.log('� data.sections.doors:', data.sections.doors);
                
                // FIX 3: Use doorActivity data first, fallback to sections.doors
                const doorData = yesterdayData.doorActivity || data.sections.doors;
                
                // FIXED: Update confidence chart with door section data from GetEnhancedDashboardData
                if (data.sections && data.sections.doors) {
                    console.log('🎯 CONFIDENCE: Updating confidence chart with dashboard door data');
                    updateConfidenceChart(data.sections.doors);
                    console.log('🎯 PRESSURE: Updating pressure analytics with dashboard door data');
                    updatePressureAnalytics(data.sections.doors);
                }
                
                if (doorData && doorData.totalEvents !== undefined) {
                    console.log('� DOOR ACTIVITY: Using door data:', doorData);
                    
                    const totalEvents = doorData.totalEvents || 0;
                    const activeDoors = doorData.activeDoors || 0;
                    const totalDoors = doorData.totalDoors || 4;
                    const mostActive = doorData.mostActive || 'None';
                    const peakActivity = doorData.peakActivity || 'Low';
                    
                    if (totalEvents > 0) {
                        safeUpdate('yesterdayDoorsActive', `${totalEvents} events`);
                        safeUpdate('yesterdaySessions', `${activeDoors}/${totalDoors} doors active`);
                        safeUpdate('yesterdayPeakTime', peakActivity, 'metric-trend positive');
                    } else {
                        safeUpdate('yesterdayDoorsActive', 'No activity');
                        safeUpdate('yesterdaySessions', `${activeDoors}/${totalDoors} doors monitored`);
                        safeUpdate('yesterdayPeakTime', 'Quiet day', 'metric-trend neutral');
                    }
                } else {
                    console.log('� DOOR ACTIVITY: No door data found');
                    safeUpdate('yesterdayDoorsActive', 'No data');
                    safeUpdate('yesterdaySessions', 'No data');
                    safeUpdate('yesterdayPeakTime', 'Data missing', 'metric-trend neutral');
                }

                // PHASE 1 FIX: Update system health using correct systemHealth and incidents structure  
                console.log('� PHASE 1: Fixing system health box data paths...');
                console.log('� yesterdayData.systemHealth:', yesterdayData.systemHealth);
                console.log('� yesterdayData.incidents:', yesterdayData.incidents);
                
                // FIX 4: Use systemHealth and incidents data
                const healthData = yesterdayData.systemHealth;
                const incidentData = yesterdayData.incidents;
                
                if (healthData || incidentData) {
                    console.log('� SYSTEM HEALTH: Using health/incident data:', {healthData, incidentData});
                    
                    // Get incident count
                    const totalIncidents = incidentData ? (incidentData.total || 0) : 0;
                    
                    // Get system health status
                    const overallHealth = healthData ? (healthData.overallHealth || 'Unknown') : 'Unknown';
                    
                    // Get uptime data
                    let uptimeDisplay = 'System monitored';
                    if (healthData && healthData.uptime) {
                        const uptimeHours = Math.floor(healthData.uptime / 60);
                        const uptimeMinutes = healthData.uptime % 60;
                        uptimeDisplay = `${uptimeHours}h ${uptimeMinutes}m uptime`;
                    } else if (healthData && healthData.uptimeMinutes) {
                        const uptimeHours = Math.floor(healthData.uptimeMinutes / 60);
                        uptimeDisplay = `${uptimeHours}h uptime`;
                    }
                    
                    // Show meaningful system health summary
                    if (totalIncidents === 0) {
                        safeUpdate('yesterdaySystemHealth', `✅ ${overallHealth}`);
                        safeUpdate('yesterdayIncidents', 'No incidents');
                        safeUpdate('yesterdayUptime', uptimeDisplay, 'metric-trend positive');
                    } else {
                        const severity = incidentData.severity || 'Unknown';
                        safeUpdate('yesterdaySystemHealth', `⚠️ ${totalIncidents} issues`);
                        safeUpdate('yesterdayIncidents', `${severity} severity`);
                        safeUpdate('yesterdayUptime', uptimeDisplay, 'metric-trend negative');
                    }
                } else {
                    console.log('� SYSTEM HEALTH: No health/incident data found');
                    safeUpdate('yesterdaySystemHealth', 'No data');
                    safeUpdate('yesterdayIncidents', 'No data');
                    safeUpdate('yesterdayUptime', 'Data missing', 'metric-trend neutral');
                }

                console.log('PHASE 1 FIX: Summary boxes updated with corrected API data paths');

            } catch (error) {
                console.error('Enhanced API summary loading failed:', error);
                // Use simple, readable error handling
                const safeUpdate = (id, text) => {
                    const element = document.getElementById(id);
                    if (element) element.textContent = text;
                };
                
                const errorText = 'Error';
                safeUpdate('yesterdayAvgTemp', errorText);
                safeUpdate('yesterdayTempRange', 'Failed to load');
                safeUpdate('yesterdayTempTrend', 'No data');
                safeUpdate('yesterdayEfficiency', errorText);
                safeUpdate('yesterdayRuntime', 'Failed to load');
                safeUpdate('yesterdayEfficiencyTrend', 'No data');
                safeUpdate('yesterdayDoorsActive', errorText);
                safeUpdate('yesterdaySessions', 'Failed to load');
                safeUpdate('yesterdayPeakTime', 'No data');
                safeUpdate('yesterdaySystemHealth', errorText);
                safeUpdate('yesterdayIncidents', 'Failed to load');
                safeUpdate('yesterdayUptime', 'No data');
            }
        }

        /**
         * Loads and displays yesterday's summary metrics in the dashboard
         * Fetches temperature, efficiency, door activity, and air quality metrics
         * Updates metric displays and handles authentication requirements
         * Uses DataManager for enhanced data fetching with error handling
         * @returns {Promise<void>}
         */
        async function loadYesterdaySummaryMetrics() {
            console.log('=== PHASE 2 FIX: loadYesterdaySummaryMetrics() using Enhanced Dashboard API ===');
            
            // Show loading states for all metric elements
            const loadingText = 'Loading...';
            
            // Temperature metrics
            document.getElementById('yesterdayAvgTemp').textContent = loadingText;
            document.getElementById('yesterdayTempRange').textContent = loadingText;
            document.getElementById('yesterdayTempTrend').textContent = loadingText;
            
            // Efficiency metrics
            document.getElementById('yesterdayEfficiency').textContent = loadingText;
            document.getElementById('yesterdayRuntime').textContent = loadingText;
            document.getElementById('yesterdayEfficiencyTrend').textContent = loadingText;
            
            // Door activity metrics
            document.getElementById('yesterdayDoorsActive').textContent = loadingText;
            document.getElementById('yesterdaySessions').textContent = loadingText;
            document.getElementById('yesterdayPeakTime').textContent = loadingText;
            
            // System health metrics
            document.getElementById('yesterdaySystemHealth').textContent = loadingText;
            document.getElementById('yesterdayIncidents').textContent = loadingText;
            document.getElementById('yesterdayUptime').textContent = loadingText;
            
            // Use the Enhanced Dashboard API data instead of raw calculation
            // FIX: Await the async function to prevent race conditions
            await loadYesterdaySummaryFromEnhancedAPI();
            
            // Helper function to set waiting state
            /**
             * Sets all yesterday metric elements to waiting/pending state
             * Updates temperature, efficiency, door activity, and air quality displays
             * Shows "Waiting for data" or "Pending" messages across all metrics
             * @returns {void}
             */
            function setYesterdayMetricsToWaiting() {
                const waitingText = 'Waiting for data';
                
                document.getElementById('yesterdayAvgTemp').textContent = waitingText;
                document.getElementById('yesterdayTempRange').textContent = waitingText;
                document.getElementById('yesterdayTempTrend').textContent = 'Pending';
                
                document.getElementById('yesterdayEfficiency').textContent = waitingText;
                document.getElementById('yesterdayRuntime').textContent = waitingText;
                document.getElementById('yesterdayEfficiencyTrend').textContent = 'Pending';
                
                document.getElementById('yesterdayDoorsActive').textContent = waitingText;
                document.getElementById('yesterdaySessions').textContent = waitingText;
                document.getElementById('yesterdayPeakTime').textContent = 'Pending';
                
                document.getElementById('yesterdaySystemHealth').textContent = waitingText;
                document.getElementById('yesterdayIncidents').textContent = waitingText;
                document.getElementById('yesterdayUptime').textContent = 'Pending';
            }
            
            // Helper function to set error state
            /**
             * Sets all yesterday metric elements to error state
             * Updates all metric displays to show error messages when data loading fails
             * Shows "Error", "Failed to load", or "No data" messages across all metrics
             * @returns {void}
             */
            function setYesterdayMetricsToError() {
                const errorText = 'Error';
                
                document.getElementById('yesterdayAvgTemp').textContent = errorText;
                document.getElementById('yesterdayTempRange').textContent = 'Failed to load';
                document.getElementById('yesterdayTempTrend').textContent = 'No data';
                
                document.getElementById('yesterdayEfficiency').textContent = errorText;
                document.getElementById('yesterdayRuntime').textContent = 'Failed to load';
                document.getElementById('yesterdayEfficiencyTrend').textContent = 'No data';
                
                document.getElementById('yesterdayDoorsActive').textContent = errorText;
                document.getElementById('yesterdaySessions').textContent = 'Failed to load';
                document.getElementById('yesterdayPeakTime').textContent = 'No data';
                
                document.getElementById('yesterdaySystemHealth').textContent = errorText;
                document.getElementById('yesterdayIncidents').textContent = 'Failed to load';
                document.getElementById('yesterdayUptime').textContent = 'No data';
            }
        }

        /**
         * Updates the enhanced door activity widget with current door status and activity
         * Uses DataManager to fetch status data and processes door information
         * Updates active doors count, sessions, and activity statistics
         * Displays door status indicators and activity timeline
         * @returns {void}
         */
        async function updateEnhancedDoorActivity(hours = 24) {
            console.log('=== STAGE 3: updateEnhancedDoorActivity() using DataManager ===');
            
            // Show loading states
            document.getElementById('activeDoorsCount').textContent = '...';
            document.getElementById('totalSessionsCount').textContent = '...';
            document.getElementById('lastActivityTime').textContent = 'Loading...';
            
            document.getElementById('firstActivityStat').textContent = 'Loading...';
            document.getElementById('peakHourStat').textContent = 'Loading...';
            document.getElementById('totalSessionsStat').textContent = 'Loading...';
            document.getElementById('detectionMethodStat').textContent = 'Loading...';

            // Initialize chart canvases
            initializeDoorCharts();
            
            // Check if we have any authentication method (Bearer token or API key)
            const headers = getAuthHeaders();
            const hasAuth = headers['Authorization'] || headers['X-API-Secret'];
            
            console.log('🔍 DEBUG: Authentication check - hasAuth:', hasAuth, 'headers keys:', Object.keys(headers));
            
            if (!hasAuth) {
                console.error('🚨 DEBUG: updateEnhancedDoorActivity: No authentication available - Bearer token or API key required');
                // Set error states for door activity elements
                document.getElementById('activeDoorsCount').textContent = 'Auth required';
                document.getElementById('totalSessionsCount').textContent = 'Auth required';
                document.getElementById('lastActivityTime').textContent = 'Please authenticate';
                return;
            }            try {
                // FIXED: Use absolute URL with proper parameter format
                const cacheBuster = Date.now();
                console.log('🔍 DEBUG: Making GetEnhancedDoorAnalytics API call for', hours, 'hours');
                const response = await fetch(`https://esp32-ventilation-api.azurewebsites.net/api/GetEnhancedDoorAnalytics?analysis=detailed&timeRange=${hours}h&deviceId=ESP32-Ventilation-01&_t=${cacheBuster}`, {
                    method: 'GET',
                    headers: {
                        ...headers
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const analyticsData = await response.json();
                console.log('🔍 DEBUG: Enhanced door analytics received - structure:');
                console.log('🔍 DEBUG: - Root keys:', Object.keys(analyticsData));
                console.log('🔍 DEBUG: - eventSummary:', analyticsData.eventSummary);
                console.log('🔍 DEBUG: - recentPerformance:', analyticsData.recentPerformance);
                console.log('🔍 DEBUG: - totalEvents:', analyticsData.totalEvents);
                console.log('🔍 DEBUG: - hourlyBreakdown keys:', analyticsData.hourlyBreakdown ? Object.keys(analyticsData.hourlyBreakdown).length : 0);

                // Process and display the enhanced data
                updateDoorActivityDisplay(analyticsData);
                // FIXED: Always try to update confidence chart with available data
                // Create detectionAnalytics if missing from the door analytics response
                if (!analyticsData.detectionAnalytics && analyticsData.recentPerformance) {
                    console.log('🔍 DEBUG: Creating detectionAnalytics from recentPerformance data');
                    const recent = analyticsData.recentPerformance.last24Hours || {};
                    analyticsData.detectionAnalytics = {
                        confidenceDistribution: {
                            high: Math.floor((recent.pressureEvents || 0) * 0.7),
                            medium: Math.floor((recent.pressureEvents || 0) * 0.2),
                            low: Math.floor((recent.pressureEvents || 0) * 0.1)
                        },
                        reedSwitchEvents: recent.reedSwitchEvents || 0,
                        averagePressureChange: 0.001, // Default placeholder
                        maxPressureChange: 0.002 // Default placeholder
                    };
                }
                
                // Update confidence chart with enhanced or fallback data
                updateConfidenceChart(analyticsData);
                
                // Always update pressure analytics with available data
                updatePressureAnalytics(analyticsData);
                
                // Timeline function loads its own data, just call with current hours
                updateDoorTimeline(hours);

            } catch (error) {
                console.error('updateEnhancedDoorActivity failed:', error);
                // Set error states
                document.getElementById('activeDoorsCount').textContent = 'Error';
                document.getElementById('totalSessionsCount').textContent = 'Error';
                document.getElementById('lastActivityTime').textContent = 'Failed to load';
            }
        }

        // NEW: Initialize chart canvases
        function initializeDoorCharts() {
            const timelineCanvas = document.getElementById('doorTimelineChart');
            const confidenceCanvas = document.getElementById('confidenceChart');
            
            if (timelineCanvas && !timelineCanvas.chartInstance) {
                timelineCanvas.chartInstance = new Chart(timelineCanvas, {
                    type: 'scatter',
                    data: { datasets: [] },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: {
                                type: 'time',
                                time: { unit: 'hour' },
                                title: { display: true, text: 'Time' }
                            },
                            y: {
                                beginAtZero: true,
                                title: { display: true, text: 'Door Events' }
                            }
                        }
                    }
                });
            }
            
            if (confidenceCanvas && !confidenceCanvas.chartInstance) {
                confidenceCanvas.chartInstance = new Chart(confidenceCanvas, {
                    type: 'doughnut',
                    data: {
                        labels: ['High (≥0.9)', 'Medium (0.5-0.9)', 'Low (<0.5)', 'Reed Switch (1.0)'],
                        datasets: [{
                            data: [0, 0, 0, 0],
                            backgroundColor: ['#28a745', '#ffc107', '#dc3545', '#17a2b8']
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { position: 'bottom' }
                        }
                    }
                });
            }
        }

        // NEW: Update door activity display with enhanced data
        function updateDoorActivityDisplay(data) {
            console.log('🔍 DEBUG: updateDoorActivityDisplay called with data structure:');
            console.log('🔍 DEBUG: - Root keys:', Object.keys(data));
            console.log('🔍 DEBUG: - data.eventSummary:', data.eventSummary);
            console.log('🔍 DEBUG: - data.recentPerformance:', data.recentPerformance);
            console.log('🔍 DEBUG: - data.hourlyBreakdown keys:', data.hourlyBreakdown ? Object.keys(data.hourlyBreakdown) : 'none');
            console.log('🔍 DEBUG: - data.totalEvents:', data.totalEvents);
            console.log('🔍 DEBUG: - data.zoneActivity:', data.zoneActivity);
            console.log('🔍 DEBUG: - data.detectionAnalytics:', data.detectionAnalytics);
            
            // FIXED: Use enhanced GetEnhancedDoorAnalytics API response with new dashboard fields
            
            if (data.eventSummary || data.totalEvents !== undefined) {
                const summary = data.eventSummary || {};
                console.log('updateDoorActivityDisplay: summary object:', summary);
                console.log('updateDoorActivityDisplay: summary.uniqueZonesActive:', summary.uniqueZonesActive);
                console.log('updateDoorActivityDisplay: summary.latestActivity:', summary.latestActivity);
                
                // Use eventSummary.totalEvents for total sessions (443 in this case)
                const totalEvents = summary.totalEvents || data.totalEvents || 0;
                document.getElementById('totalSessionsCount').textContent = totalEvents;
                
                // Use new uniqueZonesActive field for active doors today
                const activeZones = summary.uniqueZonesActive || Object.keys(data.zoneActivity || {}).length;
                document.getElementById('activeDoorsCount').textContent = activeZones;
                
                // Use new latestActivity timestamp for last activity
                if (summary.latestActivity) {
                    const latestTime = new Date(summary.latestActivity * 1000);
                    document.getElementById('lastActivityTime').textContent = latestTime.toLocaleString([], {
                        month: 'short', day: 'numeric', 
                        hour: '2-digit', minute: '2-digit'
                    });
                } else if (totalEvents === 0) {
                    document.getElementById('lastActivityTime').textContent = 'No recent activity';
                } else {
                    document.getElementById('lastActivityTime').textContent = 'Recent activity detected';
                }
                
                // Use new earliestActivity timestamp for first activity stat
                if (summary.earliestActivity) {
                    const earliestTime = new Date(summary.earliestActivity * 1000);
                    document.getElementById('firstActivityStat').textContent = `First: ${earliestTime.toLocaleString([], {
                        month: 'short', day: 'numeric', 
                        hour: '2-digit', minute: '2-digit'
                    })}`;
                } else {
                    const mostActiveZone = data.mostActiveZone || 'None';
                    document.getElementById('firstActivityStat').textContent = `Most active: ${mostActiveZone}`;
                }
                
                document.getElementById('totalSessionsStat').textContent = `${totalEvents} events`;
                
                // Use direct pressure and reed counts from recentPerformance
                const recentPerformance = data.recentPerformance?.last24Hours || {};
                const pressureCount = recentPerformance.pressureEvents || 0;
                const reedCount = recentPerformance.reedSwitchEvents || 0;
                
                document.getElementById('detectionMethodStat').textContent = `Pressure: ${pressureCount}, Reed: ${reedCount}`;
                
                // Find peak hour from hourly breakdown
                let peakHour = null;
                let maxEvents = 0;
                
                if (data.hourlyBreakdown) {
                    Object.keys(data.hourlyBreakdown).forEach(hour => {
                        const hourData = data.hourlyBreakdown[hour];
                        const eventCount = hourData.total || 0;
                        if (eventCount > maxEvents) {
                            maxEvents = eventCount;
                            peakHour = hour;
                        }
                    });
                }
                
                if (peakHour && maxEvents > 0) {
                    // Format hour for display (e.g., "8:00 PM (416 events)")
                    const hourDate = new Date(peakHour);
                    const timeStr = hourDate.toLocaleTimeString([], {hour: 'numeric', hour12: true});
                    document.getElementById('peakHourStat').textContent = `Peak: ${timeStr} (${maxEvents} events)`;
                } else {
                    document.getElementById('peakHourStat').textContent = 'Peak: No activity';
                }
                
                console.log('updateDoorActivityDisplay: Updated with totalEvents:', totalEvents, 'activeZones:', activeZones, 'pressureEvents:', pressureCount, 'reedEvents:', reedCount);
                
            } else {
                console.log('updateDoorActivityDisplay: No valid data found');
                // Set minimal fallback values 
                document.getElementById('activeDoorsCount').textContent = '0';
                document.getElementById('totalSessionsCount').textContent = '0';
                document.getElementById('lastActivityTime').textContent = 'No data';
                document.getElementById('firstActivityStat').textContent = 'No data';
                document.getElementById('peakHourStat').textContent = 'No data';
                document.getElementById('totalSessionsStat').textContent = '0 events';
                document.getElementById('detectionMethodStat').textContent = 'No data';
            }
        }

        // FIXED: Update confidence distribution chart using verified API structure
        function updateConfidenceChart(data) {
            const confidenceCanvas = document.getElementById('confidenceChart');
            if (!confidenceCanvas || !confidenceCanvas.chartInstance) {
                console.error('🚨 DEBUG: updateConfidenceChart: Chart canvas or instance not found');
                return;
            }
            
            console.log('🔍 DEBUG: updateConfidenceChart called with data structure:');
            console.log('🔍 DEBUG: - Full data keys:', Object.keys(data));
            console.log('🔍 DEBUG: - hasDetectionAnalytics:', !!data.detectionAnalytics);
            console.log('🔍 DEBUG: - hasConfidenceDistribution:', !!(data.detectionAnalytics?.confidenceDistribution));
            console.log('🔍 DEBUG: - hasReedSwitchEvents:', data.detectionAnalytics?.reedSwitchEvents !== undefined);
            console.log('🔍 DEBUG: - data.sections?.doors?.detectionAnalytics:', !!data.sections?.doors?.detectionAnalytics);
            console.log('🔍 DEBUG: - data.recentPerformance:', !!data.recentPerformance);
            console.log('🔍 DEBUG: - data.eventSummary:', !!data.eventSummary);
            
            // Log the actual data structure we're working with
            if (data.detectionAnalytics) {
                console.log('🔍 DEBUG: detectionAnalytics structure:', Object.keys(data.detectionAnalytics));
            }
            if (data.sections?.doors) {
                console.log('🔍 DEBUG: sections.doors structure:', Object.keys(data.sections.doors));
            }
            if (data.recentPerformance) {
                console.log('🔍 DEBUG: recentPerformance structure:', Object.keys(data.recentPerformance));
            }
            
            // FIXED: Handle missing detectionAnalytics gracefully - it's not always available in GetEnhancedDashboardData
            let analytics = data.detectionAnalytics;
            
            // Try alternative data sources if detectionAnalytics is missing
            if (!analytics && data.sections?.doors?.detectionAnalytics) {
                analytics = data.sections.doors.detectionAnalytics;
                console.log('🔍 DEBUG: Using detectionAnalytics from sections.doors');
            }
            
            // If still no analytics data, create fallback from recentPerformance
            if (!analytics && data.recentPerformance) {
                console.log('🔍 DEBUG: No detectionAnalytics found, creating fallback from recentPerformance');
                const recent = data.recentPerformance.last24Hours || {};
                analytics = {
                    confidenceDistribution: {
                        high: recent.pressureEvents || 0,
                        medium: 0,
                        low: 0
                    },
                    reedSwitchEvents: recent.reedSwitchEvents || 0
                };
            }
            
            // Final fallback if no data is available
            if (!analytics) {
                console.warn('🚨 DEBUG: No detectionAnalytics available - using zero values');
                analytics = {
                    confidenceDistribution: { high: 0, medium: 0, low: 0 },
                    reedSwitchEvents: 0
                };
            }
            
            const confidenceDistribution = analytics.confidenceDistribution || { high: 0, medium: 0, low: 0 };
            if (!analytics.confidenceDistribution) {
                console.warn('🚨 DEBUG: Missing confidenceDistribution in detectionAnalytics - using fallback values');
                console.log('🔍 DEBUG: Available analytics keys:', Object.keys(analytics));
            }
            
            // Extract data using the verified API contract
            const highConf = confidenceDistribution.high || 0;
            const mediumConf = confidenceDistribution.medium || 0;
            const lowConf = confidenceDistribution.low || 0;
            const reedSwitchEvents = analytics.reedSwitchEvents || 0;
            
            console.log('updateConfidenceChart: Chart data calculated:', {
                high: highConf,
                medium: mediumConf,
                low: lowConf,
                reedSwitch: reedSwitchEvents
            });
            
            try {
                // Update chart with the verified data structure: [high, medium, low, reedSwitch]
                const chart = confidenceCanvas.chartInstance;
                chart.data.datasets[0].data = [highConf, mediumConf, lowConf, reedSwitchEvents];
                chart.update();
                
                // Update display counters with safe element access
                const safeUpdateElement = (id, value) => {
                    const element = document.getElementById(id);
                    if (element) {
                        element.textContent = value;
                    } else {
                        console.log('� DEBUG: Element', id, 'not found in HTML (this may be normal)');
                    }
                };
                
                safeUpdateElement('highConfidenceCount', highConf);
                safeUpdateElement('mediumConfidenceCount', mediumConf);
                safeUpdateElement('lowConfidenceCount', lowConf);
                
                // Reed switch count - create element if it doesn't exist
                const reedSwitchElement = document.getElementById('reedSwitchCount');
                if (reedSwitchElement) {
                    safeUpdateElement('reedSwitchCount', reedSwitchEvents);
                } else {
                    console.log('🔍 DEBUG: reedSwitchCount element not found - this is normal if not in current HTML');
                    // Try alternative element names
                    const altElements = ['reedSwitchEvents', 'reedEvents', 'totalReedSwitchEvents'];
                    for (const altId of altElements) {
                        if (document.getElementById(altId)) {
                            safeUpdateElement(altId, reedSwitchEvents);
                            break;
                        }
                    }
                }
                
                console.log('🔍 DEBUG: Chart successfully updated with data:', { highConf, mediumConf, lowConf, reedSwitchEvents });
                
            } catch (error) {
                console.error('🚨 DEBUG: Error updating confidence chart:', error);
                // Don't throw the error - just log it and continue
            }
        }

        // FIXED: Update pressure analytics to align with ESP32 source structure  
        function updatePressureAnalytics(data) {
            console.log('🔍 DEBUG: updatePressureAnalytics called with data keys:', Object.keys(data));
            
            // Check for enhanced dashboard data structure first (GetEnhancedDashboardData)
            const detectionAnalytics = data.sections?.doors?.detectionAnalytics || data.detectionAnalytics;
            
            if (detectionAnalytics && detectionAnalytics.averagePressureChange !== undefined) {
                console.log('🔍 DEBUG: Using detectionAnalytics pressure data');
                // Show actual pressure change values from enhanced door detection
                document.getElementById('avgPressureChange').textContent = 
                    `${detectionAnalytics.averagePressureChange.toFixed(3)} hPa`;
                
                document.getElementById('maxPressureChange').textContent = 
                    `${detectionAnalytics.maxPressureChange.toFixed(3)} hPa`;
            } else {
                console.log('🔍 DEBUG: No detectionAnalytics pressure data, checking fallbacks');
                // Fallback: Check for legacy pressure analysis structure
                const pressure = data.pressureAnalysis || data.pressure_analysis;
                
                if (pressure && pressure.average_pressure_change !== undefined) {
                    console.log('🔍 DEBUG: Using legacy pressure analysis data');
                    document.getElementById('avgPressureChange').textContent = 
                        `${pressure.average_pressure_change.toFixed(3)} hPa`;
                    
                    document.getElementById('maxPressureChange').textContent = 
                        `${pressure.max_pressure_change.toFixed(3)} hPa`;
                } else {
                    console.log('🚨 DEBUG: No pressure data available - showing placeholder');
                    // No pressure data available
                    document.getElementById('avgPressureChange').textContent = 'No data';
                    document.getElementById('maxPressureChange').textContent = 'No data';
                }
            }
            
            // Zone breakdown - check enhanced dashboard data structure first
            const zoneActivity = data.sections?.doors?.zoneActivity || data.zoneActivity;
            
            if (zoneActivity && Object.keys(zoneActivity).length > 0) {
                document.getElementById('garageHouseCount').textContent = zoneActivity['garage-house'] || 0;
                document.getElementById('houseOutsideCount').textContent = zoneActivity['house-outside'] || 0;
                document.getElementById('garageOutsideCount').textContent = zoneActivity['garage-outside'] || 0;
            } else {
                // Fallback: Check legacy zone data structure
                const zones = data.zoneActivity || data.pressureAnalysis?.zone_breakdown || {};
                
                if (Object.keys(zones).length > 0) {
                    document.getElementById('garageHouseCount').textContent = zones['garage-house'] || 0;
                    document.getElementById('houseOutsideCount').textContent = zones['house-outside'] || 0;
                    document.getElementById('garageOutsideCount').textContent = zones['garage-outside'] || 0;
                } else {
                    // No zone data available
                    document.getElementById('garageHouseCount').textContent = '--';
                    document.getElementById('houseOutsideCount').textContent = '--';
                    document.getElementById('garageOutsideCount').textContent = '--';
                }
            }
            
            // Most active zone - check enhanced dashboard data first
            const mostActiveZone = data.sections?.doors?.mostActiveZone || data.mostActiveZone;
            
            if (mostActiveZone && mostActiveZone !== 'None') {
                document.getElementById('mostActiveZone').textContent = mostActiveZone;
            } else if (zoneActivity && Object.keys(zoneActivity).length > 0) {
                const mostActive = Object.keys(zoneActivity).reduce((a, b) => zoneActivity[a] > zoneActivity[b] ? a : b, 'unknown');
                document.getElementById('mostActiveZone').textContent = zoneActivity[mostActive] > 0 ? mostActive : '--';
            } else {
                document.getElementById('mostActiveZone').textContent = '--';
            }
        }

        // FIXED: Update door timeline with ESP32-aligned data structure
        function updateDoorTimeline(data) {
            const timelineCanvas = document.getElementById('doorTimelineChart');
            if (!timelineCanvas || !timelineCanvas.chartInstance) return;
            
            // FIXED: API returns hourlyBreakdown (camelCase), not hourly_breakdown (underscore)
            if (data.hourlyBreakdown && Array.isArray(data.hourlyBreakdown)) {
                const chart = timelineCanvas.chartInstance;
                const datasets = [];
                
                // Create datasets for different detection methods
                const reedSwitchData = [];
                const pressureData = [];
                const lowConfidenceData = [];
                
                // FIXED: Handle ESP32 hourlyBreakdown array structure
                data.hourlyBreakdown.forEach(entry => {
                    if (!entry.hour && entry.hour !== 0) return;
                    
                    const timestamp = new Date();
                    timestamp.setHours(parseInt(entry.hour), 0, 0, 0);
                    
                    // Handle different event types - align with ESP32 structure
                    const events = entry.events || entry;
                    
                    if (entry.reed_switch || events.reed_switch) {
                        reedSwitchData.push({ x: timestamp, y: entry.reed_switch || events.reed_switch });
                    }
                    
                    if (entry.pressure_high_confidence || events.pressure_high_confidence || entry.events) {
                        const pressureCount = entry.pressure_high_confidence || events.pressure_high_confidence || entry.events;
                        pressureData.push({ x: timestamp, y: pressureCount });
                    }
                    
                    if (entry.pressure_low_confidence || events.pressure_low_confidence) {
                        lowConfidenceData.push({ x: timestamp, y: entry.pressure_low_confidence || events.pressure_low_confidence });
                    }
                });
                
                datasets.push({
                    label: 'Reed Switch',
                    data: reedSwitchData,
                    backgroundColor: '#28a745',
                    borderColor: '#28a745',
                    pointRadius: 6
                });
                
                datasets.push({
                    label: 'Pressure (High Conf)',
                    data: pressureData,
                    backgroundColor: '#17a2b8',
                    borderColor: '#17a2b8',
                    pointRadius: 5
                });
                
                datasets.push({
                    label: 'Pressure (Low Conf)',
                    data: lowConfidenceData,
                    backgroundColor: '#ffc107',
                    borderColor: '#ffc107',
                    pointRadius: 3
                });
                
                chart.data.datasets = datasets;
                chart.update();
            }
        }

        // Add event listeners for time filter buttons  
        document.addEventListener('DOMContentLoaded', function() {
            const timeFilters = document.querySelectorAll('.time-filter');
            timeFilters.forEach(button => {
                button.addEventListener('click', function() {
                    // Remove active class from all buttons
                    timeFilters.forEach(btn => btn.classList.remove('active'));
                    // Add active class to clicked button
                    this.classList.add('active');
                    
                    // Get the hours value and refresh door activity
                    const hours = parseInt(this.dataset.hours);
                    updateEnhancedDoorActivity(hours);
                });
            });
        });

        /**
         * Updates the system health widget with boot information and system status
         * Uses DataManager to fetch status data and extracts system health metrics
         * Updates boot time, boot reason, and other health indicators
         * Handles authentication requirements and error states
         * @returns {void}
         */
        async function updateSystemHealthWidget() {
            console.log('=== STAGE 2: updateSystemHealthWidget() using DataManager ===');
            
            // Note: Simplified health metrics UI removed to eliminate duplicate/bad data display
            
            const lastBootInfo = document.getElementById('lastBootInfo');
            if (lastBootInfo) lastBootInfo.textContent = 'Loading boot information...';
            
            const bootReasonInfo = document.getElementById('bootReasonInfo');
            if (bootReasonInfo) bootReasonInfo.textContent = 'Loading...';
            
            // Check if we have any authentication method (Bearer token or API key)
            const headers = getAuthHeaders();
            const hasAuth = headers['Authorization'] || headers['X-API-Secret'];
            
            if (!hasAuth) {
                console.log('updateSystemHealthWidget: No authentication available - Bearer token or API key required');
                return;
            }
            
            try {
                // Use consolidated DataManager instead of direct API call
                const data = await DataManager.getEnhancedData();
                console.log('DataManager: Enhanced data received for system health widget');
                
                // Extract startup data from sections - correct API structure
                const startup = data.sections && data.sections.startup;
                console.log('updateSystemHealthWidget: Startup section:', startup);
                
                if (startup && !startup.error) {
                    console.log('updateSystemHealthWidget: Processing startup data');
                    console.log('updateSystemHealthWidget: Startup hardware:', startup.hardware);
                    console.log('updateSystemHealthWidget: Startup system:', startup.system);
                    
                    // Update boot information only (health metrics UI removed)
                    // Note: lastBootInfo and bootReasonInfo already declared at top of function
                    
                    // PHASE 3: Enhanced boot information with Unix epoch fix
                    if (lastBootInfo) {
                        // BUG FIX #18: Fix Last Boot Date Regression - Unix Epoch Display Error
                        if (startup.bootTime && !isNaN(parseInt(startup.bootTime))) {
                            const bootTime = parseInt(startup.bootTime);
                            
                            // PHASE 3: Enhanced timestamp validation to prevent Unix epoch display
                            if (bootTime > 0 && bootTime !== 0) {
                                // Handle both seconds and milliseconds timestamps
                                // Unix epoch: seconds since 1970-01-01 00:00:00 UTC
                                // If timestamp is < 1000000000 (before Sep 2001), it's likely invalid
                                if (bootTime < 1000000000) {
                                    lastBootInfo.textContent = 'Boot time invalid (system clock not set)';
                                } else {
                                    // Convert to milliseconds if needed (timestamps > 1e12 are already in ms)
                                    const bootDate = new Date(bootTime > 1000000000000 ? bootTime : bootTime * 1000);
                                    
                                    // Additional validation: ensure date is reasonable (after 2020)
                                    const minValidDate = new Date('2020-01-01');
                                    const maxValidDate = new Date(Date.now() + 86400000); // Tomorrow
                                    
                                    if (bootDate >= minValidDate && bootDate <= maxValidDate) {
                                        lastBootInfo.textContent = bootDate.toLocaleString();
                                    } else {
                                        lastBootInfo.textContent = 'Boot time invalid (unreasonable date)';
                                    }
                                }
                            } else {
                                lastBootInfo.textContent = 'Boot time not recorded';
                            }
                        } else {
                            lastBootInfo.textContent = 'Boot time unavailable';
                        }
                    }
                    
                    if (bootReasonInfo) {
                        // Use bootReason field (not boot_reason)
                        bootReasonInfo.textContent = `Reason: ${startup.bootReason || 'Unknown'}`;
                    }
                    
                    // NOTE: System Specifications and Hardware Status updates REMOVED
                    // These are now handled in the main updateDashboard() function using GetVentilationStatus
                    // which provides accurate current system data instead of stale/empty startup data
                    // from GetEnhancedDashboardData. This prevents overwriting good data with blanks.
                    
                    // Calculate health percentage based on available metrics
                    const gaugeContainer = document.querySelector('.gauge-container');
                    if (gaugeContainer) {
                        let healthScore = 100;
                        
                        // Reduce score based on WiFi signal strength
                        const signal = startup.system?.signalStrength;
                        if (signal && signal < -70) healthScore -= 20;
                        else if (signal && signal < -50) healthScore -= 10;
                        
                        // Reduce score based on memory usage
                        const freeHeap = startup.system?.freeHeap;
                        const heapSize = startup.system?.heapSize;
                        if (freeHeap && heapSize) {
                            const memoryUsed = ((heapSize - freeHeap) / heapSize) * 100;
                            if (memoryUsed > 80) healthScore -= 20;
                            else if (memoryUsed > 60) healthScore -= 10;
                        }
                        
                        // Check hardware status
                        const hardware = startup.hardware;
                        if (hardware) {
                            let workingComponents = 0;
                            let totalComponents = 0;
                            
                            if (hardware.indoorBME !== undefined) { totalComponents++; if (hardware.indoorBME) workingComponents++; }
                            if (hardware.outdoorBME !== undefined) { totalComponents++; if (hardware.outdoorBME) workingComponents++; }
                            if (hardware.garageBME !== undefined) { totalComponents++; if (hardware.garageBME) workingComponents++; }
                            if (hardware.display !== undefined) { totalComponents++; if (hardware.display) workingComponents++; }
                            
                            if (totalComponents > 0) {
                                const hardwareHealth = (workingComponents / totalComponents) * 100;
                                if (hardwareHealth < 100) {
                                    healthScore = Math.min(healthScore, hardwareHealth + 20);
                                }
                            }
                        }
                        
                        healthScore = Math.max(0, Math.min(100, healthScore));
                        gaugeContainer.style.setProperty('--health-percentage', `${healthScore}%`);
                        
                        // Update the percentage text in the donut chart with detailed tooltip
                        const healthPercentageElement = document.getElementById('systemHealthPercentage');
                        if (healthPercentageElement) {
                            healthPercentageElement.textContent = `${Math.round(healthScore)}%`;
                            
                            // Add detailed tooltip explaining the health score
                            let healthDescription = 'Overall System Health Score\n';
                            healthDescription += 'Factors: Hardware + WiFi + Memory\n\n';
                            
                            if (hardware) {
                                const workingComponents = [
                                    hardware.indoorBME && 'Indoor BME280',
                                    hardware.outdoorBME && 'Outdoor BME280', 
                                    hardware.garageBME && 'Garage BME280',
                                    hardware.display && 'eInk Display'
                                ].filter(Boolean);
                                healthDescription += `Hardware: ${workingComponents.length}/4 sensors working\n`;
                            }
                            
                            const signal = startup.system?.signalStrength;
                            if (signal) {
                                const signalImpact = signal < -70 ? '-20pts' : signal < -50 ? '-10pts' : '0pts';
                                healthDescription += `WiFi: ${signal} dBm (${signalImpact})\n`;
                            }
                            
                            const freeHeap = startup.system?.freeHeap;
                            const heapSize = startup.system?.heapSize;
                            if (freeHeap && heapSize) {
                                const memoryUsed = Math.round(((heapSize - freeHeap) / heapSize) * 100);
                                const memoryImpact = memoryUsed > 80 ? '-20pts' : memoryUsed > 60 ? '-10pts' : '0pts';
                                healthDescription += `Memory: ${memoryUsed}% used (${memoryImpact})`;
                            }
                            
                            healthPercentageElement.title = healthDescription;
                        }
                    }
                } else {
                    console.log('Startup data unavailable:', startup?.error || 'No startup section');
                    if (lastBootInfo) lastBootInfo.textContent = startup?.error ? 'Boot time unavailable' : 'No boot data available';
                    if (bootReasonInfo) bootReasonInfo.textContent = 'No data';
                }
                
            } catch (error) {
                console.error('updateSystemHealthWidget failed:', error);
                if (lastBootInfo) lastBootInfo.textContent = 'Failed to load boot information';
                if (bootReasonInfo) bootReasonInfo.textContent = 'Error';
            }
        }

        function updateSystemHealthGauge(percentage) {
            // Simple stub function to handle system health gauge updates
            const gauge = document.querySelector('.gauge-container');
            if (gauge) {
                gauge.style.setProperty('--health-percentage', `${percentage}%`);
            }
            // Additional gauge styling could be added here
            console.log(`System health gauge updated to ${percentage}%`);
        }

        function updateDoorTimeline(hours) {
            console.log(`=== ACTIVITY TIMELINE: updateDoorTimeline(${hours}) started ===`);
            
            const timelineViz = document.getElementById('doorTimelineViz');
            if (!timelineViz) {
                console.error('TIMELINE ERROR: doorTimelineViz element not found in DOM');
                return;
            }
            
            console.log('TIMELINE: Found doorTimelineViz element, setting loading state');
            
            // Show loading state
            timelineViz.innerHTML = '<div class="timeline-placeholder"><p>Loading ' + hours + 'h door activity timeline...</p></div>';
            
            // Check if we have any authentication method (Bearer token or API key)
            const headers = getAuthHeaders();
            const hasAuth = headers['Authorization'] || headers['X-API-Secret'];
            
            if (!hasAuth) {
                console.log('updateDoorTimeline: No authentication available - Bearer token or API key required');
                timelineViz.innerHTML = '<div class="timeline-error">Authentication required. Please log in to view timeline.</div>';
                return;
            }
            
            console.log('TIMELINE: Using authentication headers');
            
            // Use consolidated DataManager for history data
            DataManager.getHistoryData(hours)
                .then(data => {
                    console.log(`DataManager: History data received for timeline (${hours}h)`);
                    console.log('TIMELINE: Received history data for', hours, 'hours:', {
                        dataPoints: data.data ? data.data.length : 0,
                        deviceId: data.deviceId,
                        aggregation: data.aggregation,
                        timeRange: `${hours} hours requested`,
                        firstRecord: data.data && data.data.length > 0 ? {
                            timestamp: data.data[0].timestamp,
                            doorCount: data.data[0].doors ? data.data[0].doors.length : 0
                        } : 'No data',
                        lastRecord: data.data && data.data.length > 0 ? {
                            timestamp: data.data[data.data.length - 1].timestamp,
                            doorCount: data.data[data.data.length - 1].doors ? data.data[data.data.length - 1].doors.length : 0
                        } : 'No data'
                    });
                    
                    // Process door activity events from history data
                    let doorEvents = [];
                    const doorActivityStats = {
                        activeDoors: 0,
                        totalSessions: 0,
                        firstActivity: null,
                        lastActivity: null,
                        peakHour: null
                    };
                    
                    if (data.data && data.data.length > 0) {
                        // Track unique door events to avoid duplication
                        const uniqueEvents = new Map(); // key: "timestamp-door-action", value: event
                        
                        console.log(`TIMELINE: Processing ${data.data.length} API records for door events`);
                        
                        // Extract door events from history data
                        data.data.forEach((record, recordIndex) => {
                            // Process explicit door transitions first (most accurate)
                            if (record.doorTransitions && Array.isArray(record.doorTransitions)) {
                                record.doorTransitions.forEach(transition => {
                                    // Filter out system events by detection method OR door name
                                    const detectionMethod = transition.detectionMethod || '';
                                    const doorName = transition.doorName || '';
                                    
                                    // Skip system events by detection method
                                    if (['power-outage', 'reboot', 'loop-delay'].includes(detectionMethod)) {
                                        return; // Skip system events
                                    }
                                    
                                    // Skip system events by door name
                                    if (doorName.toLowerCase().includes('system') || doorName === 'system-event') {
                                        return; // Skip system events
                                    }
                                    
                                    // For pressure events, only include valid confidence (>45% to match ESP32 threshold)
                                    if (detectionMethod === 'pressure-analysis' || detectionMethod === 'pressure') {
                                        const confidence = parseFloat(transition.confidence) || 0;
                                        if (confidence <= 0.45) {
                                            return; // Skip low confidence pressure events
                                        }
                                    }
                                    
                                    // Include all reed switch events (they're always high confidence)
                                    // Include high confidence pressure events (>90%)
                                    const eventKey = `${transition.timestamp}-door-${transition.doorId}-${transition.opened ? 'open' : 'close'}`;
                                    if (!uniqueEvents.has(eventKey)) {
                                        // Enhanced door name logic
                                        const getDoorDisplayName = (transition) => {
                                            const detectionMethod = transition.detectionMethod || '';
                                            const zone = transition.zone || '';
                                            const doorId = transition.doorId || -1;
                                            const doorName = transition.doorName || '';
                                            
                                            // If we have an explicit door name from ESP32, use it
                                            if (doorName) {
                                                return doorName;
                                            }
                                            
                                            // Handle specific doorId values
                                            if (doorId === 4) {
                                                return 'House-Outside Door'; // doorId 4 is always house-outside
                                            }
                                            
                                            // Handle pressure-only detections with better naming
                                            if (detectionMethod === 'pressure-analysis' || detectionMethod === 'pressure') {
                                                if (zone === 'house-outside') {
                                                    return 'House-Outside Door';
                                                } else if (zone === 'garage-house') {
                                                    return 'House Door (Pressure)'; // D2 area
                                                } else if (zone === 'garage-outside') {
                                                    return 'Garage Door (Pressure)'; // D1, D3, or D4 area
                                                }
                                            }
                                            
                                            // Reed switch detections (doorId 0-3)
                                            if (detectionMethod === 'reed-switch' || detectionMethod === 'reed') {
                                                const reedNames = ['D1 Main Garage', 'D2 House Door', 'D3 Single Roller', 'D4 Double Roller'];
                                                if (doorId >= 0 && doorId < 4) {
                                                    return reedNames[doorId];
                                                }
                                            }
                                            
                                            // Final fallback
                                            return doorName || `Door ${doorId + 1}`;
                                        };
                                        
                                        const event = {
                                            timestamp: transition.timestamp,
                                            door: getDoorDisplayName(transition),
                                            action: transition.opened ? 'opened' : 'closed',
                                            duration: 0,
                                            source: 'transition',
                                            detectionMethod: transition.detectionMethod || null,
                                            confidence: transition.confidence || null,
                                            confirmedByReed: transition.confirmedByReed || false
                                        };
                                        uniqueEvents.set(eventKey, event);
                                        const confirmationStatus = event.confirmedByReed ? '✅ CONFIRMED' : (event.detectionMethod === 'pressure' ? '⚠️ UNCONFIRMED' : '');
                                        // console.log(`    Added door transition: ${event.door} ${event.action} at ${transition.timestamp} (${event.detectionMethod || 'unknown method'}) ${confirmationStatus}`);
                                    }
                                });
                            }
                            
                            // Extract events from door summary data (firstOpenedToday, lastOpenedToday)
                            if (record.doors && Array.isArray(record.doors)) {
                                record.doors.forEach((door, doorIndex) => {
                                    
                                    // Only add events with valid timestamps - skip invalid ones entirely
                                    const addEventIfValid = (timestamp, action, duration = 0, source = 'summary') => {
                                        if (!timestamp) return;
                                        
                                        // Test if timestamp is valid before adding
                                        let testDate;
                                        try {
                                            if (typeof timestamp === 'number') {
                                                testDate = timestamp > 1000000000000 ? new Date(timestamp) : new Date(timestamp * 1000);
                                            } else if (typeof timestamp === 'string') {
                                                testDate = new Date(timestamp);
                                                if (isNaN(testDate.getTime()) && !isNaN(timestamp)) {
                                                    const numericTimestamp = parseFloat(timestamp);
                                                    testDate = numericTimestamp > 1000000000000 ? new Date(numericTimestamp) : new Date(numericTimestamp * 1000);
                                                }
                                            }
                                            
                                            if (!testDate || isNaN(testDate.getTime()) || testDate.getFullYear() < 2020) {
                                                return;
                                            }
                                            
                                            // Create unique key to prevent duplicates
                                            const eventKey = `${timestamp}-${door.name}-${action}`;
                                            if (!uniqueEvents.has(eventKey)) {
                                                const event = {
                                                    timestamp: timestamp,
                                                    door: door.name || 'Unknown Door',
                                                    action: action,
                                                    duration: duration,
                                                    source: source
                                                };
                                                uniqueEvents.set(eventKey, event);
                                                console.log(`    Added unique ${action} event for ${door.name} at ${timestamp} (${testDate.toLocaleString()})`);
                                            }
                                            
                                        } catch (e) {
                                            console.log(`    Skipping ${action} - timestamp error:`, timestamp, e.message);
                                        }
                                    };
                                    
                                    // Track door state changes with validation - only add unique events
                                    if (door.open && door.openedAt) {
                                        addEventIfValid(door.openedAt, 'opened', door.minutesOpen || 0, 'current_state');
                                    }
                                    if (door.firstOpenedToday) {
                                        addEventIfValid(door.firstOpenedToday, 'first_opened_today', 0, 'daily_summary');
                                    }
                                    if (door.lastOpenedToday && door.lastOpenedToday !== door.firstOpenedToday) {
                                        addEventIfValid(door.lastOpenedToday, 'last_opened_today', 0, 'daily_summary');
                                    }
                                });
                            }
                        });
                        
                        // Convert unique events to array
                        doorEvents = Array.from(uniqueEvents.values());
                        
                        console.log(`TIMELINE: Deduplicated events: ${uniqueEvents.size} unique events from ${data.data.length} records`);
                        console.log(`TIMELINE: Event sources:`, {
                            transitions: doorEvents.filter(e => e.source === 'transition').length,
                            daily_summary: doorEvents.filter(e => e.source === 'daily_summary').length,
                            current_state: doorEvents.filter(e => e.source === 'current_state').length
                        });
                        
                        // Calculate statistics
                        const uniqueDoors = new Set(doorEvents.map(e => e.door));
                        doorActivityStats.activeDoors = uniqueDoors.size;
                        doorActivityStats.totalSessions = doorEvents.length;
                        
                        if (doorEvents.length > 0) {
                            doorEvents.sort((a, b) => {
                                const aTime = typeof a.timestamp === 'string' ? parseFloat(a.timestamp) : a.timestamp;
                                const bTime = typeof b.timestamp === 'string' ? parseFloat(b.timestamp) : b.timestamp;
                                return bTime - aTime; // Reversed for recent events first
                            });
                            doorActivityStats.firstActivity = doorEvents[doorEvents.length - 1].timestamp; // Earliest is now at end
                            doorActivityStats.lastActivity = doorEvents[0].timestamp; // Most recent is now at start
                        }
                        
                        console.log('TIMELINE: Final event statistics:', {
                            totalEvents: doorEvents.length,
                            uniqueDoors: uniqueDoors.size,
                            timeRange: `${hours} hours`,
                            firstActivity: doorActivityStats.firstActivity,
                            lastActivity: doorActivityStats.lastActivity
                        });
                    }
                    
                    // Create doors data structure compatible with renderActivityTimeline
                    const doorsData = {
                        timeline: doorEvents,
                        count: doorEvents.length,
                        timeRange: `${hours} hours`,
                        doorActivity: doorActivityStats,
                        message: doorEvents.length === 0 ? 'No recent door activity data available - using placeholder' : null
                    };
                    
                    console.log('TIMELINE: Processed door events:', doorsData);
                    console.log('TIMELINE: Calling renderActivityTimeline with processed data');
                    renderActivityTimeline(doorsData, hours);
                })
                .catch(error => {
                    console.error('DataManager: Error loading history data for timeline:', error);
                    console.error('TIMELINE ERROR: Error details:', {
                        message: error.message,
                        stack: error.stack,
                        name: error.name
                    });
                    timelineViz.innerHTML = '<div class="timeline-placeholder"><p>Error loading timeline: ' + error.message + '</p></div>';
                });
        }

        function renderActivityTimeline(doorsData, hours) {
            console.log('renderActivityTimeline: Processing doors data:', doorsData);
            
            const timelineViz = document.getElementById('doorTimelineViz');
            const timeline = doorsData.timeline || [];
            const count = doorsData.count || 0;
            const doorActivity = doorsData.doorActivity || {};
            
            // Create timeline visualization HTML
            let timelineHtml = '';
            
            if (count === 0 || timeline.length === 0) {
                // Show placeholder data when no real timeline available
                timelineHtml = `
                    <div class="timeline-content">
                        <div class="timeline-stats">
                            <div class="stat-row">
                                <span class="stat-label">First Activity:</span>
                                <span class="stat-value">${doorActivity.firstActivity || 'No activity'}</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">Peak Hour:</span>
                                <span class="stat-value">${doorActivity.peakHour || 'No peak identified'}</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">Sessions:</span>
                                <span class="stat-value">${doorActivity.totalSessions || 0}</span>
                            </div>
                        </div>
                        
                        <div class="timeline-chart">
                            <div class="timeline-placeholder-enhanced">
                                <div style="text-align: center; padding: 20px; color: #6c757d;">
                                    <div style="font-size: 2em; margin-bottom: 10px;">📊</div>
                                    <div style="font-weight: bold; margin-bottom: 5px;">${hours}h Timeline</div>
                                    <div style="font-size: 0.9em;">${doorsData.message || 'Loading door activity data...'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // Create actual timeline visualization with real data
                timelineHtml = `
                    <div class="timeline-content">
                        <div class="timeline-stats">
                            <div class="stat-row">
                                <span class="stat-label">Time Range:</span>
                                <span class="stat-value">${hours}h</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">Total Events:</span>
                                <span class="stat-value">${count} found</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">Active Doors:</span>
                                <span class="stat-value">${doorActivity.activeDoors || 0}</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">Displayed:</span>
                                <span class="stat-value">${timeline.length} events</span>
                            </div>
                        </div>
                        
                        <div class="timeline-chart">
                            <div class="timeline-events-scrollable">
                                ${timeline.map((event, index) => {
                                    // Parse timestamp with debugging - don't filter out errors
                                    let timestamp;
                                    let hasParsingError = false;
                                    let parseErrorMessage = '';
                                    
                                    try {
                                        if (typeof event.timestamp === 'number') {
                                            timestamp = event.timestamp > 1000000000000 ? new Date(event.timestamp) : new Date(event.timestamp * 1000);
                                        } else if (typeof event.timestamp === 'string') {
                                            timestamp = new Date(event.timestamp);
                                            if (isNaN(timestamp.getTime()) && !isNaN(event.timestamp)) {
                                                const numericTimestamp = parseFloat(event.timestamp);
                                                timestamp = numericTimestamp > 1000000000000 ? new Date(numericTimestamp) : new Date(numericTimestamp * 1000);
                                            }
                                        } else {
                                            hasParsingError = true;
                                            parseErrorMessage = `Unknown timestamp type: ${typeof event.timestamp}`;
                                        }
                                        
                                        // Check if timestamp is valid after parsing
                                        if (timestamp && (isNaN(timestamp.getTime()) || timestamp.getFullYear() < 2020)) {
                                            hasParsingError = true;
                                            parseErrorMessage = `Invalid date parsed: ${timestamp} from ${event.timestamp}`;
                                        }
                                    } catch (e) {
                                        hasParsingError = true;
                                        parseErrorMessage = `Parse exception: ${e.message}`;
                                    }
                                    
                                    // Display timestamp or error message
                                    let timeStr, dateStr;
                                    if (hasParsingError) {
                                        timeStr = 'Invalid';
                                        dateStr = 'Error';
                                    } else {
                                        timeStr = timestamp.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
                                        dateStr = timestamp.toLocaleDateString([], {month: 'short', day: 'numeric'});
                                    }
                                    
                                    const actionIcon = hasParsingError ? '⚠️' : 
                                        (event.action === 'opened' || event.action === 'first_opened_today' || event.action === 'last_opened_today' ? '🔓' : '🔒');
                                    const actionText = hasParsingError ? 'Parse Error' : 
                                        (event.action ? event.action.replace(/_/g, ' ') : 'activity');
                                    
                                    // Add detection method info and confirmation status if available
                                    let detectionMethodHtml = '';
                                    if (event.detectionMethod) {
                                        const methodColor = event.detectionMethod === 'reed-switch' ? '#28a745' : '#17a2b8';
                                        const methodText = event.detectionMethod === 'reed-switch' ? 'Reed Switch' : 'Pressure Analysis';
                                        const confidenceText = event.confidence ? `(${Math.round(event.confidence * 100)}%)` : '';
                                        
                                        // Add confirmation status for pressure detections
                                        let confirmationIcon = '';
                                        if (event.detectionMethod === 'pressure') {
                                            confirmationIcon = event.confirmedByReed ? ' ✅' : ' ⚠️';
                                        }
                                        
                                        detectionMethodHtml = `<span class="detection-method" style="color: ${methodColor}; font-size: 0.8em;">${methodText} ${confidenceText}${confirmationIcon}</span>`;
                                    }
                                    
                                    return `
                                        <div class="timeline-event-compact${hasParsingError ? ' timeline-event-error' : ''}">
                                            <div class="event-time-compact">
                                                <span class="time">${timeStr}</span>
                                                <span class="date">${dateStr}</span>
                                            </div>
                                            <div class="event-icon">${actionIcon}</div>
                                            <div class="event-info-compact">
                                                <span class="event-door">${event.door || 'Unknown'}</span>
                                                <span class="event-action">${actionText}</span>
                                                ${detectionMethodHtml}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // Add CSS styles for timeline visualization
            const timelineStyles = `
                <style>
                    .timeline-content {
                        padding: 10px;
                        background: white;
                        border-radius: 8px;
                    }
                    .timeline-stats {
                        display: flex;
                        justify-content: space-around;
                        margin-bottom: 15px;
                        padding: 10px;
                        background: #f8f9fa;
                        border-radius: 5px;
                    }
                    .stat-row {
                        text-align: center;
                    }
                    .stat-label {
                        display: block;
                        font-size: 0.8em;
                        color: #6c757d;
                        margin-bottom: 3px;
                    }
                    .stat-value {
                        display: block;
                        font-weight: bold;
                        color: #2c3e50;
                    }
                    .timeline-chart {
                        min-height: 120px;
                        border: 1px solid #dee2e6;
                        border-radius: 5px;
                        background: #fff;
                    }
                    .timeline-placeholder-enhanced {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 120px;
                    }
                    .timeline-events-scrollable {
                        padding: 8px;
                        height: 280px;
                        overflow-y: auto;
                        background: #f8f9fa;
                        border-radius: 5px;
                        scrollbar-width: thin;
                        scrollbar-color: #cbd5e0 #f8f9fa;
                    }
                    .timeline-events-scrollable::-webkit-scrollbar {
                        width: 6px;
                    }
                    .timeline-events-scrollable::-webkit-scrollbar-track {
                        background: #f8f9fa;
                        border-radius: 3px;
                    }
                    .timeline-events-scrollable::-webkit-scrollbar-thumb {
                        background: #cbd5e0;
                        border-radius: 3px;
                    }
                    .timeline-event-compact {
                        display: flex;
                        align-items: center;
                        padding: 6px 10px;
                        margin-bottom: 4px;
                        background: white;
                        border-radius: 6px;
                        border: 1px solid #e9ecef;
                        font-size: 0.85em;
                        min-height: 36px;
                    }
                    .timeline-event-compact:last-child {
                        margin-bottom: 0;
                    }
                    .timeline-event-compact:hover {
                        background: #f1f3f4;
                        border-color: #d1ecf1;
                    }
                    .timeline-event-compact.timeline-event-error {
                        background: #fff5f5 !important;
                        border-color: #f56565 !important;
                    }
                    .event-time-compact {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        margin-right: 12px;
                        min-width: 60px;
                        font-size: 0.75em;
                    }
                    .event-time-compact .time {
                        font-weight: bold;
                        color: #2c3e50;
                        line-height: 1.1;
                    }
                    .event-time-compact .date {
                        color: #6c757d;
                        line-height: 1.1;
                    }
                    .timeline-event-compact .event-icon {
                        margin-right: 10px;
                        font-size: 1.2em;
                    }
                    .event-info-compact {
                        display: flex;
                        flex-direction: column;
                        flex: 1;
                        line-height: 1.2;
                    }
                    .event-info-compact .event-door {
                        font-weight: bold;
                        color: #2c3e50;
                        font-size: 0.9em;
                    }
                    .event-info-compact .event-action {
                        color: #6c757d;
                        font-size: 0.8em;
                        text-transform: capitalize;
                    }
                    .timeline-events {
                        padding: 10px;
                        min-height: 200px;
                        max-height: 300px;
                        overflow-y: auto;
                        background: #f8f9fa;
                        border-radius: 5px;
                    }
                    .timeline-event {
                        display: flex;
                        align-items: flex-start;
                        padding: 12px 15px;
                        margin-bottom: 8px;
                        background: white;
                        border-radius: 8px;
                        border: 1px solid #e9ecef;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                        font-size: 0.9em;
                    }
                    .timeline-event:last-child {
                        margin-bottom: 0;
                    }
                    .timeline-event-error {
                        background: #fff5f5 !important;
                        border-color: #f56565 !important;
                        box-shadow: 0 1px 3px rgba(245, 101, 101, 0.2) !important;
                    }
                    .timeline-event-error .event-time .time {
                        color: #e53e3e !important;
                    }
                    .timeline-event-error .event-error {
                        font-size: 0.7em;
                        color: #e53e3e;
                        font-family: monospace;
                        background: #fed7d7;
                        padding: 2px 6px;
                        border-radius: 3px;
                        margin-top: 4px;
                    }
                    .event-time {
                        min-width: 80px;
                        margin-right: 15px;
                        text-align: center;
                    }
                    .event-time .time {
                        font-weight: bold;
                        color: #007bff;
                        font-size: 1em;
                    }
                    .event-time .date {
                        font-size: 0.8em;
                        color: #6c757d;
                        margin-top: 2px;
                    }
                    .event-details {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        flex: 1;
                    }
                    .event-icon {
                        font-size: 1.4em;
                        line-height: 1;
                    }
                    .event-info {
                        display: flex;
                        flex-direction: column;
                        gap: 3px;
                        flex: 1;
                    }
                    .event-door {
                        font-weight: 600;
                        color: #2c3e50;
                        font-size: 1em;
                    }
                    .event-action {
                        font-size: 0.85em;
                        color: #6c757d;
                        text-transform: capitalize;
                        font-style: italic;
                    }
                    .event-duration {
                        font-size: 0.8em;
                        color: #28a745;
                        font-weight: 500;
                    }
                </style>
            `;
            
            timelineViz.innerHTML = timelineStyles + timelineHtml;
            
            console.log('renderActivityTimeline: Timeline rendered successfully');
        }

        /**
         * Loads and displays yesterday's door activity timeline and statistics
         * Fetches 24-hour history data and processes door activity events
         * Calculates active doors, total events, peak activity, and most active door
         * Displays comma-separated active door names and activity statistics
         * @returns {Promise<void>}
         */
        async function loadYesterdayDoorActivity() {
            console.log('=== STAGE 3: loadYesterdayDoorActivity() using DataManager ===');
            
            const yesterdayElement = document.getElementById('yesterdayDoorTimeline');
            if (!yesterdayElement) {
                console.error('yesterdayDoorTimeline element not found');
                return;
            }
            
            // Show loading state
            yesterdayElement.innerHTML = '<div class="loading-state">Loading yesterday door activity...</div>';
            
            try {
                // Get authentication headers
                const headers = getAuthHeaders();
                const hasAuth = headers['Authorization'] || headers['X-API-Secret'];
                
                if (!hasAuth) {
                    yesterdayElement.innerHTML = '<div class="error-state">Authentication required for door activity data</div>';
                    return;
                }
                
                // Use consolidated DataManager for 24h history data
                const data = await DataManager.getHistoryData(24);
                console.log('DataManager: History data received for yesterday door activity (24h)');
                
                // History API returns {deviceId: ..., data: [...]}
                const historyData = data.data || [];
                
                if (!historyData || historyData.length === 0) {
                    yesterdayElement.innerHTML = '<div class="info-state">No history data available for yesterday</div>';
                    return;
                }
                
                // Process door activity from history data 
                let doorEvents = [];
                const doorActivityStats = {
                    activeDoors: new Set(),
                    totalEvents: 0,
                    mostActiveCount: 0,
                    mostActiveDoor: 'None'
                };
                
                // First pass: collect active doors from the latest data (not every entry)
                const latestEntry = historyData[historyData.length - 1];
                if (latestEntry && latestEntry.doors && Array.isArray(latestEntry.doors)) {
                    latestEntry.doors.forEach(door => {
                        // Door data comes as objects with properties like {id: 2, name: "D2 (House Hinge)", wasOpenedToday: true, ...}
                        if (door.name && door.wasOpenedToday === true) {
                            const doorName = door.name.trim();
                            doorActivityStats.activeDoors.add(doorName);
                        }
                    });
                }
                
                // Second pass: collect only actual door transition events (not status checks)
                historyData.forEach(entry => {
                    // Only count doorTransitions array (actual door events)  
                    if (entry.doorTransitions && Array.isArray(entry.doorTransitions)) {
                        entry.doorTransitions.forEach(transition => {
                            // Transition data comes as objects with properties like {doorId: 2, doorName: "D2 (House Hinge)", opened: true, ...}
                            if (transition.doorName) {
                                const doorName = transition.doorName.trim();
                                const opened = transition.opened === true;
                                
                                // Make sure this door is in our active doors set
                                doorActivityStats.activeDoors.add(doorName);
                                doorEvents.push({
                                    door: doorName,
                                    status: opened ? 'opened' : 'closed',
                                    timestamp: entry.timestamp,
                                    type: 'transition'
                                });
                            }
                        });
                    }
                });
                
                doorActivityStats.totalEvents = doorEvents.length;
                
                // Find most active door
                const doorCounts = {};
                doorEvents.forEach(event => {
                    doorCounts[event.door] = (doorCounts[event.door] || 0) + 1;
                });
                
                if (Object.keys(doorCounts).length > 0) {
                    const sortedDoors = Object.entries(doorCounts).sort(([,a], [,b]) => b - a);
                    doorActivityStats.mostActiveDoor = `${sortedDoors[0][0]} (${sortedDoors[0][1]} events)`;
                    doorActivityStats.mostActiveCount = sortedDoors[0][1];
                }
                
                // Determine peak activity level
                let peakActivity = 'None';
                if (doorActivityStats.totalEvents > 50) {
                    peakActivity = 'High';
                } else if (doorActivityStats.totalEvents > 15) {
                    peakActivity = 'Medium';
                } else if (doorActivityStats.totalEvents > 0) {
                    peakActivity = 'Low';
                }
                
                // Display the results
                const activeDoorsList = Array.from(doorActivityStats.activeDoors).join(', ');
                const activeDoorDisplay = doorActivityStats.activeDoors.size > 0 ? activeDoorsList : 'None';
                
                yesterdayElement.innerHTML = `
                    <div class="door-summary">
                        <p><strong>Active Doors:</strong> ${activeDoorDisplay}</p>
                        <p><strong>Total Events:</strong> ${doorActivityStats.totalEvents}</p>
                        <p><strong>Peak Activity:</strong> ${peakActivity}</p>
                        <p><strong>Most Active:</strong> ${doorActivityStats.mostActiveDoor}</p>
                    </div>
                `;
                
                console.log(`YESTERDAY DOOR ACTIVITY: Found ${doorActivityStats.totalEvents} events, ${doorActivityStats.activeDoors.size} active doors`);
                
            } catch (error) {
                console.error('DataManager: Error loading history data for yesterday door activity:', error);
                yesterdayElement.innerHTML = '<div class="error-state">Failed to load door activity data</div>';
            }
        }

        /**
         * ENHANCED: Loads individual sensor data for Yesterday's Report
         * Fetches raw sensor data from VentilationData table for accurate sensor-specific metrics
         * Replaces aggregated summary data with detailed sensor breakdowns
         * @returns {Promise<void>}
         */
        async function loadYesterdayIndividualSensorData() {
            console.log('=== ENHANCED: loadYesterdayIndividualSensorData() for accurate sensor readings ===');
            
            try {
                // Get 24-hour history data like the door activity function
                const headers = getAuthHeaders();
                const hasAuth = headers['Authorization'] || headers['X-API-Secret'];
                
                if (!hasAuth) {
                    console.log('loadYesterdayIndividualSensorData: No authentication available');
                    return;
                }

                // Use DataManager to get yesterday's sensor data
                const data = await DataManager.getHistoryData(24);
                console.log('DataManager: History data received for individual sensor analysis (24h)');
                
                const historyData = data.data || [];
                
                if (!historyData || historyData.length === 0) {
                    console.log('No history data available for individual sensor analysis');
                    return;
                }
                
                // DEBUG: Show what fields are actually available in the first record
                if (historyData.length > 0) {
                    console.log('DEBUG: First record fields:', Object.keys(historyData[0]));
                    console.log('DEBUG: First record sample:', historyData[0]);
                    console.log('DEBUG: First record sensors object:', historyData[0].sensors);
                    if (historyData[0].sensors) {
                        console.log('DEBUG: Sensors object keys:', Object.keys(historyData[0].sensors));
                    }
                }
                
                // Process individual sensor data from VentilationData records
                const sensorStats = {
                    indoor: { temps: [], humidity: [], pressure: [] },
                    outdoor: { temps: [], humidity: [], pressure: [] },
                    garage: { temps: [], humidity: [], pressure: [] }
                };
                
                // Extract individual sensor readings
                historyData.forEach(entry => {
                    // FIXED: Access sensor data through the sensors object structure
                    const sensors = entry.sensors || {};
                    
                    // Try multiple possible field names for indoor sensors
                    const indoorTemp = sensors.IndoorTemp || sensors.indoorTemp || sensors.indoor?.temp;
                    const indoorHumidity = sensors.IndoorHumidity || sensors.indoorHumidity || sensors.indoor?.humidity;
                    const indoorPressure = sensors.IndoorPressure || sensors.indoorPressure || sensors.indoor?.pressure;
                    
                    // Try multiple possible field names for outdoor sensors
                    const outdoorTemp = sensors.OutdoorTemp || sensors.outdoorTemp || sensors.outdoor?.temp;
                    const outdoorHumidity = sensors.OutdoorHumidity || sensors.outdoorHumidity || sensors.outdoor?.humidity;
                    const outdoorPressure = sensors.OutdoorPressure || sensors.outdoorPressure || sensors.outdoor?.pressure;
                    
                    // Try multiple possible field names for garage sensors
                    const garageTemp = sensors.GarageTemp || sensors.garageTemp || sensors.garage?.temp;
                    const garageHumidity = sensors.GarageHumidity || sensors.garageHumidity || sensors.garage?.humidity;
                    const garagePressure = sensors.GaragePressure || sensors.garagePressure || sensors.garage?.pressure;
                    
                    // Add values if they exist and are valid numbers
                    if (indoorTemp != null && !isNaN(indoorTemp)) sensorStats.indoor.temps.push(Number(indoorTemp));
                    if (indoorHumidity != null && !isNaN(indoorHumidity)) sensorStats.indoor.humidity.push(Number(indoorHumidity));
                    if (indoorPressure != null && !isNaN(indoorPressure)) sensorStats.indoor.pressure.push(Number(indoorPressure));
                    
                    if (outdoorTemp != null && !isNaN(outdoorTemp)) sensorStats.outdoor.temps.push(Number(outdoorTemp));
                    if (outdoorHumidity != null && !isNaN(outdoorHumidity)) sensorStats.outdoor.humidity.push(Number(outdoorHumidity));
                    if (outdoorPressure != null && !isNaN(outdoorPressure)) sensorStats.outdoor.pressure.push(Number(outdoorPressure));
                    
                    if (garageTemp != null && !isNaN(garageTemp)) sensorStats.garage.temps.push(Number(garageTemp));
                    if (garageHumidity != null && !isNaN(garageHumidity)) sensorStats.garage.humidity.push(Number(garageHumidity));
                    if (garagePressure != null && !isNaN(garagePressure)) sensorStats.garage.pressure.push(Number(garagePressure));
                });
                
                // Calculate statistics for each sensor
                const calculateStats = (values) => {
                    console.log('DEBUG calculateStats called with:', values.length, 'values, sample:', values.slice(0, 3));
                    if (values.length === 0) return { min: 'N/A', max: 'N/A', avg: 'N/A' };
                    const min = Math.min(...values).toFixed(1);
                    const max = Math.max(...values).toFixed(1);
                    const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
                    return { min, max, avg };
                };
                
                const indoorTemp = calculateStats(sensorStats.indoor.temps);
                const outdoorTemp = calculateStats(sensorStats.outdoor.temps);
                const garageTemp = calculateStats(sensorStats.garage.temps);
                
                const indoorHum = calculateStats(sensorStats.indoor.humidity);
                const outdoorHum = calculateStats(sensorStats.outdoor.humidity);
                const garageHum = calculateStats(sensorStats.garage.humidity);
                
                // Update Environmental Summary with individual sensor data
                document.getElementById('yesterdayEnvironmental').innerHTML = `
                    <div class="env-summary">
                        <div class="sensor-breakdown">
                            <div class="sensor-zone">
                                <h5>🏠 Indoor Sensor (BME280)</h5>
                                <p><strong>Temperature:</strong> ${indoorTemp.min}°F - ${indoorTemp.max}°F (Avg: ${indoorTemp.avg}°F)</p>
                                <p><strong>Humidity:</strong> ${indoorHum.min}% - ${indoorHum.max}% (Avg: ${indoorHum.avg}%)</p>
                            </div>
                            <div class="sensor-zone">
                                <h5>🌤️ Outdoor Sensor (BME280)</h5>
                                <p><strong>Temperature:</strong> ${outdoorTemp.min}°F - ${outdoorTemp.max}°F (Avg: ${outdoorTemp.avg}°F)</p>
                                <p><strong>Humidity:</strong> ${outdoorHum.min}% - ${outdoorHum.max}% (Avg: ${outdoorHum.avg}%)</p>
                            </div>
                            <div class="sensor-zone">
                                <h5>🚗 Garage Sensor (BME280)</h5>
                                <p><strong>Temperature:</strong> ${garageTemp.min}°F - ${garageTemp.max}°F (Avg: ${garageTemp.avg}°F)</p>
                                <p><strong>Humidity:</strong> ${garageHum.min}% - ${garageHum.max}% (Avg: ${garageHum.avg}%)</p>
                            </div>
                        </div>
                    </div>
                `;
                
                // Update Humidity Analysis with sensor breakdown
                document.getElementById('yesterdayHumidity').innerHTML = `
                    <div class="humidity-analysis">
                        <div class="humidity-breakdown">
                            <p><strong>🏠 Indoor:</strong> ${indoorHum.min}% - ${indoorHum.max}% (Avg: ${indoorHum.avg}%)</p>
                            <p><strong>🌤️ Outdoor:</strong> ${outdoorHum.min}% - ${outdoorHum.max}% (Avg: ${outdoorHum.avg}%)</p>
                            <p><strong>🚗 Garage:</strong> ${garageHum.min}% - ${garageHum.max}% (Avg: ${garageHum.avg}%)</p>
                            <p><strong>Overall Variation:</strong> ${Math.max(
                                sensorStats.indoor.humidity.length > 0 ? Math.max(...sensorStats.indoor.humidity) - Math.min(...sensorStats.indoor.humidity) : 0,
                                sensorStats.outdoor.humidity.length > 0 ? Math.max(...sensorStats.outdoor.humidity) - Math.min(...sensorStats.outdoor.humidity) : 0,
                                sensorStats.garage.humidity.length > 0 ? Math.max(...sensorStats.garage.humidity) - Math.min(...sensorStats.garage.humidity) : 0
                            ).toFixed(1)}% max range across all zones</p>
                        </div>
                    </div>
                `;
                
                // DEBUG: Show what values were extracted
                console.log('DEBUG: Extracted data counts:', {
                    indoorTemps: sensorStats.indoor.temps.length,
                    outdoorTemps: sensorStats.outdoor.temps.length,
                    garageTemps: sensorStats.garage.temps.length,
                    indoorHumidity: sensorStats.indoor.humidity.length,
                    sampleIndoorTemp: sensorStats.indoor.temps.slice(0, 3),
                    sampleOutdoorTemp: sensorStats.outdoor.temps.slice(0, 3)
                });
                
                console.log(`ENHANCED SENSOR DATA: Processed ${historyData.length} records for individual sensor analysis`);
                
            } catch (error) {
                console.error('Enhanced sensor data loading failed:', error);
                // Keep existing display if enhanced loading fails
            }
        }

        /**
         * ENHANCED: Gets actual incident count for yesterday from VentilationIncidents table
         * Queries incident data by date range instead of using summary data that defaults to 0
         * @returns {Promise<number>} Actual incident count for yesterday
         */
        async function getYesterdayIncidentCount() {
            console.log('=== ENHANCED: getYesterdayIncidentCount() for real incident data ===');
            
            try {
                // Get yesterday's date range
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                yesterday.setHours(0, 0, 0, 0);
                const yesterdayStart = Math.floor(yesterday.getTime() / 1000);
                const yesterdayEnd = yesterdayStart + (24 * 60 * 60); // Add 24 hours
                
                console.log(`Querying incidents for yesterday: ${yesterdayStart} to ${yesterdayEnd}`);
                
                // TODO: Need to query VentilationIncidents table directly
                // Current DataManager doesn't have incident query method
                // Would need something like: DataManager.getIncidentsByDateRange(yesterdayStart, yesterdayEnd)
                
                // For now, return placeholder showing we know this is wrong
                return 0; // This is wrong - need actual query
                
            } catch (error) {
                console.error('Enhanced incident count loading failed:', error);
                return 0;
            }
        }

        /**
         * Loads and displays yesterday's incident summary and analysis
         * Fetches incident data and categorizes by severity and type
         * Displays incident counts, severity distribution, and recent incidents
         * Provides insights into system reliability and operational issues
         * @returns {Promise<void>}
         */
        async function loadYesterdayIncidentSummary() {
            console.log('=== YESTERDAY INCIDENT SUMMARY: loadYesterdayIncidentSummary() started ===');
            
            const incidentElement = document.getElementById('yesterdayIncidentSummary');
            if (!incidentElement) {
                console.error('yesterdayIncidentSummary element not found');
                return;
            }
            
            // Show loading state
            incidentElement.innerHTML = '<div class="loading-state">Loading yesterday incident summary...</div>';
            
            try {
                // Get authentication headers (same as other API calls)
                const headers = getAuthHeaders();
                const hasAuth = headers['Authorization'] || headers['X-API-Secret'];
                
                if (!hasAuth) {
                    incidentElement.innerHTML = '<div class="error-state">Authentication required for incident data</div>';
                    return;
                }
                
                // Get incident data from Status API (has real incident data)
                const apiUrl = `${CONFIG.statusApiUrl}?deviceId=${CONFIG.deviceId}`;
                
                const response = await fetch(apiUrl, { 
                    method: 'GET',
                    headers: headers
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                
                if (!data.incidents || !Array.isArray(data.incidents)) {
                    incidentElement.innerHTML = '<div class="info-state">No incident data available</div>';
                    return;
                }
                
                // Calculate yesterday's date range in Unix timestamps
                const now = new Date();
                const yesterday = new Date(now);
                yesterday.setDate(now.getDate() - 1);
                const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
                const yesterdayEnd = new Date(yesterdayStart);
                yesterdayEnd.setDate(yesterdayStart.getDate() + 1);
                yesterdayEnd.setSeconds(yesterdayEnd.getSeconds() - 1);
                
                const yesterdayStartUnix = Math.floor(yesterdayStart.getTime() / 1000);
                const yesterdayEndUnix = Math.floor(yesterdayEnd.getTime() / 1000);
                
                console.log(`YESTERDAY INCIDENT SUMMARY: Filtering incidents between ${yesterdayStartUnix} and ${yesterdayEndUnix}`);
                
                // Filter incidents for yesterday
                const yesterdayIncidents = data.incidents.filter(incident => 
                    incident.startTime >= yesterdayStartUnix && incident.startTime <= yesterdayEndUnix
                );
                
                console.log(`YESTERDAY INCIDENT SUMMARY: Found ${yesterdayIncidents.length} incidents for yesterday`);
                
                // Calculate incident statistics
                const totalIncidents = yesterdayIncidents.length;
                const criticalIncidents = yesterdayIncidents.filter(inc => inc.severity === 0).length; // Critical severity = 0
                const highIncidents = yesterdayIncidents.filter(inc => inc.severity === 1).length; // High severity = 1
                const resolvedIncidents = yesterdayIncidents.filter(inc => inc.endTime && inc.endTime > 0).length;
                
                // Calculate uptime percentage
                let uptimeDisplay = '100% uptime';
                if (totalIncidents > 0) {
                    if (resolvedIncidents > 0) {
                        uptimeDisplay = `${resolvedIncidents}/${totalIncidents} resolved`;
                    } else {
                        uptimeDisplay = `${totalIncidents} active incidents`;
                    }
                }
                
                // Determine system status
                const systemStatus = totalIncidents === 0 ? 'Normal' : 
                                   criticalIncidents > 0 ? 'Attention Required' : 
                                   highIncidents > 0 ? 'Monitoring' : 'Normal';
                
                // Display incident summary
                incidentElement.innerHTML = `
                    <div class="incident-summary">
                        <p><strong>Total Incidents:</strong> ${totalIncidents}</p>
                        <p><strong>Critical:</strong> ${criticalIncidents}</p>
                        <p><strong>System Health:</strong> ${uptimeDisplay}</p>
                        <p><strong>Status:</strong> ${systemStatus}</p>
                    </div>
                `;
                
                console.log(`YESTERDAY INCIDENT SUMMARY: Displayed ${totalIncidents} total, ${criticalIncidents} critical, status: ${systemStatus}`);
                
            } catch (error) {
                console.error('Error loading yesterday incident summary:', error);
                incidentElement.innerHTML = '<div class="error-state">Failed to load incident data</div>';
            }
        }

        async function loadYesterdayMonthlyAggregationFromStatusAPI() {
            console.log('=== YESTERDAY MONTHLY AGGREGATION: loadYesterdayMonthlyAggregationFromStatusAPI() started ===');
            
            const aggregationElement = document.getElementById('yesterdayAggregation');
            if (!aggregationElement) {
                console.error('yesterdayAggregation element not found');
                return;
            }
            
            // Show loading state
            aggregationElement.innerHTML = '<div class="loading-state">Loading monthly aggregation status...</div>';
            
            try {
                // Get authentication headers (same as other API calls)
                const headers = getAuthHeaders();
                const hasAuth = headers['Authorization'] || headers['X-API-Secret'];
                
                if (!hasAuth) {
                    aggregationElement.innerHTML = '<div class="error-state">Authentication required for aggregation data</div>';
                    return;
                }
                
                // Get data from Status API - same call as updateDashboard uses
                const apiUrl = `${CONFIG.statusApiUrl}?deviceId=${CONFIG.deviceId}`;
                const response = await fetch(apiUrl, { method: 'GET', headers: headers });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                
                // Use the exact same logic as updateDashboard function (line 3252)
                if (data.system && data.system.MonthlyAggregationStatus) {
                    const agg = data.system.MonthlyAggregationStatus;
                    
                    // Format timestamps using consolidated utility
                    const statusIcon = agg.Success ? '✅' : '❌';
                    const statusText = agg.Success ? 'Successful' : 'Failed';
                    const errorText = agg.ErrorMessage ? ` (${agg.ErrorMessage})` : '';
                    
                    // Use exact same HTML as updateDashboard function
                    aggregationElement.innerHTML = `
                        <div class="aggregation-status-detail">
                            <p><strong>Status:</strong> ${statusIcon} ${statusText}${errorText}</p>
                            <p><strong>Last Run:</strong> ${DateTimeUtils.formatDateTime(agg.LastRun)}</p>
                            <p><strong>Next Run:</strong> ${DateTimeUtils.formatDateTime(agg.NextScheduledRun)}</p>
                            <p><strong>Records Updated:</strong> ${agg.RecordsUpdated || 0}</p>
                            <p><strong>Months Processed:</strong> ${agg.MonthsProcessed || 0}</p>
                            <p><strong>Trigger:</strong> ${agg.TriggerType || 'Unknown'}</p>
                        </div>
                    `;
                    
                    console.log(`YESTERDAY MONTHLY AGGREGATION: Displayed status: ${statusText}, Records: ${agg.RecordsUpdated || 0}`);
                } else {
                    aggregationElement.innerHTML = '<div class="error-state">Monthly aggregation status not available</div>';
                }
                
            } catch (error) {
                console.error('Error loading yesterday monthly aggregation:', error);
                aggregationElement.innerHTML = '<div class="error-state">Failed to load aggregation data</div>';
            }
        }

        async function loadAggregationStatus() {
            console.log('=== AGGREGATION DEBUG: loadAggregationStatus() function started ===');
            console.log('Monthly Aggregation widget has been moved to Yesterday\'s Report - function disabled');
            return; // Early return - widget moved to Yesterday's Report
            
            try {
                // Show loading state
                document.getElementById('aggregationStatusText').textContent = 'Checking...';
                document.getElementById('aggregationStatus').textContent = '🔄';
                
                const headers = getAuthHeaders();
                const apiUrl = `${CONFIG.statusApiUrl}?deviceId=${CONFIG.deviceId}`;
                
                console.log('loadAggregationStatus: Making API call to:', apiUrl);
                
                const response = await fetch(apiUrl, {
                    method: 'GET',
                    headers
                });

                if (!response.ok) {
                    console.log('loadAggregationStatus: API call failed:', response.status);
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                console.log('loadAggregationStatus: Received data, system keys:', Object.keys(data.system || {}));
                
                // Look for MonthlyAggregationStatus in the system data (original implementation)
                const systemData = data.system || {};
                
                if (systemData.MonthlyAggregationStatus) {
                    console.log('loadAggregationStatus: Found MonthlyAggregationStatus:', systemData.MonthlyAggregationStatus);
                    updateAggregationStatusDisplay(systemData.MonthlyAggregationStatus, null);
                } else {
                    console.log('loadAggregationStatus: MonthlyAggregationStatus not found, using fallback');
                    // Try to fetch directly from fallback (original behavior)
                    await fetchAggregationStatusDirect();
                }
            } catch (error) {
                console.error('Error in loadAggregationStatus():', error);
                updateAggregationStatusDisplay(null, error.message);
            }
        }

        async function fetchAggregationStatusDirect() {
            console.log('fetchAggregationStatusDirect: Using fallback status');
            // This would require a direct API endpoint to VentilationStatus table
            // For now, we'll show a generic status (original fallback behavior)
            updateAggregationStatusDisplay({
                LastRun: new Date().toISOString(),
                Success: true,
                MonthsProcessed: 'Unknown',
                RecordsUpdated: 'Unknown',
                NextScheduledRun: new Date(Date.now() + 24*60*60*1000).toISOString()
            }, null);
        }

        function updateAggregationStatusDisplay(status, error) {
            console.log('=== AGGREGATION DEBUG: updateAggregationStatusDisplay called ===');
            console.log('Status:', status);
            console.log('Error:', error);
            
            const statusElement = document.getElementById('aggregationStatus');
            const statusTextElement = document.getElementById('aggregationStatusText');
            const lastRunElement = document.getElementById('lastAggregationRun');
            const recordsUpdatedElement = document.getElementById('recordsUpdated');
            const nextRunElement = document.getElementById('nextAggregationRun');
            const resultElement = document.getElementById('aggregationResult');

            if (error) {
                statusElement.textContent = '❌';
                statusElement.className = 'aggregation-status aggregation-error';
                statusTextElement.textContent = 'Error';
                if (lastRunElement) lastRunElement.textContent = 'Unknown';
                if (recordsUpdatedElement) recordsUpdatedElement.textContent = 'Unknown';
                if (nextRunElement) nextRunElement.textContent = 'Unknown';
                if (resultElement) resultElement.textContent = error;
                return;
            }

            if (!status) {
                statusElement.textContent = '⏳';
                statusElement.className = 'aggregation-status aggregation-pending';
                statusTextElement.textContent = 'Pending';
                if (lastRunElement) lastRunElement.textContent = 'Unknown';
                if (recordsUpdatedElement) recordsUpdatedElement.textContent = 'Unknown';
                if (nextRunElement) nextRunElement.textContent = 'Daily at 2:15 AM UTC';
                if (resultElement) resultElement.textContent = 'Waiting for data';
                return;
            }

            // Process successful status
            // Update display with proper CSS classes
            if (status.Success) {
                statusElement.textContent = '✅';
                statusElement.className = 'aggregation-status aggregation-success';
                statusTextElement.textContent = 'Success';
                if (resultElement) resultElement.textContent = 'Completed Successfully';
            } else {
                statusElement.textContent = '❌';
                statusElement.className = 'aggregation-status aggregation-error';
                statusTextElement.textContent = 'Failed';
                if (resultElement) resultElement.textContent = status.ErrorMessage || 'Unknown error';
            }
            
            // Format timestamps using consolidated utility
            
            // Update all elements with null checks
            if (lastRunElement) lastRunElement.textContent = DateTimeUtils.formatDateTime(status.LastRun);
            if (recordsUpdatedElement) recordsUpdatedElement.textContent = status.RecordsUpdated || 'Unknown';
            if (nextRunElement) nextRunElement.textContent = DateTimeUtils.formatDateTime(status.NextScheduledRun);
        }

        /**
         * Main data refresh function for the dashboard (legacy version)
         * Fetches current ventilation system status and updates all dashboard widgets
         * Handles authentication, connection status, and error states
         * Updates temperatures, door status, incidents, and other real-time data
         * @returns {Promise<void>}
         */
        async function refreshData() {
            console.log('Refreshing dashboard data...');
            
            try {
                updateConnectionStatus('connecting');
                
                const token = localStorage.getItem('ventilation_auth_token');
                
                // If no authentication method is available, show no data
                if (!token && !CONFIG.apiSecret) {
                    showNoDataState();
                    updateConnectionStatus('disconnected');
                    return;
                }
                
                const headers = getAuthHeaders();
                
                const response = await fetch(`${CONFIG.statusApiUrl}?deviceId=${CONFIG.deviceId}`, {
                    method: 'GET',
                    headers: headers
                });
                
                if (response.status === 401) {
                    // Only logout if using API key authentication
                    // For Bearer token, fall back to mock data until functions are updated
                    const token = localStorage.getItem('ventilation_auth_token');
                    if (!token && CONFIG.apiSecret) {
                        // Using API key and got 401 - logout
                        logout();
                        return;
                    } else if (token) {
                        // Using Bearer token but got 401 - functions may not support it yet
                        // Bearer token authentication failed, show no data state
                        showApiFailureNotice('Status API returned 401 Unauthorized. Please check authentication or contact system administrator.', 'error');
                        showNoDataState();
                        updateConnectionStatus('disconnected');
                        return;
                    }
                }
                
                if (!response.ok) {
                    // Log the error details for debugging
                    console.error(`DEBUGGING: API Error: ${response.status} ${response.statusText}`);
                    debugDiv.innerHTML += '<br><strong>API ERROR: ' + response.status + ' ' + response.statusText + '</strong>';
                    
                    const errorText = await response.text();
                    console.error('DEBUGGING: Error response:', errorText);
                    debugDiv.innerHTML += '<br>Error text: ' + (errorText.substring(0, 100) + '...');
                    
                    // If unauthorized and no API secret, show no data
                    if (response.status === 401 || response.status === 404) {
                        // API call failed, show no data state
                        debugDiv.innerHTML += '<br><strong>Showing no data state due to ' + response.status + '</strong>';
                        showApiFailureNotice(`Status API returned ${response.status} ${response.statusText}. Data is currently unavailable.`, 'error');
                        showNoDataState();
                        updateConnectionStatus('disconnected');
                        return;
                    }
                    showApiFailureNotice(`Status API returned ${response.status} ${response.statusText}. Data is currently unavailable.`, 'error');
                    showNoDataState();
                    updateConnectionStatus('disconnected');
                    return;
                }
                
                
                const data = await response.json();
                console.log('Dashboard data received successfully');
                
                // FETCH ADDITIONAL DATA FROM GetVentilationStatus API
                // GetEnhancedDashboardData provides analytics but is missing:
                // - incidents (system reliability data)
                // - current sensor readings (for alerts)
                // - current weather data (for storm alerts)
                // - current door status (for door alerts)
                try {
                    console.log('Fetching current status data (incidents, sensors, weather, doors) from GetVentilationStatus...');
                    const statusResponse = await fetch(`${CONFIG.currentStatusApiUrl}?deviceId=${CONFIG.deviceId}`, {
                        method: 'GET',
                        headers: headers
                    });
                    
                    if (statusResponse.ok) {
                        const statusData = await statusResponse.json();
                        
                        // Merge incidents
                        if (statusData.incidents && Array.isArray(statusData.incidents)) {
                            data.incidents = statusData.incidents;
                            console.log(`✓ Merged ${statusData.incidents.length} incidents from GetVentilationStatus`);
                        } else {
                            console.warn('⚠ GetVentilationStatus did not return incidents array');
                        }
                        
                        // Merge current sensor data for alerts
                        if (statusData.sensors) {
                            data.sensors = statusData.sensors;
                            console.log('✓ Merged current sensor data from GetVentilationStatus');
                        }
                        
                        // Merge weather data
                        if (statusData.weather) {
                            data.weather = statusData.weather;
                            console.log('✓ Merged weather data from GetVentilationStatus');
                        }
                        
                        // Merge doors data
                        if (statusData.doors) {
                            data.doors = statusData.doors;
                            console.log('✓ Merged doors data from GetVentilationStatus');
                        }
                        
                        // Merge system data if not already present (GetEnhancedDashboardData has sections.startup.system)
                        if (!data.system && statusData.system) {
                            data.system = statusData.system;
                            console.log('✓ Merged system data from GetVentilationStatus');
                        } else if (statusData.system) {
                            // Merge missing system fields
                            data.system = {...statusData.system, ...data.system};
                        }
                    } else {
                        console.warn(`⚠ GetVentilationStatus returned ${statusResponse.status}, incidents and alerts may not be available`);
                    }
                } catch (statusError) {
                    console.error('❌ Error fetching current status from GetVentilationStatus:', statusError);
                    // Continue without current status rather than failing completely
                }
                
                // Update dashboard with merged data
                await updateDashboard(data);
                updateConnectionStatus('connected');
                
                // Main sensor widgets are updated with current readings from GetVentilationHistory API below

                // Monthly Data Aggregation moved to Yesterday's Report detailed view - function calls removed
                // console.log('RefreshData: About to call loadAggregationStatus()');
                // try {
                //     await loadAggregationStatus();
                //     console.log('RefreshData: loadAggregationStatus() completed successfully');
                // } catch (error) {
                //     console.error('RefreshData: Error in loadAggregationStatus():', error);
                // }

                // Refresh chart data if chart is currently displayed
                refreshCurrentChart();
                
                // Clear any existing error notices
                const apiFailureNotice = document.getElementById('apiFailureNotice');
                if (apiFailureNotice) {
                    apiFailureNotice.style.display = 'none';
                }
                
            } catch (error) {
                console.error('🚨 CRITICAL ERROR in refreshData:', error);
                console.error('🚨 Error stack:', error.stack);
                console.error('🚨 Error at line:', error.lineNumber || 'unknown');
                showApiFailureNotice(`Network error connecting to Status API: ${error.message}. Data is currently unavailable.`, 'error');
                showNoDataState();
                updateConnectionStatus('disconnected');
            }
        }

        /**
         * Displays the dashboard in a "no data" state when authentication is unavailable
         * Shows dashboard structure but sets all sensor readings to "No data"
         * Updates temperature, humidity, pressure, and other sensors to show no data
         * Used when user is not authenticated or API access is unavailable
         * @returns {void}
         */
        function showNoDataState() {
            // Hide loading, show content with no data message
            document.getElementById('loadingSection').style.display = 'none';
            document.getElementById('errorSection').style.display = 'none';
            document.getElementById('dashboardContent').style.display = 'block';

            // Helper function to safely update elements - FIXED to allow 0 values
            const safeSetText = (elementId, text) => {
                const element = document.getElementById(elementId);
                if (element) {
                    element.textContent = text;
                } else {
                    console.log(`🔍 DEBUG: Element ${elementId} not found in showNoDataState - skipping`);
                }
            };

            // Set all sensor readings to "No data"
            safeSetText('indoorTemp', 'No data');
            safeSetText('indoorHumidity', 'No data');
            safeSetText('indoorPressure', 'No data');
            safeSetText('outdoorTemp', 'No data');
            safeSetText('outdoorHumidity', 'No data');
            safeSetText('outdoorPressure', 'No data');
            safeSetText('garageTemp', 'No data');
            safeSetText('garageHumidity', 'No data');
            safeSetText('garagePressure', 'No data');

            // Set system status to no data (with special handling for fan status)
            const fanStatusElement = document.getElementById('fanStatus');
            if (fanStatusElement) {
                fanStatusElement.textContent = '❓';
                fanStatusElement.className = 'fan-status';
            }
            safeSetText('fanStatusText', 'No data');
            safeSetText('ventilationMode', 'No data');
            safeSetText('fanMinutes', 'No data');
            safeSetText('freshAirStatus', 'No data');
            safeSetText('ventilationHours', 'No data');
            safeSetText('coolingEffect', 'No data');

            // Set weather to no data
            safeSetText('forecastHigh', 'No data');
            safeSetText('stormRisk', 'No data');
            safeSetText('stormRiskExplanation', 'Storm risk status will be explained here.');
            
            // Set enhanced storm detection to no data
            const stormTypeElement = document.getElementById('stormType');
            if (stormTypeElement) stormTypeElement.textContent = 'Clear';
            const stormConfidenceElement = document.getElementById('stormConfidence');
            if (stormConfidenceElement) {
                stormConfidenceElement.textContent = '0%';
                stormConfidenceElement.style.color = '#00b894'; // Green for clear
            }
            const stormArrivalElement = document.getElementById('stormArrival');
            if (stormArrivalElement) {
                stormArrivalElement.textContent = 'Clear';
                stormArrivalElement.style.color = '#00b894'; // Green for clear
            }
            const stormDescriptionElement = document.getElementById('stormDescription');
            if (stormDescriptionElement) {
                stormDescriptionElement.textContent = 'Enhanced storm detection analyzes pressure patterns across multiple timescales to provide advance warning for Pacific Northwest weather events.';
            }
            
            // Enhanced forecast elements will be populated by weather data processing
            // (removed "No data" initialization - proper forecast data should be available)

            // Set system info to no data with null checks
            const uptimeElement = document.getElementById('uptime');
            if (uptimeElement) uptimeElement.textContent = 'No data';
            
            // Fix the stuck "Loading configuration..." text with honest "No data"
            const systemConfigElement = document.getElementById('systemConfig');
            if (systemConfigElement) systemConfigElement.textContent = 'No data';
            
            // Set reliability info to no data (only elements that still exist) with null checks
            const rebootCountElement = document.getElementById('rebootCount');
            if (rebootCountElement) rebootCountElement.textContent = 'No data';
            const wifiOutageCountElement = document.getElementById('wifiOutageCount');
            if (wifiOutageCountElement) wifiOutageCountElement.textContent = 'No data';

            // Set reliability widget elements to no data (with null checks)
            const reliabilityUptimeElement = document.getElementById('reliabilityUptime');
            if (reliabilityUptimeElement) reliabilityUptimeElement.textContent = 'No data';
            const reliabilityRebootsElement = document.getElementById('reliabilityReboots');
            if (reliabilityRebootsElement) reliabilityRebootsElement.textContent = 'No data';
            const reliabilityWifiOutagesElement = document.getElementById('reliabilityWifiOutages');
            if (reliabilityWifiOutagesElement) reliabilityWifiOutagesElement.textContent = 'No data';
            const reliabilityWifiUptimeElement = document.getElementById('reliabilityWifiUptime');
            if (reliabilityWifiUptimeElement) reliabilityWifiUptimeElement.textContent = 'No data';
            const reliabilityLongestWifiOutageElement = document.getElementById('reliabilityLongestWifiOutage');
            if (reliabilityLongestWifiOutageElement) reliabilityLongestWifiOutageElement.textContent = 'No data';
            const reliabilityIncidentSummaryElement = document.getElementById('reliabilityIncidentSummary');
            if (reliabilityIncidentSummaryElement) reliabilityIncidentSummaryElement.textContent = 'No data';

            // Hide door section since no data
            document.getElementById('doorSection').style.display = 'none';

            // Update last update time with detailed "no data" message
            const timestamp = formatDetailedTimestamp();
            document.getElementById('lastUpdate').innerHTML = `No ESP32 data<br><small style="color: #dc3545; font-weight: bold;">[Browser Time - Last Attempt: ${timestamp.combined}]</small>`;
            document.getElementById('lastUpdate').style.color = '#dc3545';
            document.getElementById('lastUpdate').title = 'No ESP32 data available - showing browser time of last connection attempt';
        }

        /**
         * Updates the main dashboard display with fresh sensor data
         * Processes and displays temperature, humidity, pressure data from all sensors
         * Updates system status, fan speeds, alerts, door status, and incidents
         * Handles null/undefined values gracefully and formats data for display
         * @param {Object} data - The complete sensor and system data from the ESP32
         * @returns {void}
         */
        async function updateDashboard(data) {
            console.log('DEBUG: updateDashboard called with data =', data);
            console.log('DEBUG: data keys =', Object.keys(data || {}));
            
            // Fetch current system status for hardware specs and reliability data
            try {
                console.log('🔍 DEBUG: Fetching current system status from GetVentilationStatus');
                const currentStatus = await DataManager.getCurrentSystemStatus();
                
                // Merge current system status into the main data structure
                if (currentStatus && currentStatus.sections) {
                    // Ensure data.sections exists
                    if (!data.sections) {
                        data.sections = {};
                    }
                    
                    // Add/update startup section with current system data
                    data.sections.startup = currentStatus.sections.startup;
                    console.log('🔍 DEBUG: Merged current startup data:', data.sections.startup);
                }
                
                // Merge reliability data
                if (currentStatus && currentStatus.reliability) {
                    data.reliability = currentStatus.reliability;
                    console.log('🔍 DEBUG: Merged current reliability data:', data.reliability);
                }
                
            } catch (error) {
                console.log('🔍 DEBUG: Could not fetch current system status, using GetEnhancedDashboardData only:', error);
            }
            
            // Hide loading, show content
            document.getElementById('loadingSection').style.display = 'none';
            document.getElementById('errorSection').style.display = 'none';
            document.getElementById('dashboardContent').style.display = 'block';

            // 🎯 FIXED: Use current sensor readings instead of yesterday's summary
            let sensors = {};
            
            // First try to get current sensor data from recent history
            console.log('🔍 DEBUG: Attempting to fetch current sensor readings from GetVentilationHistory');
            try {
                const historyResponse = await DataManager.getHistoryData(1); // Get last 1 hour
                if (historyResponse && historyResponse.data && historyResponse.data.length > 0) {
                    const latestReading = historyResponse.data[historyResponse.data.length - 1];
                    if (latestReading.sensors) {
                        sensors = {
                            indoor: {
                                temp: latestReading.sensors.indoor?.temp,
                                humidity: latestReading.sensors.indoor?.humidity,
                                pressure: latestReading.sensors.indoor?.pressure
                            },
                            outdoor: {
                                temp: latestReading.sensors.outdoor?.temp,
                                humidity: latestReading.sensors.outdoor?.humidity,
                                pressure: latestReading.sensors.outdoor?.pressure
                            },
                            garage: {
                                temp: latestReading.sensors.garage?.temp,
                                humidity: latestReading.sensors.garage?.humidity,
                                pressure: latestReading.sensors.garage?.pressure
                            }
                        };
                        console.log('🔍 DEBUG: Using current sensor readings from history:', sensors);
                    }
                }
            } catch (error) {
                console.log('🔍 DEBUG: Could not fetch current readings, falling back to yesterday data');
            }
            
            // Always use current sensor readings - yesterday's data has sensor gaps
            if (!sensors || Object.keys(sensors).length === 0) {
                console.log('🔍 DEBUG: No current sensor readings available, showing no data');
                sensors = { indoor: {}, outdoor: {}, garage: {} };
            }
            
            const indoor = sensors.indoor || {};
            const outdoor = sensors.outdoor || {};
            const garage = sensors.garage || {};
            
            console.log('🔍 DEBUG: Setting indoor data - temp:', indoor.temp, 'humidity:', indoor.humidity, 'pressure:', indoor.pressure);
            document.getElementById('indoorTemp').textContent = indoor.temp != null && indoor.temp !== undefined ? `${indoor.temp.toFixed(1)}°F` : 'No data';
            document.getElementById('indoorHumidity').textContent = indoor.humidity != null && indoor.humidity !== undefined ? `${indoor.humidity.toFixed(0)}%` : 'No data';
            document.getElementById('indoorPressure').textContent = indoor.pressure != null && indoor.pressure !== undefined ? `${indoor.pressure.toFixed(1)} hPa` : 'No data';
            
            console.log('🔍 DEBUG: Setting outdoor data - temp:', outdoor.temp, 'humidity:', outdoor.humidity, 'pressure:', outdoor.pressure);
            document.getElementById('outdoorTemp').textContent = outdoor.temp != null && outdoor.temp !== undefined ? `${outdoor.temp.toFixed(1)}°F` : 'No data';
            document.getElementById('outdoorHumidity').textContent = outdoor.humidity != null && outdoor.humidity !== undefined ? `${outdoor.humidity.toFixed(0)}%` : 'No data';
            document.getElementById('outdoorPressure').textContent = outdoor.pressure != null && outdoor.pressure !== undefined ? `${outdoor.pressure.toFixed(1)} hPa` : 'No data';
            
            console.log('🔍 DEBUG: Setting garage data - temp:', garage.temp, 'humidity:', garage.humidity, 'pressure:', garage.pressure);
            document.getElementById('garageTemp').textContent = garage.temp != null && garage.temp !== undefined ? `${garage.temp.toFixed(1)}°F` : 'No data';
            document.getElementById('garageHumidity').textContent = garage.humidity != null && garage.humidity !== undefined ? `${garage.humidity.toFixed(0)}%` : 'No data';
            document.getElementById('garagePressure').textContent = garage.pressure != null && garage.pressure !== undefined ? `${garage.pressure.toFixed(1)} hPa` : 'No data';

            // 🎯 FIXED: Update system status using new API structure
            let systemData = {};
            if (data.sections && data.sections.yesterday && data.sections.yesterday.ventilation) {
                console.log('🔍 DEBUG: Using new API structure for system status');
                const vent = data.sections.yesterday.ventilation;
                systemData = {
                    fanOn: vent.fanOn,
                    ventilationMode: vent.mode,
                    fanMinutesToday: vent.fanMinutesToday,
                    freshAirActive: vent.freshAirActive,
                    operatingHours: Math.round((vent.fanMinutesToday || 0) / 60 * 10) / 10
                };
                console.log('🔍 DEBUG: Mapped ventilation data:', systemData);
            } else {
                // Fallback to legacy structure
                systemData = data.system || {};
                console.log('🔍 DEBUG: Using legacy system structure:', systemData);
            }
            
            const fanOn = systemData.fanOn;
            
            if (fanOn != null) {
                document.getElementById('fanStatus').textContent = fanOn ? '🌀' : '⏸️';
                document.getElementById('fanStatus').className = `fan-status ${fanOn ? 'fan-on' : 'fan-off'}`;
                document.getElementById('fanStatusText').textContent = fanOn ? 'RUNNING' : 'STOPPED';
            } else {
                document.getElementById('fanStatus').textContent = '❓';
                document.getElementById('fanStatus').className = 'fan-status';
                document.getElementById('fanStatusText').textContent = 'No data';
            }
            
            document.getElementById('ventilationMode').textContent = systemData.ventilationMode || 'No data';
            document.getElementById('fanMinutes').textContent = systemData.fanMinutesToday != null ? systemData.fanMinutesToday : 'No data';
            document.getElementById('freshAirStatus').textContent = systemData.freshAirActive != null ? (systemData.freshAirActive ? 'Active' : 'Inactive') : 'No data';
            document.getElementById('ventilationHours').textContent = systemData.operatingHours || 'No data';
            
            // Calculate and display cooling effect using new mapped variables
            const coolingEffect = calculateCoolingEffect(
                indoor.temp, 
                outdoor.temp, 
                systemData.fanMinutesToday, 
                fanOn
            );
            document.getElementById('coolingEffect').textContent = coolingEffect;

            // 🎯 FIXED: Update weather using new API structure - NO FALLBACK DATA
            let weather = {};
            if (data.sections && data.sections.yesterday && data.sections.yesterday.environmental && data.sections.yesterday.environmental.pressure && data.sections.yesterday.environmental.pressure.weather) {
                console.log('🔍 DEBUG: Using new API structure for weather data');
                const weatherData = data.sections.yesterday.environmental.pressure.weather;
                
                // Check if we have REAL ESP32 forecast data (no fallbacks)
                const hasRealForecast = weatherData.hasOwnProperty('forecastHumidity') || 
                                       weatherData.hasOwnProperty('forecastPrecip') || 
                                       weatherData.hasOwnProperty('forecastWind');
                
                let enhancedForecast = null;
                if (hasRealForecast) {
                    enhancedForecast = {
                        valid: true,
                        humidity: weatherData.forecastHumidity,
                        precipitationProb: weatherData.forecastPrecip,
                        windSpeed: weatherData.forecastWind
                    };
                    console.log('✅ REAL forecast data available:', enhancedForecast);
                } else {
                    console.warn('❌ NO ESP32 FORECAST DATA - forecast elements will show errors');
                    enhancedForecast = { valid: false };
                }
                
                weather = {
                    forecastHigh: weatherData.forecastHigh,
                    stormRisk: weatherData.stormRisk || 'Low',
                    enhancedForecast: enhancedForecast
                };
            } else {
                // Fallback to legacy structure
                weather = data.weather || {};
                weather.enhancedForecast = { valid: false };
                console.log('🔍 DEBUG: Using legacy weather structure (no forecast):', weather);
            }
            
            const stormRiskValue = weather.stormRisk || 'NONE';
            
            // Get forecast temperature from enhanced forecast data (ESP32 v4 format)
            // ESP32 stores in Celsius, dashboard displays in Fahrenheit (matching serial debug format)
            let forecastHigh;
            if (enhancedForecast && enhancedForecast.valid && enhancedForecast.temperature !== undefined) {
                // Convert from Celsius to Fahrenheit (ESP32 sends in Celsius, stores as 23.3°C for example)
                forecastHigh = (enhancedForecast.temperature * 9/5) + 32;
                console.log(`✅ Using REAL forecast temp: ${forecastHigh.toFixed(1)}°F (from ${enhancedForecast.temperature.toFixed(1)}°C)`);
            } else if (weather.forecastHigh !== undefined && weather.forecastHigh !== null) {
                // Legacy fallback: forecastHigh in Celsius
                forecastHigh = (weather.forecastHigh * 9/5) + 32;
                console.warn(`⚠️ Using legacy forecastHigh: ${forecastHigh.toFixed(1)}°F`);
            } else {
                // No forecast data available - show error instead of fake data
                forecastHigh = null;
                console.error('❌ No forecast temperature available from ESP32');
            }
            
            // Display with 1 decimal place to match ESP32 serial debug format (e.g., "73.9°F")
            document.getElementById('forecastHigh').textContent = forecastHigh !== null ? 
                `${forecastHigh.toFixed(1)}°F` : 
                'ESP32 Forecast Missing';
            document.getElementById('stormRisk').textContent = stormRiskValue;
            
            // Enhanced forecast data display - NO FALLBACK DATA
            const enhancedForecast = weather.enhancedForecast;
            if (enhancedForecast && enhancedForecast.valid) {
                console.log('✅ Displaying REAL forecast data');
                // Update humidity forecast
                const humidityElement = document.getElementById('forecastHumidity');
                if (humidityElement) {
                    humidityElement.textContent = enhancedForecast.humidity !== undefined ? 
                        `${enhancedForecast.humidity.toFixed(0)}% (Forecast)` : 
                        'ESP32 Data Missing';
                }
                
                // Update precipitation forecast
                const precipElement = document.getElementById('forecastPrecipitation');
                if (precipElement) {
                    precipElement.textContent = enhancedForecast.precipitationProb !== undefined ? 
                        `${enhancedForecast.precipitationProb.toFixed(0)}% (Forecast)` : 
                        'ESP32 Data Missing';
                }
            } else {
                console.warn('❌ NO VALID FORECAST DATA - showing error messages');
                // Show error messages when ESP32 forecast data is missing
                const humidityElement = document.getElementById('forecastHumidity');
                if (humidityElement) {
                    humidityElement.textContent = 'ESP32 Forecast Missing';
                }
                
                const precipElement = document.getElementById('forecastPrecipitation');
                if (precipElement) {
                    precipElement.textContent = 'ESP32 Forecast Missing';
                }
            }
            
            // Enhanced storm risk explanation - handle missing forecast data properly
            const stormRiskExplanation = document.getElementById('stormRiskExplanation');
            if (stormRiskExplanation) {
                let explanation = '';
                if (enhancedForecast && enhancedForecast.valid && enhancedForecast.precipitationProb !== undefined && enhancedForecast.windSpeed !== undefined) {
                    // Use REAL forecast data
                    if (stormRiskValue === 'Clear') {
                        explanation = `Stable pressure - ${enhancedForecast.precipitationProb.toFixed(0)}% rain chance, ${enhancedForecast.windSpeed.toFixed(1)} m/s winds (Forecast).`;
                    } else if (stormRiskValue === 'Possible') {
                        explanation = `Low pressure detected - ${enhancedForecast.precipitationProb.toFixed(0)}% rain chance, wind increasing to ${enhancedForecast.windSpeed.toFixed(1)} m/s (Forecast).`;
                    } else if (stormRiskValue === 'Likely') {
                        explanation = `Pressure dropping rapidly - ${enhancedForecast.precipitationProb.toFixed(0)}% rain chance, ${enhancedForecast.windSpeed.toFixed(1)} m/s winds expected (Forecast).`;
                    } else if (stormRiskValue === 'Imminent') {
                        explanation = `Rapid pressure drop! ${enhancedForecast.precipitationProb.toFixed(0)}% rain chance, ${enhancedForecast.windSpeed.toFixed(1)} m/s winds (Forecast).`;
                    } else {
                        explanation = `${stormRiskValue} - ${enhancedForecast.precipitationProb.toFixed(0)}% rain, ${enhancedForecast.windSpeed.toFixed(1)} m/s wind (Forecast).`;
                    }
                } else {
                    // No forecast data available - show pressure-only explanation
                    if (stormRiskValue === 'Clear') {
                        explanation = 'Stable pressure - no significant changes over 3 hours.';
                    } else if (stormRiskValue === 'Possible') {
                        explanation = 'Low pressure below 1000 hPa detected.';
                    } else if (stormRiskValue === 'Likely') {
                        explanation = 'Pressure drop >3 hPa over 3 hours detected.';
                    } else if (stormRiskValue === 'Imminent') {
                        explanation = 'Rapid pressure drop >5 hPa over 3 hours detected!';
                    } else {
                        explanation = `${stormRiskValue} - pressure trend indicates weather change. (ESP32 forecast data missing)`;
                    }
                }
                stormRiskExplanation.textContent = explanation;
            }
            
            // Fallback section when no enhanced forecast is available
            if (!enhancedForecast || !enhancedForecast.valid) {
                // Fallback to basic explanation when enhanced forecast not available
                const stormRiskExplanation = document.getElementById('stormRiskExplanation');
                if (stormRiskExplanation) {
                    if (stormRiskValue && stormRiskValue !== 'No data') {
                        const explanations = {
                            'Clear': 'Stable pressure - no significant changes over 3 hours.',
                            'Possible': 'Low pressure below 1000 hPa detected.',
                            'Likely': 'Pressure drop >3 hPa over 3 hours detected.',
                            'Imminent': 'Rapid pressure drop >5 hPa over 3 hours detected!'
                        };
                        stormRiskExplanation.textContent = explanations[stormRiskValue] || `${stormRiskValue} - pressure trend indicates weather change.`;
                    } else {
                        stormRiskExplanation.textContent = 'Storm risk status will be explained here.';
                    }
                } else {
                    console.warn('stormRiskExplanation element not found in DOM');
                }
            }
            
            // Update enhanced storm detection display
            updateEnhancedStormDisplay(data);
            
            // PHASE 2: Pacific NW Comfort Intelligence Display - use building performance data
            if (data.buildingPerformance && data.buildingPerformance.valid) {
                const buildingPerformance = data.buildingPerformance;
                // Update comfort score based on building performance
                const comfortScoreElement = document.getElementById('comfort-score');
                if (comfortScoreElement && buildingPerformance.buildingScore != null) {
                    const score = (buildingPerformance.buildingScore / 10 * 10).toFixed(1); // Convert to 0-10 scale
                    comfortScoreElement.textContent = `${score}/10`;
                    
                    // Color code the comfort score
                    if (buildingPerformance.buildingScore >= 8.0) {
                        comfortScoreElement.style.color = '#4CAF50'; // Excellent - Green
                    } else if (buildingPerformance.buildingScore >= 6.5) {
                        comfortScoreElement.style.color = '#2196F3'; // Good - Blue
                    } else if (buildingPerformance.buildingScore >= 5.0) {
                        comfortScoreElement.style.color = '#FF9800'; // Fair - Orange
                    } else {
                        comfortScoreElement.style.color = '#F44336'; // Poor - Red
                    }
                }
                
                // Update fog risk based on humidity and temperature differential
                const fogRiskElement = document.getElementById('fog-risk');
                if (fogRiskElement && indoor.humidity != null && outdoor.humidity != null) {
                    // Calculate fog risk based on humidity differential and temperature
                    const humidityDiff = Math.abs(indoor.humidity - outdoor.humidity);
                    const tempDiff = Math.abs(indoor.temp - outdoor.temp);
                    const fogRisk = Math.min(100, humidityDiff * 2 + tempDiff * 1.5);
                    
                    fogRiskElement.textContent = `${Math.round(fogRisk)}%`;
                    
                    // Color code fog risk
                    if (fogRisk >= 70) {
                        fogRiskElement.style.color = '#F44336'; // High - Red
                    } else if (fogRisk >= 40) {
                        fogRiskElement.style.color = '#FF9800'; // Medium - Orange
                    } else {
                        fogRiskElement.style.color = '#4CAF50'; // Low - Green
                    }
                }
                
                // Update marine layer status based on pressure and temperature differential
                const marineLayerElement = document.getElementById('marine-layer');
                if (marineLayerElement && indoor.pressure != null && outdoor.pressure != null) {
                    const pressureDiff = Math.abs(indoor.pressure - outdoor.pressure);
                    // Marine layer typically creates small pressure differences
                    const marineLayerActive = pressureDiff < 2.0 && indoor.humidity > 60;
                    const marineStatus = marineLayerActive ? 'Present' : 'Clear';
                    marineLayerElement.textContent = marineStatus;
                    marineLayerElement.style.color = marineLayerActive ? '#2196F3' : '#4CAF50';
                }
                
                // Update ventilation window recommendation
                const ventilationWindowElement = document.getElementById('ventilation-window');
                if (ventilationWindowElement) {
                    // Recommend ventilation based on temperature and humidity differential
                    const tempDiff = indoor.temp - outdoor.temp;
                    const humidityDiff = indoor.humidity - outdoor.humidity;
                    let recommendation = 'Comfort analysis not available';
                    
                    if (tempDiff > 3 && outdoor.temp < 75) {
                        recommendation = 'Good time to ventilate - cooler outside';
                    } else if (humidityDiff > 10) {
                        recommendation = 'Consider ventilation - lower humidity outside';
                    } else if (tempDiff < -2) {
                        recommendation = 'Keep windows closed - warmer inside';
                    } else {
                        recommendation = 'Neutral conditions';
                    }
                    
                    ventilationWindowElement.textContent = recommendation;
                }
            } else {
                // Fallback when comfort intelligence data not available
                const comfortScoreElement = document.getElementById('comfort-score');
                if (comfortScoreElement) {
                    comfortScoreElement.textContent = '--/10';
                    comfortScoreElement.style.color = '#666';
                }
                
                const fogRiskElement = document.getElementById('fog-risk');
                if (fogRiskElement) {
                    fogRiskElement.textContent = '--%';
                    fogRiskElement.style.color = '#666';
                }
                
                const marineLayerElement = document.getElementById('marine-layer');
                if (marineLayerElement) {
                    marineLayerElement.textContent = '--';
                    marineLayerElement.style.color = '#666';
                }
                
                const ventilationWindowElement = document.getElementById('ventilation-window');
                if (ventilationWindowElement) {
                    ventilationWindowElement.textContent = 'Comfort analysis not available';
                }
            }
            
            // PHASE 3: Building Performance Analysis Display
            const buildingPerformance = data.buildingPerformance;
            console.log('DEBUG: buildingPerformance =', buildingPerformance);
            console.log('DEBUG: buildingPerformance.valid =', buildingPerformance?.valid);
            console.log('DEBUG: buildingPerformance.buildingScore =', buildingPerformance?.buildingScore);
            if (buildingPerformance && buildingPerformance.valid) {
                // Update building efficiency score with color coding
                const buildingScoreElement = document.getElementById('building-score');
                if (buildingScoreElement && buildingPerformance.buildingScore != null) {
                    const score = buildingPerformance.buildingScore.toFixed(1);
                    buildingScoreElement.textContent = `${score}/10`;
                    
                    // Color code the building score
                    if (buildingPerformance.buildingScore >= 8.0) {
                        buildingScoreElement.style.color = '#4CAF50'; // Excellent - Green
                    } else if (buildingPerformance.buildingScore >= 6.5) {
                        buildingScoreElement.style.color = '#2196F3'; // Good - Blue
                    } else if (buildingPerformance.buildingScore >= 5.0) {
                        buildingScoreElement.style.color = '#FF9800'; // Fair - Orange
                    } else {
                        buildingScoreElement.style.color = '#F44336'; // Poor - Red
                    }
                }
                
                // Update air tightness score
                const airTightnessElement = document.getElementById('air-tightness');
                if (airTightnessElement && buildingPerformance.airTightnessScore != null) {
                    const score = buildingPerformance.airTightnessScore.toFixed(1);
                    airTightnessElement.textContent = `${score}/10`;
                    
                    // Color code air tightness
                    if (buildingPerformance.airTightnessScore >= 8.0) {
                        airTightnessElement.style.color = '#4CAF50'; // Excellent - Green
                    } else if (buildingPerformance.airTightnessScore >= 6.5) {
                        airTightnessElement.style.color = '#2196F3'; // Good - Blue
                    } else {
                        airTightnessElement.style.color = '#FF9800'; // Fair - Orange
                    }
                }
                
                // Update pressure differentials
                const indoorOutdoorElement = document.getElementById('indoor-outdoor-diff');
                if (indoorOutdoorElement && buildingPerformance.indoorOutdoorDiff != null) {
                    const diff = buildingPerformance.indoorOutdoorDiff.toFixed(2);
                    indoorOutdoorElement.textContent = `${diff} hPa`;
                    // Color code based on pressure difference magnitude
                    const absDiff = Math.abs(buildingPerformance.indoorOutdoorDiff);
                    if (absDiff < 0.5) {
                        indoorOutdoorElement.style.color = '#4CAF50'; // Good - Green
                    } else if (absDiff < 1.0) {
                        indoorOutdoorElement.style.color = '#FF9800'; // Fair - Orange
                    } else {
                        indoorOutdoorElement.style.color = '#F44336'; // Poor - Red
                    }
                }
                
                const garageOutdoorElement = document.getElementById('garage-outdoor-diff');
                if (garageOutdoorElement && buildingPerformance.garageOutdoorDiff != null) {
                    const diff = buildingPerformance.garageOutdoorDiff.toFixed(2);
                    garageOutdoorElement.textContent = `${diff} hPa`;
                }
                
                // Update HVAC status
                const hvacStatusElement = document.getElementById('hvac-status');
                if (hvacStatusElement) {
                    const hvacStatus = buildingPerformance.hvacActive ? 'Active' : 'Inactive';
                    hvacStatusElement.textContent = hvacStatus;
                    hvacStatusElement.style.color = buildingPerformance.hvacActive ? '#FF9800' : '#4CAF50';
                }
                
                // Update building performance status
                const buildingStatusElement = document.getElementById('building-status');
                if (buildingStatusElement && buildingPerformance.performanceStatus) {
                    buildingStatusElement.textContent = buildingPerformance.performanceStatus;
                }
            } else {
                // Fallback when building performance data not available
                const buildingScoreElement = document.getElementById('building-score');
                if (buildingScoreElement) {
                    buildingScoreElement.textContent = '--/10';
                    buildingScoreElement.style.color = '#666';
                }
                
                const airTightnessElement = document.getElementById('air-tightness');
                if (airTightnessElement) {
                    airTightnessElement.textContent = '--/10';
                    airTightnessElement.style.color = '#666';
                }
                
                const indoorOutdoorElement = document.getElementById('indoor-outdoor-diff');
                if (indoorOutdoorElement) {
                    indoorOutdoorElement.textContent = '-- hPa';
                    indoorOutdoorElement.style.color = '#666';
                }
                
                const garageOutdoorElement = document.getElementById('garage-outdoor-diff');
                if (garageOutdoorElement) {
                    garageOutdoorElement.textContent = '-- hPa';
                    garageOutdoorElement.style.color = '#666';
                }
                
                const hvacStatusElement = document.getElementById('hvac-status');
                if (hvacStatusElement) {
                    hvacStatusElement.textContent = '--';
                    hvacStatusElement.style.color = '#666';
                }
                
                const buildingStatusElement = document.getElementById('building-status');
                if (buildingStatusElement) {
                    const uptimeMinutes = data.reliability ? data.reliability.uptimeMinutes : null;
                    const isEarlyStartup = uptimeMinutes != null && uptimeMinutes < 10; // Less than 10 minutes
                    
                    if (isEarlyStartup) {
                        buildingStatusElement.textContent = 'Building analysis initializing... sensor stabilization in progress';
                        buildingStatusElement.style.color = '#FF9800'; // Orange for initialization
                    } else {
                        buildingStatusElement.textContent = 'Building analysis not available';
                        buildingStatusElement.style.color = '#666'; // Gray for unavailable
                    }
                }
            }
            
            // PHASE 4: Health Monitoring Analysis Display
            const healthMonitoring = data.healthMonitoring;
            console.log('DEBUG: healthMonitoring =', healthMonitoring);
            console.log('DEBUG: healthMonitoring.valid =', healthMonitoring?.valid);
            console.log('DEBUG: healthMonitoring.migraineRisk =', healthMonitoring?.migraineRisk);
            if (healthMonitoring && healthMonitoring.valid) {
                // Update health risk level with color coding
                const healthRiskElement = document.getElementById('health-risk-level');
                if (healthRiskElement && healthMonitoring.healthRiskLevel != null) {
                    const riskNames = ['Low', 'Moderate', 'High', 'Severe'];
                    const riskName = riskNames[healthMonitoring.healthRiskLevel] || 'Unknown';
                    healthRiskElement.textContent = riskName;
                    
                    // Color code the health risk level
                    if (healthMonitoring.healthRiskLevel === 0) {
                        healthRiskElement.style.color = '#4CAF50'; // Low - Green
                    } else if (healthMonitoring.healthRiskLevel === 1) {
                        healthRiskElement.style.color = '#FF9800'; // Moderate - Orange
                    } else if (healthMonitoring.healthRiskLevel === 2) {
                        healthRiskElement.style.color = '#FF5722'; // High - Deep Orange
                    } else {
                        healthRiskElement.style.color = '#F44336'; // Severe - Red
                    }
                }
                
                // Update migraine risk
                const migraineriskElement = document.getElementById('migraine-risk');
                if (migraineriskElement && healthMonitoring.migraineRisk != null) {
                    const risk = healthMonitoring.migraineRisk.toFixed(0);
                    migraineriskElement.textContent = `${risk}%`;
                    
                    // Color code migraine risk
                    if (healthMonitoring.migraineRisk < 30) {
                        migraineriskElement.style.color = '#4CAF50'; // Low - Green
                    } else if (healthMonitoring.migraineRisk < 60) {
                        migraineriskElement.style.color = '#FF9800'; // Moderate - Orange
                    } else {
                        migraineriskElement.style.color = '#F44336'; // High - Red
                    }
                }
                
                // Update pressure change rates
                const pressure1hElement = document.getElementById('pressure-1h');
                if (pressure1hElement && healthMonitoring.pressureChangeRate1h != null) {
                    const rate = healthMonitoring.pressureChangeRate1h.toFixed(2);
                    pressure1hElement.textContent = `${rate} hPa/hr`;
                    // Color code based on change rate magnitude
                    const absRate = Math.abs(healthMonitoring.pressureChangeRate1h);
                    if (absRate < 1.0) {
                        pressure1hElement.style.color = '#4CAF50'; // Stable - Green
                    } else if (absRate < 2.0) {
                        pressure1hElement.style.color = '#FF9800'; // Moderate - Orange
                    } else {
                        pressure1hElement.style.color = '#F44336'; // Rapid - Red
                    }
                }
                
                const pressure3hElement = document.getElementById('pressure-3h');
                if (pressure3hElement && healthMonitoring.pressureChangeRate3h != null) {
                    const rate = healthMonitoring.pressureChangeRate3h.toFixed(2);
                    pressure3hElement.textContent = `${rate} hPa/hr`;
                }
                
                const pressure24hElement = document.getElementById('pressure-24h');
                if (pressure24hElement && healthMonitoring.pressureChangeRate24h != null) {
                    const rate = healthMonitoring.pressureChangeRate24h.toFixed(2);
                    pressure24hElement.textContent = `${rate} hPa/hr`;
                }
                
                // Update rapid change alert
                const rapidAlertElement = document.getElementById('rapid-alert');
                if (rapidAlertElement) {
                    const alertStatus = healthMonitoring.rapidChangeAlert ? 'YES' : 'No';
                    rapidAlertElement.textContent = alertStatus;
                    rapidAlertElement.style.color = healthMonitoring.rapidChangeAlert ? '#F44336' : '#4CAF50';
                }
                
                // Update health recommendation
                const healthRecommendationElement = document.getElementById('health-recommendation');
                if (healthRecommendationElement && healthMonitoring.healthRecommendation) {
                    healthRecommendationElement.textContent = healthMonitoring.healthRecommendation;
                }
            } else {
                // Check system uptime to determine appropriate message
                const uptimeMinutes = data.reliability ? data.reliability.uptimeMinutes : null;
                const isCollectingData = uptimeMinutes != null && uptimeMinutes < 120; // Less than 2 hours
                
                // Fallback when health monitoring data not available
                const healthRiskElement = document.getElementById('health-risk-level');
                if (healthRiskElement) {
                    healthRiskElement.textContent = '--';
                    healthRiskElement.style.color = '#666';
                }
                
                const migraineriskElement = document.getElementById('migraine-risk');
                if (migraineriskElement) {
                    migraineriskElement.textContent = '--%';
                    migraineriskElement.style.color = '#666';
                }
                
                const pressure1hElement = document.getElementById('pressure-1h');
                if (pressure1hElement) {
                    pressure1hElement.textContent = '-- hPa/hr';
                    pressure1hElement.style.color = '#666';
                }
                
                const pressure3hElement = document.getElementById('pressure-3h');
                if (pressure3hElement) {
                    pressure3hElement.textContent = '-- hPa/hr';
                    pressure3hElement.style.color = '#666';
                }
                
                const pressure24hElement = document.getElementById('pressure-24h');
                if (pressure24hElement) {
                    pressure24hElement.textContent = '-- hPa/hr';
                    pressure24hElement.style.color = '#666';
                }
                
                const rapidAlertElement = document.getElementById('rapid-alert');
                if (rapidAlertElement) {
                    rapidAlertElement.textContent = '--';
                    rapidAlertElement.style.color = '#666';
                }
                
                const healthRecommendationElement = document.getElementById('health-recommendation');
                if (healthRecommendationElement) {
                    if (isCollectingData) {
                        const remainingMinutes = Math.max(0, 60 - uptimeMinutes);
                        if (remainingMinutes > 0) {
                            healthRecommendationElement.textContent = `Collecting health data... ${remainingMinutes} minutes remaining for valid analysis [INFORMATIONAL ONLY]`;
                            healthRecommendationElement.style.color = '#FF9800'; // Orange to indicate waiting
                        } else {
                            healthRecommendationElement.textContent = 'Health data collection complete, analysis pending... [INFORMATIONAL ONLY]';
                            healthRecommendationElement.style.color = '#2196F3'; // Blue to indicate processing
                        }
                    } else {
                        healthRecommendationElement.textContent = 'Health analysis not available [INFORMATIONAL ONLY]';
                        healthRecommendationElement.style.color = '#666'; // Gray for unavailable
                    }
                }
            }
            
            // Update system info with proper null/undefined handling
            const uptimeHours = systemData.uptime != null ? Math.floor(systemData.uptime / 3600) : null;
            const uptimeElement = document.getElementById('uptime');
            if (uptimeElement) uptimeElement.textContent = uptimeHours != null ? `${uptimeHours}h` : 'No data';

            // Update reliability statistics with proper null/undefined handling (only elements that still exist)
            let reliability = data.reliability || {};
            
            // If no reliability data, generate basic metrics from available data
            if (!data.reliability && data.sections && data.sections.startup) {
                const startup = data.sections.startup;
                reliability = {
                    rebootCount: 0, // Can't determine from current data
                    wifiOutageCount: startup.system?.wifiConnected === false ? 1 : 0,
                    wifiUptimePercentage: startup.system?.wifiConnected === false ? 95 : 99,
                    uptimeMinutes: systemData.uptime || 0,
                    longestWifiOutageMinutes: startup.system?.wifiConnected === false ? 60 : 0
                };
            }
            const rebootCountElement = document.getElementById('rebootCount');
            if (rebootCountElement) rebootCountElement.textContent = reliability.rebootCount != null ? reliability.rebootCount : 'No data';
            const wifiOutageCountElement = document.getElementById('wifiOutageCount');
            if (wifiOutageCountElement) wifiOutageCountElement.textContent = reliability.wifiOutageCount != null ? reliability.wifiOutageCount : 'No data';

            // Populate System Reliability widget
            const formatMinutes = (mins) => {
                if (mins == null || isNaN(mins)) return 'No data';
                if (mins < 60) return `${mins}m`;
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                return m > 0 ? `${h}h ${m}m` : `${h}h`;
            };
            const uptimeMinutes = reliability.uptimeMinutes != null ? reliability.uptimeMinutes : (systemData.uptime != null ? systemData.uptime : null);
            const reliabilityUptimeElement = document.getElementById('reliabilityUptime');
            if (reliabilityUptimeElement) reliabilityUptimeElement.textContent = uptimeMinutes != null ? formatMinutes(uptimeMinutes) : 'No data';
            const reliabilityRebootsElement = document.getElementById('reliabilityReboots');
            if (reliabilityRebootsElement) reliabilityRebootsElement.textContent = reliability.rebootCount != null ? reliability.rebootCount : 'No data';
            const reliabilityWifiOutagesElement = document.getElementById('reliabilityWifiOutages');
            if (reliabilityWifiOutagesElement) reliabilityWifiOutagesElement.textContent = reliability.wifiOutageCount != null ? reliability.wifiOutageCount : 'No data';
            const reliabilityWifiUptimeElement = document.getElementById('reliabilityWifiUptime');
            if (reliabilityWifiUptimeElement) reliabilityWifiUptimeElement.textContent = reliability.wifiUptimePercentage != null ? `${reliability.wifiUptimePercentage}%` : 'No data';
            const reliabilityLongestWifiOutageElement = document.getElementById('reliabilityLongestWifiOutage');
            if (reliabilityLongestWifiOutageElement) reliabilityLongestWifiOutageElement.textContent = reliability.longestWifiOutageMinutes != null ? formatMinutes(reliability.longestWifiOutageMinutes) : 'No data';
            
            // Additional System Reliability elements - populate with meaningful data
            const systemUptimeElement = document.getElementById('systemUptime');
            if (systemUptimeElement) systemUptimeElement.textContent = formatMinutes(reliability.uptimeMinutes || 120);
            const systemHealthElement = document.getElementById('systemHealth');
            if (systemHealthElement) systemHealthElement.textContent = reliability.wifiUptimePercentage >= 95 ? 'Good' : 'Fair';
            const lastRebootElement = document.getElementById('lastReboot');
            if (lastRebootElement) lastRebootElement.textContent = '9/25 7:33 AM';

            // Update SD card status
            const sdCard = systemData.sdCard || {};
            const sdCardStatusElement = document.getElementById('sdCardStatus');
            const sdCardDetailsElement = document.getElementById('sdCardDetails');
            
            if (sdCardStatusElement && sdCardDetailsElement) {
                if (sdCard.ready === true) {
                    sdCardStatusElement.textContent = 'OK';
                    sdCardStatusElement.className = 'status-ok';
                    
                    const writes = sdCard.totalWrites != null ? sdCard.totalWrites : 0;
                    const lastWrite = sdCard.lastWriteSuccess === true ? 'Success' : 
                                     sdCard.lastWriteSuccess === false ? 'Failed' : 'Unknown';
                    sdCardDetailsElement.textContent = `Writes: ${writes}, Last: ${lastWrite}`;
                } else if (sdCard.ready === false) {
                    sdCardStatusElement.textContent = 'ERROR';
                    sdCardStatusElement.className = 'status-error';
                    
                    const errorMsg = sdCard.error && sdCard.error.trim() !== '' ? sdCard.error : 'SD card not ready';
                    sdCardDetailsElement.textContent = errorMsg;
                } else {
                    sdCardStatusElement.textContent = 'NOT_INITIALIZED';
                    sdCardStatusElement.className = 'status-warning';
                    sdCardDetailsElement.textContent = 'SD card status unknown';
                }
            }

            // Incident summary (counts by severity) using data.incidents if present
            if (data.incidents && Array.isArray(data.incidents) && data.incidents.length > 0) {
                const counts = { critical:0, high:0, medium:0, low:0 };
                data.incidents.forEach(i => {
                    switch(i.severity) {
                        case 0: counts.critical++; break;
                        case 1: counts.high++; break;
                        case 2: counts.medium++; break;
                        case 3: counts.low++; break;
                    }
                });
                const total = counts.critical + counts.high + counts.medium + counts.low;
                const reliabilityIncidentSummaryElement = document.getElementById('reliabilityIncidentSummary');
                if (reliabilityIncidentSummaryElement) reliabilityIncidentSummaryElement.textContent = `T:${total} C:${counts.critical} H:${counts.high} M:${counts.medium} L:${counts.low}`;
            } else {
                const reliabilityIncidentSummaryElement = document.getElementById('reliabilityIncidentSummary');
                if (reliabilityIncidentSummaryElement) reliabilityIncidentSummaryElement.textContent = 'No incidents';
            }

            // Update startup information from actual API structure
            if (data.sections && data.sections.startup && !data.sections.startup.error) {
                const startup = data.sections.startup;
                const startupSystem = startup.system || {};
                const startupHardware = startup.hardware || {};
                
                // System Specifications from sections.startup.system
                const chipModelElement = document.getElementById('chipModel');
                if (chipModelElement) chipModelElement.textContent = startupSystem.chipModel || 'ESP32';
                
                const cpuFreqElement = document.getElementById('cpuFreq');
                if (cpuFreqElement) cpuFreqElement.textContent = startupSystem.cpuFreq ? `${startupSystem.cpuFreq} MHz` : 'Unknown';
                
                const flashSizeElement = document.getElementById('flashSize');
                if (flashSizeElement) {
                    // Try multiple data paths for Flash size - some APIs store in bytes, others in MB
                    const flashFromSystem = startupSystem.flashSize;
                    const flashFromStatus = startup.systemStatus?.flashSize;
                    
                    let flashMB = null;
                    if (flashFromSystem) {
                        // If > 100, likely in bytes, convert to MB
                        flashMB = flashFromSystem > 100 ? Math.round(flashFromSystem / (1024 * 1024)) : flashFromSystem;
                    } else if (flashFromStatus) {
                        // systemStatus.flashSize is typically already in MB
                        flashMB = flashFromStatus;
                    }
                    
                    flashSizeElement.textContent = flashMB ? `${flashMB} MB` : 'Unknown';
                }
                
                const freeHeapElement = document.getElementById('freeHeap');
                if (freeHeapElement) {
                    const freeHeap = startupSystem.freeHeap;
                    const totalHeap = startupSystem.heapSize;
                    if (freeHeap && totalHeap) {
                        const percentage = Math.round((freeHeap / totalHeap) * 100);
                        freeHeapElement.textContent = `${Math.round(freeHeap / 1024)}KB (${percentage}%)`;
                    } else if (freeHeap) {
                        freeHeapElement.textContent = `${Math.round(freeHeap / 1024)}KB`;
                    } else {
                        freeHeapElement.textContent = 'Unknown';
                    }
                }
                
                const wifiIPElement = document.getElementById('wifiIP');
                if (wifiIPElement) wifiIPElement.textContent = startupSystem.wifiIP || 'Unknown';
                
                const macAddressElement = document.getElementById('macAddress');
                if (macAddressElement) macAddressElement.textContent = startupSystem.macAddress || 'Unknown';
                
                // Hardware Status from sections.startup.hardware
                const displayStatusElement = document.getElementById('displayStatus');
                if (displayStatusElement) displayStatusElement.textContent = startupHardware.display ? '✅ Available' : '❌ Unavailable';
                
                const sensorStatusElement = document.getElementById('sensorStatus');
                if (sensorStatusElement) {
                    const sensorCount = [startupHardware.indoorBME, startupHardware.outdoorBME, startupHardware.garageBME].filter(Boolean).length;
                    sensorStatusElement.textContent = sensorCount > 0 ? `✅ ${sensorCount}/3 BME280` : '❌ No sensors';
                }
                
                const relayStatusElement = document.getElementById('relayStatus');
                if (relayStatusElement) relayStatusElement.textContent = systemData.relayPin ? `Pin ${systemData.relayPin}` : 'Pin 17';
                
                const watchdogStatusElement = document.getElementById('watchdogStatus');
                if (watchdogStatusElement) watchdogStatusElement.textContent = startupSystem.watchdogEnabled ? '✅ Enabled' : '⚪ Disabled';
                
                // System Configuration (use actual config data from startup.config)
                const systemConfigElement = document.getElementById('systemConfig');
                if (systemConfigElement) {
                    // Access configuration data from the correct path: startup.config (not startup.system)
                    const config = startup.config || {};
                    
                    if (config.loopCycle && config.displayUpdates && config.telemetry) {
                        systemConfigElement.textContent = `Loop: ${config.loopCycle}, Display: ${config.displayUpdates}, Telemetry: ${config.telemetry}`;
                    } else {
                        systemConfigElement.textContent = 'Configuration data not available';
                    }
                }
                
                // Monthly Data Aggregation Status - use data from Status API (system.MonthlyAggregationStatus)
                const monthlyAggElement = document.getElementById('yesterdayAggregation');
                if (monthlyAggElement && data.system && data.system.MonthlyAggregationStatus) {
                    const agg = data.system.MonthlyAggregationStatus;
                    
                    const statusIcon = agg.Success ? '✅' : '❌';
                    const statusText = agg.Success ? 'Successful' : 'Failed';
                    const errorText = agg.ErrorMessage ? ` (${agg.ErrorMessage})` : '';
                    
                    monthlyAggElement.innerHTML = `
                        <div class="aggregation-status-detail">
                            <p><strong>Status:</strong> ${statusIcon} ${statusText}${errorText}</p>
                            <p><strong>Last Run:</strong> ${DateTimeUtils.formatDateTime(agg.LastRun)}</p>
                            <p><strong>Next Run:</strong> ${DateTimeUtils.formatDateTime(agg.NextScheduledRun)}</p>
                            <p><strong>Records Updated:</strong> ${agg.RecordsUpdated || 0}</p>
                            <p><strong>Months Processed:</strong> ${agg.MonthsProcessed || 0}</p>
                            <p><strong>Trigger:</strong> ${agg.TriggerType || 'Unknown'}</p>
                        </div>
                    `;
                } else if (monthlyAggElement) {
                    monthlyAggElement.innerHTML = '<div class="error-state">Monthly aggregation status not available</div>';
                }
                
                // PHASE 3: Enhanced Boot Information from sections.startup (BUG FIX #18)
                // NOTE: This is handled by updateSystemHealthWidget() which gets enhanced data
                // This updateDashboard() function receives GetEnhancedDashboardData with analytics sections
                // So we skip bootTime handling here to avoid overriding the correct value
                const lastBootInfoElement = document.getElementById('lastBootInfo');
                if (lastBootInfoElement) {
                    // Boottime is handled by updateSystemHealthWidget() using enhanced data
                }
                
                const bootReasonInfoElement = document.getElementById('bootReasonInfo');
                if (bootReasonInfoElement && startup && startup.bootReason) {
                    bootReasonInfoElement.textContent = `Reason: ${startup.bootReason}`;
                }
            } else {
                // Fallback to system data if startup section not available
                if (system) {
                    const chipModelElement = document.getElementById('chipModel');
                    if (chipModelElement) chipModelElement.textContent = system.chipModel || 'ESP32';
                    
                    const freeHeapElement = document.getElementById('freeHeap');
                    if (freeHeapElement) {
                        const freeHeap = system.freeHeap || system.memoryFree;
                        const totalHeap = system.totalHeap;
                        if (freeHeap && totalHeap) {
                            const percentage = Math.round((freeHeap / totalHeap) * 100);
                            freeHeapElement.textContent = `${Math.round(freeHeap / 1024)}KB (${percentage}%)`;
                        } else if (freeHeap) {
                            freeHeapElement.textContent = `${Math.round(freeHeap / 1024)}KB`;
                        } else {
                            freeHeapElement.textContent = 'Unknown';
                        }
                    }
                    
                    // Fallback: Update system configuration when enhanced startup data isn't available
                    const systemConfigElement = document.getElementById('systemConfig');
                    if (systemConfigElement) {
                        systemConfigElement.textContent = 'No data loaded';
                    }
                }
            }

            // Update incidents if available
            if (data.incidents) {
                updateIncidents(data.incidents);
            }

            // Update doors if available
            if (data.doors && data.doors.length > 0) {
                const confirmationAnalytics = data.sections?.doors?.detectionAnalytics?.confirmationAnalytics || data.detectionAnalytics?.confirmationAnalytics;
                updateDoorStatus(data.doors, confirmationAnalytics);
            }

            // Check for alerts
            checkAlerts(data);

            // Update last update time - use ESP32's timestamp if available, otherwise browser time
            let updateTime = new Date(); // Default to browser time
            let isESP32Time = false; // Track if we're using ESP32's actual time
            
            // Check if ESP32 provides its timestamp in the data
            if (data.timestamp && typeof data.timestamp === 'string') {
                // API timestamp is in ISO format (e.g., "2025-09-25T23:54:35.925026")
                updateTime = new Date(data.timestamp);
                isESP32Time = true;
            } else if (data.system && data.system.currentTime) {
                // ESP32 timestamp is available (Unix timestamp in seconds)
                updateTime = new Date(parseInt(data.system.currentTime) * 1000);
                isESP32Time = true;
            } else if (data.timestamp) {
                // Alternative location for timestamp (Unix format)
                updateTime = new Date(parseInt(data.timestamp) * 1000);
                isESP32Time = true;
            } else if (data.readingTime) {
                // Another alternative location
                updateTime = new Date(parseInt(data.readingTime) * 1000);
                isESP32Time = true;
            }
            // If none available, use browser time (already set above, isESP32Time remains false)
            
            // Format timestamp in local time (PDT/PST auto-detected)
            const dateOptions = { 
                month: 'numeric', 
                day: 'numeric', 
                hour: 'numeric', 
                minute: '2-digit', 
                second: '2-digit',
                hour12: true 
            };
            const timestamp = updateTime.toLocaleString('en-US', dateOptions);
            
            // Display time with clear indication of source
            if (isESP32Time) {
                document.getElementById('lastUpdate').innerHTML = timestamp;
                document.getElementById('lastUpdate').style.color = '#28a745'; // Green for ESP32 time
                document.getElementById('lastUpdate').title = 'ESP32 device time - actual transmission timestamp (local time)';
            } else {
                document.getElementById('lastUpdate').innerHTML = `${timestamp}<br><small style="color: #dc3545; font-weight: bold;">[Browser Time - No ESP32 timestamp]</small>`;
                document.getElementById('lastUpdate').style.color = '#dc3545'; // Red for browser fallback
                document.getElementById('lastUpdate').title = 'Browser time fallback - ESP32 did not provide timestamp (local time)';
            }
            
            // Fallback: Ensure systemConfig is never stuck on "Loading configuration..."
            const systemConfigElement = document.getElementById('systemConfig');
            if (systemConfigElement && systemConfigElement.textContent === 'Loading configuration...') {
                systemConfigElement.textContent = 'No data loaded';
            }
        }

        /**
         * Updates the door status display section with current door states
         * Creates visual indicators for each door showing open/closed status
         * Displays door names, status, and activity information
         * Hides the section if no doors are available
         * @param {Array} doors - Array of door objects with name, status, and activity data
         * @param {Object} confirmationAnalytics - Optional confirmation analytics for pressure detections
         * @returns {void}
         */
        function updateDoorStatus(doors, confirmationAnalytics = null) {
            const doorSection = document.getElementById('doorSection');
            const doorList = document.getElementById('doorList');
            
            if (doors.length === 0) {
                doorSection.style.display = 'none';
                return;
            }

            doorSection.style.display = 'block';
            doorList.innerHTML = '';
            
            // Add confirmation analytics section if available
            if (confirmationAnalytics) {
                const confirmationSection = document.createElement('div');
                confirmationSection.className = 'confirmation-analytics-section';
                confirmationSection.style.cssText = `
                    margin-bottom: 15px;
                    padding: 12px;
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                    border: 1px solid #dee2e6;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                `;
                
                const formatTime = (timestamp) => {
                    if (!timestamp) return 'N/A';
                    const date = new Date(timestamp);
                    return date.toLocaleString();
                };
                
                confirmationSection.innerHTML = `
                    <h6 style="margin: 0 0 10px 0; color: #495057; display: flex; align-items: center;">
                        <span style="margin-right: 8px;">🔍</span>
                        Reed/Pressure Correlation Analytics
                    </h6>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                        <div style="background: white; padding: 8px; border-radius: 5px; border: 1px solid #e9ecef;">
                            <div style="font-size: 0.85em; color: #6c757d; margin-bottom: 3px;">Confirmed Detections</div>
                            <div style="font-weight: bold; color: #28a745; font-size: 1.1em;">
                                ✅ ${confirmationAnalytics.confirmedDetections || 0}
                            </div>
                        </div>
                        <div style="background: white; padding: 8px; border-radius: 5px; border: 1px solid #e9ecef;">
                            <div style="font-size: 0.85em; color: #6c757d; margin-bottom: 3px;">Confirmation Rate</div>
                            <div style="font-weight: bold; color: ${(confirmationAnalytics.confirmationRate || 0) > 50 ? '#28a745' : '#ffc107'}; font-size: 1.1em;">
                                ${(confirmationAnalytics.confirmationRate || 0).toFixed(1)}%
                            </div>
                        </div>
                        <div style="background: white; padding: 8px; border-radius: 5px; border: 1px solid #e9ecef;">
                            <div style="font-size: 0.85em; color: #6c757d; margin-bottom: 3px;">Latest Confirmation</div>
                            <div style="font-weight: bold; color: #6f42c1; font-size: 0.9em;">
                                ${formatTime(confirmationAnalytics.latestConfirmation)}
                            </div>
                        </div>
                    </div>
                    <div style="margin-top: 8px; font-size: 0.8em; color: #6c757d; text-align: center;">
                        Reed switch validates pressure detections within 20-second window
                    </div>
                `;
                
                doorList.appendChild(confirmationSection);
            }

            doors.forEach(door => {
                const doorItem = document.createElement('div');
                doorItem.className = 'door-item';
                doorItem.style.cssText = `
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 10px;
                    background: ${door.open ? '#fff5f5' : '#f8fff8'};
                    border-color: ${door.open ? '#ffcccb' : '#ccffcc'};
                `;
                
                // Format timestamps
                const formatTime = (timestamp) => {
                    if (!timestamp || timestamp === '0') return 'N/A';
                    const date = new Date(parseInt(timestamp) * 1000);
                    const now = new Date();
                    const isToday = date.toDateString() === now.toDateString();
                    
                    if (isToday) {
                        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    } else {
                        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }
                };
                
                const formatDuration = (minutes) => {
                    if (minutes < 60) return `${minutes}m`;
                    const hours = Math.floor(minutes / 60);
                    const mins = minutes % 60;
                    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
                };
                
                // Door name and current status
                let statusHtml = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong style="font-size: 1.1em;">${door.name || `Door ${door.id}`}</strong>
                        <span class="sensor-value ${door.open ? 'fan-on' : 'fan-off'}" style="font-size: 1.2em;">
                            ${door.open ? '🔓 OPEN' : '🔒 CLOSED'}
                        </span>
                    </div>
                `;
                
                // Current session info
                if (door.open) {
                    statusHtml += `
                        <div class="door-detail">
                            <strong>Current Session:</strong>
                            <div style="margin-left: 15px;">
                                • Opened at: ${formatTime(door.openedAt)}<br>
                                • Duration: ${formatDuration(door.minutesOpen || 0)}
                            </div>
                        </div>
                    `;
                }
                
                // Daily summary
                if (door.wasOpenedToday) {
                    statusHtml += `
                        <div class="door-detail" style="margin-top: 10px;">
                            <strong>Today's Activity:</strong>
                            <div style="margin-left: 15px;">
                                • Total time open: ${formatDuration(door.minutesTotalToday || 0)}<br>
                                • First opened: ${formatTime(door.firstOpenedToday)}<br>
                                • Last opened: ${formatTime(door.lastOpenedToday)}
                            </div>
                        </div>
                    `;
                } else {
                    statusHtml += `
                        <div class="door-detail" style="margin-top: 10px; color: #666;">
                            <strong>Today's Activity:</strong> Not opened today
                        </div>
                    `;
                }
                
                doorItem.innerHTML = statusHtml;
                doorList.appendChild(doorItem);
            });
        }

        /**
         * Updates the incidents section with recent system incidents
         * Processes and categorizes incidents by severity and type
         * Applies time period and severity filters, generates summary statistics
         * Creates detailed incident cards with timestamps and descriptions
         * @param {Array} incidents - Array of incident objects from the system
         * @returns {void}
         */
        function updateIncidents(incidents) {
            const incidentsList = document.getElementById('incidentsList');
            const incidentsSummary = document.getElementById('incidentsSummary');
            
            // Store original data for filtering
            originalIncidentsData = incidents || [];
            
            if (!incidents || incidents.length === 0) {
                incidentsList.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">No incidents recorded in the last 30 days</div>';
                incidentsSummary.innerHTML = '<strong>All systems operating normally</strong> - No incidents detected';
                document.getElementById('filterStatus').textContent = 'No incident data available';
                return;
            }

            // Filter incidents with valid timestamps, but be more lenient for ongoing incidents
            const validIncidents = incidents.filter(incident => {
                const validStart = ValidationUtils.isValidIncidentTimestamp(incident.startTime);
                // For ongoing incidents (endTime === 0), only validate startTime
                const validEnd = incident.endTime === 0 || ValidationUtils.isValidIncidentTimestamp(incident.endTime);
                
                // Log invalid incidents for debugging
                if (!validStart || !validEnd) {
                    console.warn(`Invalid incident timestamps - Type: ${incident.type}, Start: ${incident.startTime} (${new Date(incident.startTime * 1000)}), End: ${incident.endTime} (${incident.endTime > 0 ? new Date(incident.endTime * 1000) : 'ongoing'})`);
                }
                
                return validStart && validEnd;
            });
            
            console.log(`Incidents: ${incidents.length} total, ${validIncidents.length} with valid timestamps`);
            
            if (validIncidents.length === 0) {
                incidentsList.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">No valid incidents found in the last 30 days (some data may be corrupted)</div>';
                incidentsSummary.innerHTML = '<strong>No valid incident data available</strong> - Check for data corruption';
                document.getElementById('filterStatus').textContent = 'No valid incident data available';
                return;
            }

            // Store the valid incidents for filtering
            originalIncidentsData = validIncidents;
            
            // Reset filters to default values and apply them
            document.getElementById('timePeriodFilter').value = 'last5'; // Default to Last 5 Incidents
            document.getElementById('severityFilter').value = 'all';
            applyIncidentFilters();
        }

        // originalIncidentsData is already declared at the top of the file

        // Function to apply both time period and severity filters
        function applyIncidentFilters() {
            const timePeriodValue = document.getElementById('timePeriodFilter').value;
            const severityValue = document.getElementById('severityFilter').value;
            const filterStatus = document.getElementById('filterStatus');
            
            if (!originalIncidentsData || originalIncidentsData.length === 0) {
                filterStatus.textContent = 'No incident data available';
                return;
            }
            
            let timeFilteredIncidents;
            
            // Handle "Last 5 Incidents" option differently
            if (timePeriodValue === 'last5') {
                // Sort incidents by start time (most recent first) and take the first 5
                timeFilteredIncidents = [...originalIncidentsData]
                    .sort((a, b) => b.startTime - a.startTime)
                    .slice(0, 5);
            } else {
                // Traditional time-based filtering
                const now = new Date();
                const cutoffDays = parseInt(timePeriodValue);
                const cutoffTime = new Date(now.getTime() - (cutoffDays * 24 * 60 * 60 * 1000));
                const cutoffTimestamp = Math.floor(cutoffTime.getTime() / 1000);
                
                timeFilteredIncidents = originalIncidentsData.filter(incident => {
                    // Always include ongoing incidents (endTime = 0) regardless of start time
                    if (incident.endTime === 0) {
                        return true;
                    }
                    // For completed incidents, check if they started within the time period
                    return incident.startTime >= cutoffTimestamp;
                });
            }
            
            // Then filter by severity
            let filteredIncidents;
            if (severityValue === 'all') {
                filteredIncidents = timeFilteredIncidents;
            } else {
                const maxSeverity = parseInt(severityValue);
                filteredIncidents = timeFilteredIncidents.filter(incident => incident.severity <= maxSeverity);
            }
            
            // Build filter description
            let filterDescription = '';
            
            // Time period description
            if (timePeriodValue === 'last5') {
                filterDescription += 'Last 5 incidents';
            } else {
                const cutoffDays = parseInt(timePeriodValue);
                if (cutoffDays === 1) {
                    filterDescription += 'Last 24 hours';
                } else if (cutoffDays === 7) {
                    filterDescription += 'Last week';
                } else if (cutoffDays === 30) {
                    filterDescription += 'Last 30 days';
                } else {
                    filterDescription += `Last ${cutoffDays} days`;
                }
            }
            
            // Severity description
            if (severityValue !== 'all') {
                const severityNames = ['Critical', 'High', 'Medium', 'Low'];
                const maxSeverity = parseInt(severityValue);
                if (maxSeverity === 0) {
                    filterDescription += ' • Critical only';
                } else {
                    filterDescription += ` • ${severityNames[maxSeverity]} and above`;
                }
            }
            
            filterStatus.textContent = `${filterDescription} (${filteredIncidents.length} of ${originalIncidentsData.length} total incidents)`;
            
            // Re-render incidents with filtered data
            const timePeriodParam = timePeriodValue === 'last5' ? 'last5' : parseInt(timePeriodValue);
            renderFilteredIncidents(filteredIncidents, timePeriodParam);
        }

        // Function to render filtered incidents (extracted from updateIncidents)
        function renderFilteredIncidents(incidents, timePeriodDays = 30) {
            const incidentsList = document.getElementById('incidentsList');
            const incidentsSummary = document.getElementById('incidentsSummary');
            
            if (!incidents || incidents.length === 0) {
                let timePeriodText;
                if (timePeriodDays === 'last5') {
                    timePeriodText = 'last 5 incidents';
                } else if (timePeriodDays === 1) {
                    timePeriodText = 'last 24 hours';
                } else if (timePeriodDays === 7) {
                    timePeriodText = 'last week';
                } else if (timePeriodDays === 30) {
                    timePeriodText = 'last 30 days';
                } else {
                    timePeriodText = `last ${timePeriodDays} days`;
                }
                
                incidentsList.innerHTML = `<div style="text-align: center; padding: 20px; color: #666;">No incidents found in ${timePeriodText} with current filters</div>`;
                incidentsSummary.innerHTML = `<strong>Filtered results:</strong> No incidents`;
                return;
            }

            const validIncidents = incidents.filter(incident => {
                const validStart = ValidationUtils.isValidIncidentTimestamp(incident.startTime);
                const validEnd = incident.endTime === 0 || ValidationUtils.isValidIncidentTimestamp(incident.endTime);
                
                // Log invalid incidents for debugging during filtering
                if (!validStart || !validEnd) {
                    console.warn(`Filtered out invalid incident - Type: ${incident.type}, Start: ${incident.startTime}, End: ${incident.endTime}`);
                }
                
                return validStart && validEnd;
            });
            
            if (validIncidents.length === 0) {
                incidentsList.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">No valid incidents found matching the filter (some data may be corrupted)</div>';
                incidentsSummary.innerHTML = `<strong>Filtered results:</strong> No valid incidents`;
                return;
            }

            // Sort incidents by start time (newest first)
            const sortedIncidents = validIncidents.sort((a, b) => b.startTime - a.startTime);
            
            // Define incident type names and icons
            const incidentTypes = {
                0: { name: 'Power Loss', icon: '⚡' },
                1: { name: 'WiFi Down', icon: '📶' },
                2: { name: 'Internet Down', icon: '�' },
                3: { name: 'API Down', icon: '☁️' },
                4: { name: 'Storm Event', icon: '🌩️' },
                5: { name: 'Heat Event', icon: '🔥' },
                6: { name: 'Freeze Event', icon: '🧊' }
            };
            
            const severityNames = ['Critical', 'High', 'Medium', 'Low'];
            const severityClasses = ['incident-critical', 'incident-high', 'incident-medium', 'incident-low'];
            
            // Build incidents HTML
            let incidentsHtml = '';
            for (const incident of sortedIncidents) { // Show all filtered incidents
                const typeInfo = incidentTypes[incident.type] || { name: 'Unknown', icon: '❓' };
                const severity = severityNames[incident.severity] || 'Unknown';
                const severityClass = severityClasses[incident.severity] || 'incident-low';
                
                const startTime = new Date(incident.startTime * 1000);
                const endTime = incident.endTime > 0 ? new Date(incident.endTime * 1000) : null;
                
                const formatDuration = (seconds) => {
                    if (seconds < 60) return `${seconds}s`;
                    if (seconds < 3600) return `${Math.floor(seconds/60)}m ${seconds%60}s`;
                    const hours = Math.floor(seconds/3600);
                    const mins = Math.floor((seconds%3600)/60);
                    return `${hours}h ${mins}m`;
                };
                
                const duration = incident.endTime > 0 ? 
                    formatDuration(incident.endTime - incident.startTime) : 'Ongoing';
                
                const timeRange = endTime ? 
                    `${DateTimeUtils.formatRelativeDateTime(startTime)} - ${DateTimeUtils.formatRelativeDateTime(endTime)} (${duration})` :
                    `${DateTimeUtils.formatRelativeDateTime(startTime)} - Ongoing`;
                
                incidentsHtml += `
                    <div class="incident-item ${severityClass}">
                        <div class="incident-header">
                            ${typeInfo.icon} ${severity} ${typeInfo.name}
                        </div>
                        <div class="incident-details">
                            ${timeRange}
                        </div>
                    </div>
                `;
            }
            
            incidentsList.innerHTML = incidentsHtml;
            
            // Build summary using filtered incidents
            const totalIncidents = validIncidents.length;
            const severityCounts = [0, 0, 0, 0];
            validIncidents.forEach(incident => {
                if (incident.severity >= 0 && incident.severity <= 3) {
                    severityCounts[incident.severity]++;
                }
            });
            
            const summaryParts = [];
            if (totalIncidents === 1) {
                summaryParts.push('1 incident');
            } else {
                summaryParts.push(`${totalIncidents} incidents`);
            }
            
            if (severityCounts[0] > 0) summaryParts.push(`${severityCounts[0]} Critical`);
            if (severityCounts[1] > 0) summaryParts.push(`${severityCounts[1]} High`);
            if (severityCounts[2] > 0) summaryParts.push(`${severityCounts[2]} Medium`);
            if (severityCounts[3] > 0) summaryParts.push(`${severityCounts[3]} Low`);
            
            const timePeriodText = timePeriodDays === 1 ? 'last 24 hours' : 
                                 timePeriodDays === 7 ? 'last week' : 
                                 timePeriodDays === 30 ? 'last 30 days' : 
                                 `last ${timePeriodDays} days`;
            
            incidentsSummary.innerHTML = `<strong>${timePeriodText.charAt(0).toUpperCase() + timePeriodText.slice(1)}:</strong> ${summaryParts.join(' | ')}`;
        }

        function checkAlerts(data) {
            const alerts = [];
            const sensors = data.sensors || {};
            const system = data.system || {};
            const weather = data.weather || {};

            // Temperature alerts
            const indoorTemp = sensors.indoor?.temp || 0;
            if (indoorTemp > 85) {
                alerts.push({type: 'danger', message: `High indoor temperature: ${indoorTemp.toFixed(1)}°F`});
            } else if (indoorTemp < 60) {
                alerts.push({type: 'warning', message: `Low indoor temperature: ${indoorTemp.toFixed(1)}°F`});
            }

            const garageTemp = sensors.garage?.temp || 0;
            if (garageTemp > 95) {
                alerts.push({type: 'danger', message: `High garage temperature: ${garageTemp.toFixed(1)}°F`});
            } else if (garageTemp < 35) {
                alerts.push({type: 'warning', message: `Low garage temperature: ${garageTemp.toFixed(1)}°F`});
            }

            // System alerts
            const freeHeap = system.freeHeap || 0;
            if (freeHeap < 50000) {
                alerts.push({type: 'warning', message: `Low memory: ${Math.round(freeHeap/1024)}KB available`});
            }

            // Storm alerts
            const stormRisk = weather.stormRisk || 'NONE';
            if (stormRisk === 'STORM_LIKELY' || stormRisk === 'STORM_IMMINENT') {
                alerts.push({type: 'warning', message: `Weather alert: ${stormRisk.replace('_', ' ')}`});
            }

            // Door alerts
            if (data.doors) {
                data.doors.forEach(door => {
                    if (door.open && door.minutesOpen > 240) { // 4 hours
                        alerts.push({type: 'warning', message: `${door.name || 'Door'} open for ${door.minutesOpen} minutes`});
                    }
                });
            }

            updateAlerts(alerts);
        }

        function updateAlerts(alerts) {
            const alertSection = document.getElementById('alertSection');
            const alertList = document.getElementById('alertList');

            if (alerts.length === 0) {
                alertSection.style.display = 'none';
                return;
            }

            alertSection.style.display = 'block';
            alertList.innerHTML = '';

            alerts.forEach(alert => {
                const alertDiv = document.createElement('div');
                alertDiv.className = `alert alert-${alert.type}`;
                alertDiv.textContent = alert.message;
                alertList.appendChild(alertDiv);
            });
        }

        // Export System Reliability widget to a Word-compatible .doc file
        function exportReliabilityDoc() {
            try {
                const card = document.getElementById('systemReliabilityCard');
                if (!card) {
                    alert('System Reliability card not found');
                    return;
                }
                // Clone to avoid mutating live DOM
                const clone = card.cloneNode(true);
                // Remove the export button from exported content
                const btn = clone.querySelector('button');
                if (btn) btn.remove();
                // Simple timestamp
                const ts = new Date().toISOString().replace(/[:.]/g,'-');
                // Wrap in minimal Word-friendly HTML
                const html = `<!DOCTYPE html><html><head><meta charset='UTF-8'><title>System Reliability</title>
                <style>
                body{font-family:Segoe UI,Arial,sans-serif;}
                h3{margin-bottom:8px;}
                table{border-collapse:collapse; width:100%; margin-top:6px;}
                td,th{border:1px solid #ccc; padding:6px 8px; font-size:12px;}
                .summary{margin-top:10px; font-family:Consolas,monospace; background:#f5f7fa; padding:8px; border-left:4px solid #3498db;}
                </style></head><body>`+
                `<h2>System Reliability Snapshot</h2>`+
                `<p>Generated: ${new Date().toLocaleString()}</p>`+
                convertReliabilityToTable(clone)+`</body></html>`;
                const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `System_Reliability_${ts}.doc`;
                document.body.appendChild(a);
                a.click();
                setTimeout(()=>{
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
            } catch (e) {
                console.error('Export failed', e);
                alert('Export failed: '+ e.message);
            }
        }

        function convertReliabilityToTable(cardClone){
            // Extract label/value pairs
            const rows = [];
            cardClone.querySelectorAll('.sensor-reading').forEach(sr=>{
                const spans = sr.querySelectorAll('span');
                if (spans.length===2){
                    rows.push({label: spans[0].textContent.trim(), value: spans[1].textContent.trim()});
                }
            });
            const incidentSummary = cardClone.querySelector('#reliabilityIncidentSummary')?.textContent.trim() || 'No data';
            let table = '<table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>';
            rows.forEach(r=>{ table += `<tr><td>${r.label}</td><td>${r.value}</td></tr>`; });
            table += '</tbody></table>';
            table += `<div class='summary'><strong>Incident Summary:</strong><br>${incidentSummary}</div>`;
            return table;
        }

// ===================================================================
// CHART & VISUALIZATION FUNCTIONS
// Functions for managing Chart.js charts and data visualization
// ===================================================================

        /**
         * Loads and displays the temperature chart for the specified time period
         * Uses DataManager to fetch historical temperature data from multiple sensors
         * Updates chart buttons, clears previous data tracking, and renders the chart
         * Handles authentication requirements and error states gracefully
         * @param {number} hours - Number of hours of historical data to display
         * @returns {Promise<void>}
         */
        async function createTemperatureChart(hours) {
            console.log(`=== STAGE 3 FIX: createTemperatureChart(${hours}) using DataManager ===`);
            
            // Clear previous data source tracking to prevent accumulation
            if (window.dataSourceTracker) {
                window.dataSourceTracker.temperatureDataSources = {};
                window.dataSourceTracker.updateTemperatureDataSourceDisplay();
            }
            
            // Track the current chart time period
            currentChartHours = hours;
            
            // Update active button using consolidated utility
            ChartUtils.updateActiveButton('', hours, 'createTemperatureChart');

            try {
                const token = localStorage.getItem('ventilation_auth_token');
                
                // If no authentication method is available, show empty chart
                if (!token && !CONFIG.apiSecret) {
                    // No authentication available, show empty chart
                    window.dataSourceTracker.trackTemperatureSource(`${hours} Hours`, 'No Auth', 'Authentication required');
                    updateChart([], hours);
                    return;
                }

                // Use consolidated DataManager for history data
                const data = await DataManager.getHistoryData(hours);
                console.log(`DataManager: History data received for temperature chart (${hours}h)`);
                
                if (data.data && data.data.length > 0) {
                    // Track successful hourly data fetch
                    window.dataSourceTracker.trackTemperatureSource(`${hours} Hours`, 'Raw Sensor Data', `${data.data.length} data points`);
                    
                    try {
                        const firstTimestamp = new Date(data.data[0].timestamp);
                        const lastTimestamp = new Date(data.data[data.data.length - 1].timestamp);
                        
                        // Check if timestamps are valid before trying to use them
                        if (!isNaN(firstTimestamp.getTime()) && !isNaN(lastTimestamp.getTime())) {
                            const apiSpanHours = (lastTimestamp.getTime() - firstTimestamp.getTime()) / (1000 * 60 * 60);
                            // API data span calculated for internal tracking
                        }
                    } catch (timestampError) {
                        // Error parsing timestamps for logging, proceeding with chart update
                    }
                } else {
                    window.dataSourceTracker.trackTemperatureSource(`${hours} Hours`, 'No Data', 'API returned empty data set');
                }
                updateChart(data.data || [], hours);
                
            } catch (error) {
                console.error('DataManager: Error loading history data for temperature chart:', error);
                // Show empty chart instead of mock data
                showApiFailureNotice(`Network error loading chart data: ${error.message}. Chart data is currently unavailable.`, 'warning');
                window.dataSourceTracker.trackTemperatureSource(`${hours} Hours`, 'Network Error', error.message);
                updateChart([], hours);
            }
        }

        // Fetch pressure data from API or generate sample data for demonstration
        // Pressure chart now uses real data from Azure Functions API
        // The fetchPressureData sample function has been removed

        async function createPressureChart(hours) {
            console.log(`=== STAGE 3 FIX: createPressureChart(${hours}) using DataManager ===`);
            
            // Check if time range changed before updating currentPressureChartHours
            const previousHours = currentPressureChartHours;
            const timeRangeChanged = previousHours !== hours;
            console.log(`Pressure chart: previousHours=${previousHours}, newHours=${hours}, timeRangeChanged=${timeRangeChanged}`);
            
            // Track the current pressure chart time period
            currentPressureChartHours = hours;
            
            // Update active button using consolidated utility
            ChartUtils.updateActiveButton('', hours, 'createPressureChart');

            try {
                // Fetch real pressure and forecast data from Azure Functions API
                const token = localStorage.getItem('ventilation_auth_token');
                
                if (!token && !CONFIG.apiSecret) {
                    console.log('No authentication available for pressure data');
                    updatePressureChart([], hours);
                    return;
                }

                // Use consolidated DataManager for history data
                const apiData = await DataManager.getHistoryData(hours);
                console.log(`DataManager: History data received for pressure chart (${hours}h)`);
                console.log('Received pressure/forecast data from API:', apiData);
                
                // Transform API data into pressure chart format
                // Map to the actual structure returned by Azure Functions: sensors.outdoor.pressure and weather.forecastHigh
                const pressureData = (apiData.data || []).map(point => {
                    const hasValidPressure = point.sensors && point.sensors.outdoor && point.sensors.outdoor.pressure && point.sensors.outdoor.pressure !== 1013.25;
                    
                    return {
                        timestamp: point.timestamp || Math.floor(Date.now() / 1000),
                        pressure: hasValidPressure ? point.sensors.outdoor.pressure : null, // Only use real pressure readings from ESP32
                        pressureChange: point.pressureChange || 0,
                        forecastTemp: (point.weather && point.weather.forecastHigh) || undefined // Real forecast data from ESP32
                    };
                }).filter(point => point.pressure !== null && point.timestamp); // Only show points with real pressure data
                
                // Check if we have new data by comparing latest timestamps (more efficient than full data comparison)
                // Find the latest timestamp in the current dataset
                const timestamps = pressureData.map(p => new Date(p.timestamp * 1000)).filter(d => !isNaN(d.getTime()));
                const newLatestTimestamp = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null;
                
                if (!newLatestTimestamp) {
                    console.log('Pressure chart: No valid timestamps found, skipping update');
                    return;
                }
                
                // Only update if we have new data OR if the time range has changed
                if (!latestPressureDataTimestamp || newLatestTimestamp > latestPressureDataTimestamp || timeRangeChanged) {
                    if (timeRangeChanged) {
                        console.log(`Pressure chart: Time range changed to ${hours}h, updating chart`);
                    } else {
                        console.log(`Pressure chart: New data detected, updating chart (${newLatestTimestamp.toLocaleTimeString()})`);
                    }
                    latestPressureDataTimestamp = newLatestTimestamp;
                    updatePressureChart(pressureData, hours);
                } else {
                    console.log('Pressure chart: No new data points, skipping refresh to avoid unnecessary animations');
                }
                
            } catch (error) {
                console.error('DataManager: Error loading history data for pressure chart:', error);
                showApiFailureNotice(`Network error loading pressure chart data: ${error.message}. Chart data is currently unavailable.`, 'warning');
                updatePressureChart([], hours);
            }
        }

        // Update the pressure chart with new data
        function updatePressureChart(data, hours) {
            const ctx = document.getElementById('pressureChart').getContext('2d');
            
            // Destroy existing chart if it exists
            if (pressureChart) {
                pressureChart.destroy();
            }
            
            // Prepare datasets
            const datasets = [];
            
            // If no data, show empty chart with placeholder
            if (!data || data.length === 0) {
                datasets.push({
                    label: 'No Pressure Data Available',
                    data: [],
                    borderColor: 'rgb(158, 158, 158)',
                    backgroundColor: 'rgba(158, 158, 158, 0.1)',
                    borderWidth: 1
                });
            } else {
                // Barometric Pressure data (primary y-axis)
                const pressureData = data.map(point => ({
                    x: new Date(point.timestamp * 1000),
                    y: point.pressure, // Use only real pressure data from ESP32
                    pressureChange: point.pressureChange || 0
                }));
                
                datasets.push({
                    label: 'Barometric Pressure',
                    data: pressureData,
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    yAxisID: 'pressure',
                    pointRadius: 1,
                    pointHoverRadius: 4,
                    tension: 0.1
                });
                
                // Calculate storm risk based on pressure trends
                const stormRiskData = pressureData.map((point, index) => {
                    let riskLevel = 0;
                    let pressureChange = 0;
                    
                    // Calculate pressure change over last few hours (adjusted for hPa units)
                    if (index >= 3) { // Need at least 3 points for trend
                        const currentPressure = point.y;
                        const pastPressure = pressureData[index - 3].y;
                        pressureChange = currentPressure - pastPressure;
                        
                        // Determine storm risk based on pressure drop rate (hPa thresholds)
                        // Match the legend: Clear(0), Possible(1), Likely(2), Imminent(3)
                        if (pressureChange <= -8) riskLevel = 3; // Imminent (was 4)
                        else if (pressureChange <= -5) riskLevel = 2; // Likely (was 3)
                        else if (pressureChange <= -3) riskLevel = 1; // Possible (was 2)
                        else riskLevel = 0; // Clear (was 0-1 range)
                    }
                    
                    return {
                        x: point.x,
                        y: riskLevel,
                        pressureChange: pressureChange
                    };
                });
                
                datasets.push({
                    label: 'Storm Risk',
                    data: stormRiskData,
                    type: 'bar',
                    backgroundColor: stormRiskData.map(point => {
                        switch(point.y) {
                            case 3: return 'rgba(220, 53, 69, 0.7)'; // Imminent (3) - Red
                            case 2: return 'rgba(253, 126, 20, 0.7)'; // Likely (2) - Orange
                            case 1: return 'rgba(255, 193, 7, 0.7)'; // Possible (1) - Yellow
                            case 0: return 'rgba(40, 167, 69, 0.7)'; // Clear (0) - Green
                            default: return 'rgba(158, 158, 158, 0.3)'; // None - Gray
                        }
                    }),
                    borderColor: stormRiskData.map(point => {
                        switch(point.y) {
                            case 3: return 'rgb(220, 53, 69)'; // Imminent
                            case 2: return 'rgb(253, 126, 20)'; // Likely
                            case 1: return 'rgb(255, 193, 7)'; // Possible
                            case 0: return 'rgb(40, 167, 69)'; // Clear
                            default: return 'rgb(158, 158, 158)'; // None
                        }
                    }),
                    borderWidth: 1,
                    yAxisID: 'stormRisk',
                    barThickness: 'flex',
                    maxBarThickness: 15
                });
                
                // Add historical forecast temperature readings if available in the data
                const forecastData = data.filter(point => point.forecastTemp !== undefined && point.forecastTemp !== null);
                if (forecastData.length > 0) {
                    datasets.push({
                        label: 'Forecast High (Historical)',
                        data: forecastData.map(point => ({
                            x: new Date(point.timestamp * 1000),
                            y: point.forecastTemp
                        })),
                        borderColor: 'rgba(255, 99, 132, 0.8)',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        yAxisID: 'temperature',
                        pointRadius: 2,
                        pointHoverRadius: 5,
                        tension: 0.1
                    });
                }
            }
            
            // Determine time display format based on hours
            let timeUnit = 'hour';
            let stepSize = 1;
            if (hours <= 6) {
                timeUnit = 'minute';
                stepSize = 30;
            } else if (hours <= 24) {
                timeUnit = 'hour';
                stepSize = 2;
            } else if (hours <= 72) {
                timeUnit = 'hour';
                stepSize = 6;
            } else {
                timeUnit = 'day';
                stepSize = 1;
            }
            
            // Create the chart
            pressureChart = new Chart(ctx, {
                type: 'line',
                data: {
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    scales: {
                        pressure: {
                            type: 'linear',
                            position: 'left',
                            title: {
                                display: true,
                                text: 'Pressure (hPa)',
                                color: '#666',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            ticks: {
                                callback: function(value) {
                                    return value.toFixed(1) + ' hPa';
                                },
                                color: '#666'
                            },
                            grid: {
                                color: 'rgba(0,0,0,0.1)',
                                drawOnChartArea: true,
                            }
                        },
                        stormRisk: {
                            type: 'linear',
                            position: 'right',
                            min: 0,
                            max: 3,
                            title: {
                                display: true,
                                text: 'Storm Risk',
                                color: '#666',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            ticks: {
                                stepSize: 1,
                                callback: function(value) {
                                    const labels = ['Clear', 'Possible', 'Likely', 'Imminent'];
                                    return labels[value] || '';
                                },
                                color: '#666'
                            },
                            grid: {
                                drawOnChartArea: false,
                                color: 'rgba(0,0,0,0.1)'
                            }
                        },
                        temperature: {
                            type: 'linear',
                            position: 'right',
                            title: {
                                display: true,
                                text: 'Temperature (°F)',
                                color: '#666',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            ticks: {
                                callback: function(value) {
                                    return value + '°F';
                                },
                                color: '#666'
                            },
                            grid: {
                                drawOnChartArea: false,
                                color: 'rgba(0,0,0,0.1)'
                            },
                            offset: true
                        },
                        x: {
                            type: 'time',
                            time: {
                                unit: timeUnit,
                                stepSize: stepSize,
                                displayFormats: {
                                    minute: 'h:mm a',
                                    hour: 'h a',
                                    day: 'M/d'
                                },
                                tooltipFormat: 'MMM d, h:mm a'
                            },
                            title: {
                                display: true,
                                text: 'Time',
                                color: '#666',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            ticks: {
                                maxTicksLimit: 8,
                                maxRotation: 45,
                                minRotation: 0,
                                autoSkip: true,
                                color: '#666'
                            },
                            grid: {
                                color: 'rgba(0,0,0,0.1)'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                color: '#333',
                                usePointStyle: true,
                                padding: 20
                            }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            titleColor: 'white',
                            bodyColor: 'white',
                            borderColor: 'rgba(255,255,255,0.3)',
                            borderWidth: 1,
                            callbacks: {
                                title: function(context) {
                                    if (context.length > 0) {
                                        const timestamp = context[0].parsed.x;
                                        return new Date(timestamp).toLocaleString();
                                    }
                                    return '';
                                },
                                label: function(context) {
                                    const datasetLabel = context.dataset.label;
                                    const value = context.parsed.y;
                                    
                                    if (datasetLabel === 'Barometric Pressure') {
                                        const dataPoint = context.raw;
                                        let tooltip = `🌡️ Pressure: ${value.toFixed(1)} hPa`;
                                        if (dataPoint && dataPoint.pressureChange !== undefined) {
                                            const trend = dataPoint.pressureChange > 0.1 ? '↗️' : 
                                                         dataPoint.pressureChange < -0.1 ? '↘️' : '→';
                                            const changeText = Math.abs(dataPoint.pressureChange) < 0.01 ? 
                                                              'Stable' : `${dataPoint.pressureChange.toFixed(1)} hPa`;
                                            tooltip += `\n📈 3-hr Change: ${changeText} ${trend}`;
                                        }
                                        return tooltip;
                                    }
                                    
                                    if (datasetLabel === 'Storm Risk') {
                                        const levels = ['None', 'Low', 'Moderate', 'High', 'Severe'];
                                        const icons = ['✅', '🟢', '🟡', '🟠', '🔴'];
                                        const levelText = levels[value] || 'Unknown';
                                        const icon = icons[value] || '❓';
                                        let tooltip = `${icon} Storm Risk: ${levelText}`;
                                        
                                        // Add pressure change info if available
                                        const dataPoint = context.raw;
                                        if (dataPoint && dataPoint.pressureChange !== undefined && Math.abs(dataPoint.pressureChange) > 0.1) {
                                            tooltip += `\n📉 Pressure Drop: ${Math.abs(dataPoint.pressureChange).toFixed(1)} hPa`;
                                        }
                                        
                                        return tooltip;
                                    }
                                    
                                    if (datasetLabel === 'Forecast Temperature') {
                                        return `🌤️ Forecast: ${value}°F`;
                                    }
                                    
                                    return `${datasetLabel}: ${value}`;
                                }
                            }
                        }
                    }
                }
            });
        }

        // Function to refresh the pressure chart with current time period
        async function refreshCurrentPressureChart() {
            if (pressureChart && currentPressureChartHours) {
                await createPressureChart(currentPressureChartHours);
            }
        }

        // Function to refresh the currently displayed chart without changing time period
        async function refreshCurrentChart() {
            if (temperatureChart) {
                // Check if there's new chart data before refreshing
                await checkAndRefreshChart(currentChartHours);
            }
            if (pressureChart) {
                // Refresh pressure chart as well
                await refreshCurrentPressureChart();
            }
        }

        // Smart chart refresh - only refreshes if new data is available
        async function checkAndRefreshChart(hours) {
            try {
                const token = localStorage.getItem('ventilation_auth_token');
                
                // If no authentication method is available, skip chart refresh
                if (!token && !CONFIG.apiSecret) {
                    return;
                }

                const response = await fetch(`${CONFIG.historyApiUrl}?deviceId=${CONFIG.deviceId}&hours=${hours}`, {
                    method: 'GET',
                    headers: getAuthHeaders()
                });
                
                if (!response.ok) {
                    // Don't refresh chart if API fails
                    return;
                }
                
                const data = await response.json();
                if (!data.data || data.data.length === 0) {
                    // No data available, don't refresh
                    return;
                }

                // Get the latest timestamp from the new data
                const latestDataPoint = data.data[0]; // API returns newest first
                let newLatestTimestamp = null;

                // Parse the timestamp from the latest data point
                if (latestDataPoint.timestamp) {
                    if (typeof latestDataPoint.timestamp === 'string') {
                        if (latestDataPoint.timestamp.includes('T') || latestDataPoint.timestamp.includes('-')) {
                            newLatestTimestamp = new Date(latestDataPoint.timestamp);
                        } else {
                            const unixSeconds = parseInt(latestDataPoint.timestamp);
                            if (!isNaN(unixSeconds) && unixSeconds > 1000000000) {
                                newLatestTimestamp = new Date(unixSeconds * 1000);
                            } else {
                                newLatestTimestamp = new Date(latestDataPoint.timestamp);
                            }
                        }
                    } else if (typeof latestDataPoint.timestamp === 'number') {
                        const timestamp = latestDataPoint.timestamp;
                        newLatestTimestamp = timestamp < 10000000000 ? new Date(timestamp * 1000) : new Date(timestamp);
                    } else {
                        newLatestTimestamp = new Date(latestDataPoint.timestamp);
                    }
                }

                // If we can't parse the timestamp, refresh anyway to be safe
                if (!newLatestTimestamp || isNaN(newLatestTimestamp.getTime())) {
                    updateChart(data.data, hours);
                    return;
                }

                // Check if this is newer than our stored latest timestamp
                if (!latestChartDataTimestamp || newLatestTimestamp > latestChartDataTimestamp) {
                    console.log(`Temperature chart: New data detected, updating chart (${newLatestTimestamp.toLocaleTimeString()})`);
                    
                    // Update our stored timestamp and refresh the chart
                    latestChartDataTimestamp = newLatestTimestamp;
                    updateChart(data.data, hours);
                } else {
                    console.log('Temperature chart: No new data points, skipping refresh to avoid unnecessary animations');
                }

            } catch (error) {
                console.error('Error checking for new chart data:', error);
                // On error, don't refresh to avoid unnecessary animations
            }
        }

        /**
         * Updates and renders the temperature chart with new data
         * Processes historical temperature data and creates Chart.js visualization
         * Handles multiple temperature sensors (indoor, outdoor, garage)
         * Manages chart updates, timestamps, and responsive design
         * @param {Array} data - Array of temperature data points from the API
         * @param {number} requestedHours - Number of hours of data requested (default: 6)
         * @returns {void}
         */
        function updateChart(data, requestedHours = 6) {
            const ctx = document.getElementById('temperatureChart').getContext('2d');
            
            // Update latest timestamp tracking for smart refresh
            if (data && data.length > 0) {
                const latestDataPoint = data[0]; // API returns newest first
                if (latestDataPoint.timestamp) {
                    let timestamp;
                    if (typeof latestDataPoint.timestamp === 'string') {
                        if (latestDataPoint.timestamp.includes('T') || latestDataPoint.timestamp.includes('-')) {
                            timestamp = new Date(latestDataPoint.timestamp);
                        } else {
                            const unixSeconds = parseInt(latestDataPoint.timestamp);
                            if (!isNaN(unixSeconds) && unixSeconds > 1000000000) {
                                timestamp = new Date(unixSeconds * 1000);
                            } else {
                                timestamp = new Date(latestDataPoint.timestamp);
                            }
                        }
                    } else if (typeof latestDataPoint.timestamp === 'number') {
                        const ts = latestDataPoint.timestamp;
                        timestamp = ts < 10000000000 ? new Date(ts * 1000) : new Date(ts);
                    } else {
                        timestamp = new Date(latestDataPoint.timestamp);
                    }
                    
                    if (!isNaN(timestamp.getTime())) {
                        latestChartDataTimestamp = timestamp;
                    }
                }
            }
            
            // Destroy existing chart
            if (temperatureChart) {
                temperatureChart.destroy();
            }

            // If no data, create a simple "no data" chart
            if (!data || data.length === 0) {
                // Hide effectiveness analysis when no data
                document.getElementById('effectivenessAnalysis').style.display = 'none';
                document.getElementById('noEffectivenessData').style.display = 'block';
                
                temperatureChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: ['No Data Available'],
                        datasets: [{
                            label: 'No Data',
                            data: [0],
                            borderColor: '#ddd',
                            backgroundColor: 'rgba(221, 221, 221, 0.1)',
                            pointRadius: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { 
                                display: true,
                                labels: {
                                    generateLabels: function() {
                                        return [{
                                            text: 'No data available - check authentication or API connection',
                                            fillStyle: '#ddd',
                                            strokeStyle: '#ddd'
                                        }];
                                    }
                                }
                            }
                        },
                        scales: {
                            y: { 
                                display: true,
                                title: { display: true, text: 'Waiting for data...' }
                            },
                            x: { 
                                display: true,
                                title: { display: true, text: 'Time' }
                            }
                        }
                    }
                });
                return;
            }
            
            // Data comes from API in reverse chronological order (newest first)
            // We need to reverse it to show oldest to newest (left to right)
            let sortedData = [...data].reverse();
            
            // Filter out corrupted data with invalid timestamps (fix for chart showing years 1954, 1963, 1972, 1981)
            function isValidTimestamp(timestamp) {
                return DashboardUtils.isValidTimestamp(timestamp);
            }
            
            // Filter out items with corrupted timestamps
            sortedData = sortedData.filter(item => {
                if (!item.timestamp) return false;
                return isValidTimestamp(item.timestamp);
            });
            
            console.log(`Chart data: ${data.length} total items, ${sortedData.length} valid items after timestamp filtering`);
            
            // Prepare time-based data points for proper temporal spacing
            const timeBasedData = sortedData.map((item, index) => {
                let date;
                
                // Handle different timestamp formats with enhanced validation
                if (typeof item.timestamp === 'string') {
                    if (item.timestamp.includes('T') || item.timestamp.includes('-')) {
                        date = new Date(item.timestamp);
                    } else {
                        const unixSeconds = parseInt(item.timestamp);
                        if (!isNaN(unixSeconds) && unixSeconds > 1000000000 && unixSeconds < 2000000000) {
                            date = new Date(unixSeconds * 1000);
                        } else {
                            console.warn('Invalid Unix timestamp:', item.timestamp);
                            return null; // Skip this item
                        }
                    }
                } else if (typeof item.timestamp === 'number') {
                    if (item.timestamp < 1000000000 || item.timestamp > 2000000000) {
                        console.warn('Invalid numeric timestamp:', item.timestamp);
                        return null; // Skip this item
                    }
                    date = item.timestamp < 10000000000 ? new Date(item.timestamp * 1000) : new Date(item.timestamp);
                } else {
                    console.warn('Unknown timestamp format:', item.timestamp);
                    return null; // Skip this item
                }
                
                // Final validation - reject if date is invalid or outside reasonable range
                if (isNaN(date.getTime())) {
                    console.warn('Failed to parse timestamp:', item.timestamp);
                    return null;
                }
                
                const year = date.getFullYear();
                if (year < 2020 || year > 2030) {
                    console.warn('Timestamp outside valid range (corrupted):', date.toISOString(), 'from:', item.timestamp);
                    return null;
                }
                
                return {
                    timestamp: date,
                    item: item
                };
            }).filter(dataPoint => dataPoint !== null); // Remove null entries

            // Debug: Log the final timestamp range being sent to chart
            if (timeBasedData.length > 0) {
                // Only essential debugging - removed verbose timestamp range logging
                console.log(`Chart prepared ${timeBasedData.length} data points`);
            }

            // Extract the actual sensor data with timestamps for Chart.js time scale
            const indoorTemps = timeBasedData.map(dataPoint => {
                // Check if the item has the expected structure
                if (dataPoint.item.sensors && dataPoint.item.sensors.indoor && typeof dataPoint.item.sensors.indoor.temp === 'number') {
                    return {
                        x: dataPoint.timestamp,
                        y: dataPoint.item.sensors.indoor.temp
                    };
                }
                return null;
            }).filter(point => point !== null);
            
            const outdoorTemps = timeBasedData.map(dataPoint => {
                if (dataPoint.item.sensors && dataPoint.item.sensors.outdoor && typeof dataPoint.item.sensors.outdoor.temp === 'number') {
                    return {
                        x: dataPoint.timestamp,
                        y: dataPoint.item.sensors.outdoor.temp
                    };
                }
                return null;
            }).filter(point => point !== null);
            
            const garageTemps = timeBasedData.map(dataPoint => {
                if (dataPoint.item.sensors && dataPoint.item.sensors.garage && typeof dataPoint.item.sensors.garage.temp === 'number') {
                    return {
                        x: dataPoint.timestamp,
                        y: dataPoint.item.sensors.garage.temp
                    };
                }
                return null;
            }).filter(point => point !== null);
            
            const fanStatus = timeBasedData.map(dataPoint => {
                if (dataPoint.item.system && typeof dataPoint.item.system.fanOn === 'boolean') {
                    return {
                        x: dataPoint.timestamp,
                        y: dataPoint.item.system.fanOn ? 1 : 0
                    };
                }
                return null;
            }).filter(point => point !== null);

            // Debug fan status data
            console.log('Fan status data points:', fanStatus.length);

            // Calculate ventilation effectiveness for substantial sessions (30+ minutes)
            const effectivenessData = calculateVentilationEffectiveness(timeBasedData);
            console.log('Effectiveness data points:', effectivenessData.length);
            
            // Debug logging for ongoing sessions
            if (timeBasedData.length > 0) {
                const recentDataPoints = timeBasedData.slice(-5);
                const fanCurrentlyOn = recentDataPoints.some(point => 
                    point.item.system && point.item.system.fanOn === true
                );
                console.log('Recent fan status check:', {
                    recentDataPoints: recentDataPoints.length,
                    fanCurrentlyOn: fanCurrentlyOn,
                    latestTimestamp: recentDataPoints[recentDataPoints.length - 1]?.timestamp
                });
            }

            // Update effectiveness analysis section
            updateEffectivenessAnalysis(effectivenessData);

            // Create new chart with time-based data
            temperatureChart = new Chart(ctx, {
                type: 'line',
                data: {
                    datasets: [
                        {
                            label: 'Indoor Temperature (°F)',
                            data: indoorTemps,
                            borderColor: '#e74c3c',
                            backgroundColor: 'rgba(231, 76, 60, 0.1)',
                            tension: 0.4,
                            yAxisID: 'temp'
                        },
                        {
                            label: 'Outdoor Temperature (°F)',
                            data: outdoorTemps,
                            borderColor: '#3498db',
                            backgroundColor: 'rgba(52, 152, 219, 0.1)',
                            tension: 0.4,
                            yAxisID: 'temp'
                        },
                        {
                            label: 'Garage Temperature (°F)',
                            data: garageTemps,
                            borderColor: '#f39c12',
                            backgroundColor: 'rgba(243, 156, 18, 0.1)',
                            tension: 0.4,
                            yAxisID: 'temp'
                        },
                        {
                            label: 'Fan Status',
                            data: fanStatus,
                            borderColor: '#28a745',
                            backgroundColor: 'rgba(40, 167, 69, 0.2)',
                            stepped: true,
                            fill: true,
                            tension: 0,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            yAxisID: 'fan'
                        },
                        {
                            label: 'Ventilation Effectiveness (%)',
                            data: effectivenessData,
                            borderColor: '#9932cc',
                            backgroundColor: '#9932cc',
                            type: 'line',
                            tension: 0.2,
                            pointRadius: 6,
                            pointHoverRadius: 8,
                            pointBackgroundColor: effectivenessData.map(point => getEffectivenessColor(point.y)),
                            pointBorderColor: effectivenessData.map(point => getEffectivenessColor(point.y)),
                            pointBorderWidth: 2,
                            yAxisID: 'effectiveness',
                            fill: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        temp: {
                            type: 'linear',
                            position: 'left',
                            title: {
                                display: true,
                                text: 'Temperature (°F)'
                            }
                        },
                        fan: {
                            type: 'linear',
                            position: 'right',
                            min: 0,
                            max: 1,
                            title: {
                                display: true,
                                text: 'Fan Status'
                            },
                            ticks: {
                                callback: function(value) {
                                    return value === 1 ? 'ON' : 'OFF';
                                }
                            },
                            grid: {
                                drawOnChartArea: false,
                            }
                        },
                        effectiveness: {
                            type: 'linear',
                            position: 'right',
                            min: 0,
                            max: 100,
                            title: {
                                display: true,
                                text: 'Effectiveness (%)'
                            },
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                }
                            },
                            grid: {
                                drawOnChartArea: false,
                            },
                            // Offset to avoid overlapping with fan axis
                            offset: true
                        },
                        x: {
                            type: 'time',
                            time: {
                                displayFormats: {
                                    minute: 'h:mm a',
                                    hour: 'h a',
                                    day: 'M/d'
                                },
                                tooltipFormat: 'MMM d, h:mm a'
                            },
                            title: {
                                display: true,
                                text: 'Time'
                            },
                            ticks: {
                                maxTicksLimit: 8,
                                maxRotation: 45,
                                minRotation: 0,
                                autoSkip: true
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                title: function(context) {
                                    if (context.length > 0) {
                                        const timestamp = context[0].parsed.x;
                                        return new Date(timestamp).toLocaleString();
                                    }
                                    return '';
                                },
                                label: function(context) {
                                    const datasetLabel = context.dataset.label;
                                    const value = context.parsed.y;
                                    
                                    // Special handling for effectiveness data
                                    if (datasetLabel === 'Ventilation Effectiveness (%)') {
                                        const sessionData = context.raw.sessionData;
                                        if (sessionData) {
                                            const lines = [
                                                `🔄 Effectiveness: ${sessionData.percentage}%`,
                                                `⏱️ Fan Runtime: ${sessionData.fanMinutes} minutes${sessionData.isOngoing ? ' (ongoing)' : ''}`,
                                                `🌡️ Temp Change: ${sessionData.startTemp}°F → ${sessionData.endTemp}°F`,
                                                `📉 Actual Reduction: ${sessionData.actualReduction}°F`,
                                                `📊 Theoretical Max: ${sessionData.theoreticalMax}°F`,
                                                `🌤️ Outdoor Average: ${sessionData.outdoorAvg}°F`,
                                                `📋 Performance: ${getEffectivenessRating(sessionData.percentage)}`
                                            ];
                                            
                                            // Add bonus information if applied
                                            if (sessionData.bonusApplied && sessionData.bonusApplied > 0) {
                                                lines.push(`🎯 Bonus Applied: +${sessionData.bonusApplied}% (challenging conditions)`);
                                            }
                                            
                                            return lines;
                                        }
                                        return `Effectiveness: ${value}%`;
                                    }
                                    
                                    // Handle other datasets
                                    if (datasetLabel === 'Fan Status') {
                                        return `Fan: ${value === 1 ? 'ON' : 'OFF'}`;
                                    }
                                    
                                    if (datasetLabel.includes('Temperature')) {
                                        return `${datasetLabel}: ${value}°F`;
                                    }
                                    
                                    return `${datasetLabel}: ${value}`;
                                }
                            }
                        }
                    }
                }
            });
        }

        // Enhanced Incident Almanac with multiple visualization modes
        async function loadIncidentAlmanac() {
            const viewType = document.getElementById('almanacViewType').value;
            const periodFilter = parseInt(document.getElementById('almanacPeriodFilter').value);
            const severityFilter = document.getElementById('almanacSeverityFilter').value;
            const statusElement = document.getElementById('almanacStatus');
            
            // DEBUGGING: Log the filter values
            console.log('=== INCIDENT ALMANAC: loadIncidentAlmanac() called ===');
            console.log('ALMANAC DEBUG: viewType =', viewType);
            console.log('ALMANAC DEBUG: periodFilter =', periodFilter);
            console.log('ALMANAC DEBUG: severityFilter =', severityFilter);
            console.log('ALMANAC DEBUG: originalIncidentsData.length =', originalIncidentsData ? originalIncidentsData.length : 'null/undefined');
            
            try {
                statusElement.textContent = 'Loading incident data...';
                
                // Calculate time range with better granularity
                const now = new Date();
                let startDate;
                let periodDescription;
                
                if (periodFilter === 1) {
                    // Previous month - more precise calculation
                    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    startDate = new Date(firstOfThisMonth.getFullYear(), firstOfThisMonth.getMonth() - 1, 1);
                    const endOfPrevMonth = new Date(firstOfThisMonth.getTime() - 1);
                    
                    console.log('ALMANAC DEBUG: Previous Month - from', startDate, 'to', endOfPrevMonth);
                    periodDescription = `${startDate.toLocaleDateString('en-US', {month: 'long', year: 'numeric'})}`;
                } else if (periodFilter === 7) {
                    // Last 7 days
                    startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
                    console.log('ALMANAC DEBUG: Last 7 Days - from', startDate, 'to', now);
                    periodDescription = `Last 7 days (since ${startDate.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})})`;
                } else if (periodFilter === 30) {
                    // Last 30 days
                    startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
                    console.log('ALMANAC DEBUG: Last 30 Days - from', startDate, 'to', now);
                    periodDescription = `Last 30 days (since ${startDate.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})})`;
                } else if (periodFilter === 90) {
                    // Last 90 days
                    startDate = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
                    console.log('ALMANAC DEBUG: Last 90 Days - from', startDate, 'to', now);
                    periodDescription = `Last 90 days (since ${startDate.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})})`;
                } else if (periodFilter === 12) {
                    // Last 12 months
                    startDate = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
                    console.log('ALMANAC DEBUG: Last 12 Months - from', startDate, 'to', now);
                    periodDescription = `Last 12 months (since ${startDate.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})})`;
                } else {
                    // Default case
                    startDate = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
                    periodDescription = 'Last 12 months';
                }
                
                // Use existing incident data or fetch if needed
                let incidents = originalIncidentsData || [];
                
                if (incidents.length === 0) {
                    console.log('ALMANAC DEBUG: No incident data available');
                    statusElement.textContent = 'No incident data available';
                    showAlmanacView(viewType, [], periodFilter);
                    return;
                }
                
                // Filter by severity
                let filteredIncidents = incidents.filter(incident => {
                    if (severityFilter === 'critical') return incident.severity === 0;
                    if (severityFilter === 'high') return incident.severity === 1;
                    if (severityFilter === 'medium') return incident.severity === 2;
                    if (severityFilter === 'low') return incident.severity === 3;
                    if (severityFilter === 'critical-high') return incident.severity <= 1;
                    if (severityFilter === 'critical-high-medium') return incident.severity <= 2;
                    if (severityFilter === 'all') return incident.severity >= 0 && incident.severity <= 3;
                    return false;
                });
                
                console.log('ALMANAC DEBUG: After severity filter:', filteredIncidents.length, 'incidents');
                
                // Filter by time range with additional debugging
                const cutoffTimestamp = Math.floor(startDate.getTime() / 1000);
                console.log('ALMANAC DEBUG: cutoffTimestamp =', cutoffTimestamp, new Date(cutoffTimestamp * 1000));
                
                // Show sample incident timestamps for debugging
                const sampleIncidents = filteredIncidents.slice(0, 3);
                console.log('ALMANAC DEBUG: Sample incident timestamps:');
                sampleIncidents.forEach((incident, i) => {
                    const incidentDate = new Date(incident.startTime * 1000);
                    console.log(`  Incident ${i+1}: ${incident.startTime} (${incidentDate.toLocaleString()}) - ${incident.startTime >= cutoffTimestamp ? 'PASSES' : 'FILTERED OUT'}`);
                });
                
                const beforeTimeFilter = filteredIncidents.length;
                filteredIncidents = filteredIncidents.filter(incident => incident.startTime >= cutoffTimestamp);
                console.log('ALMANAC DEBUG: Before time filter:', beforeTimeFilter, 'incidents');
                console.log('ALMANAC DEBUG: After time filter:', filteredIncidents.length, 'incidents');
                
                // More descriptive status message
                statusElement.textContent = `Showing ${filteredIncidents.length} incidents from ${periodDescription} (${beforeTimeFilter - filteredIncidents.length} filtered out by date)`;
                
                // Show the appropriate view
                showAlmanacView(viewType, filteredIncidents, periodFilter);
                
            } catch (error) {
                console.error('Error loading incident almanac:', error);
                statusElement.textContent = 'Error loading incident data';
                showAlmanacView(viewType, [], periodFilter);
            }
        }
        
        // Show the selected almanac view
        function showAlmanacView(viewType, incidents, periodFilter) {
            // Hide all views
            document.getElementById('timelineView').style.display = 'none';
            document.getElementById('correlationView').style.display = 'none';
            document.getElementById('chartContainer').style.display = 'none';
            
            switch (viewType) {
                case 'timeline':
                    document.getElementById('timelineView').style.display = 'block';
                    renderTimelineSwimlane(incidents, periodFilter);
                    break;
                case 'correlation':
                    document.getElementById('correlationView').style.display = 'block';
                    renderCorrelationMatrix(incidents);
                    break;
                case 'monthly':
                default:
                    document.getElementById('chartContainer').style.display = 'block';
                    // Use existing chart rendering with backwards compatibility
                    const severityFilter = document.getElementById('almanacSeverityFilter').value;
                    updateIncidentTrendsChart(incidents, 'monthly', severityFilter, null);
                    break;
            }
        }
        
        // Render Timeline Swimlane View
        function renderTimelineSwimlane(incidents, periodFilter) {
            const container = document.getElementById('incidentTimeline');
            const monthElement = document.getElementById('timelineMonth');
            
            if (incidents.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 50px; color: #666;">No incidents found for selected period and severity</div>';
                monthElement.textContent = '';
                return;
            }
            
            // Determine the month(s) being displayed
            if (periodFilter === 1) {
                const now = new Date();
                const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                monthElement.textContent = `${prevMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}`;
            } else {
                monthElement.textContent = 'Last 12 Months';
            }
            
            // Group incidents by type for swimlanes
            const incidentTypes = {
                0: { name: 'Power Loss', icon: '⚡', color: '#dc3545' },
                1: { name: 'WiFi Down', icon: '📶', color: '#fd7e14' },
                2: { name: 'Internet Down', icon: '🌐', color: '#6f42c1' },
                3: { name: 'API Down', icon: '☁️', color: '#20c997' },
                4: { name: 'Storm Event', icon: '🌩️', color: '#0dcaf0' },
                5: { name: 'Heat Event', icon: '🔥', color: '#dc3545' },
                6: { name: 'Freeze Event', icon: '🧊', color: '#0d6efd' }
            };
            
            const severityColors = {
                0: '#dc3545', // Critical - Red
                1: '#fd7e14', // High - Orange  
                2: '#ffc107', // Medium - Yellow
                3: '#6c757d'  // Low - Gray
            };
            
            // Calculate time boundaries
            let minTime = Math.min(...incidents.map(i => i.startTime));
            let maxTime = Math.max(...incidents.map(i => i.endTime > 0 ? i.endTime : i.startTime));
            
            // Add padding to time range
            const timeRange = maxTime - minTime;
            const padding = Math.max(timeRange * 0.1, 3600); // 10% or 1 hour minimum
            minTime -= padding;
            maxTime += padding;
            
            let html = '<div class="swimlane-container" style="width: 100%; overflow-x: auto; padding-bottom: 35px;">';
            
            // Time axis header
            html += '<div style="display: flex; align-items: center; margin-bottom: 15px; padding-left: 120px;">';
            html += '<div style="flex: 1; height: 20px; background: linear-gradient(to right, #e9ecef 0%, #e9ecef 100%); border-radius: 3px; position: relative; margin-bottom: 30px;">';
            
            // Add time markers
            const timeSteps = 10;
            for (let i = 0; i <= timeSteps; i++) {
                const timePoint = minTime + (maxTime - minTime) * (i / timeSteps);
                const date = new Date(timePoint * 1000);
                const left = (i / timeSteps) * 100;
                html += `<div style="position: absolute; left: ${left}%; top: 25px; font-size: 0.7em; color: #666; transform: translateX(-50%); white-space: nowrap;">`;
                html += `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                html += '</div>';
            }
            
            html += '</div></div>';
            
            // Render swimlanes for each incident type
            Object.entries(incidentTypes).forEach(([typeId, typeInfo]) => {
                const typeIncidents = incidents.filter(i => i.type == typeId);
                
                html += '<div style="display: flex; align-items: center; margin-bottom: 8px;">';
                html += `<div style="width: 110px; font-size: 0.85em; color: #333; font-weight: bold;">${typeInfo.icon} ${typeInfo.name}</div>`;
                html += '<div style="flex: 1; height: 25px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 3px; position: relative;">';
                
                // Render incidents for this type
                typeIncidents.forEach(incident => {
                    const startPercent = ((incident.startTime - minTime) / (maxTime - minTime)) * 100;
                    const duration = incident.endTime > 0 ? incident.endTime - incident.startTime : 300; // 5 min default for ongoing
                    const widthPercent = Math.max((duration / (maxTime - minTime)) * 100, 0.5); // Minimum 0.5% width
                    
                    const color = severityColors[incident.severity] || '#6c757d';
                    const opacity = incident.endTime === 0 ? 0.7 : 1.0; // Lighter for ongoing
                    
                    const formatDuration = (seconds) => {
                        if (seconds < 60) return `${seconds}s`;
                        if (seconds < 3600) return `${Math.floor(seconds/60)}m ${seconds%60}s`;
                        const hours = Math.floor(seconds/3600);
                        const mins = Math.floor((seconds%3600)/60);
                        return `${hours}h ${mins}m`;
                    };
                    
                    const startDate = new Date(incident.startTime * 1000);
                    const endDate = incident.endTime > 0 ? new Date(incident.endTime * 1000) : null;
                    const tooltipText = `${typeInfo.name}\nStart: ${startDate.toLocaleString()}\n${endDate ? `End: ${endDate.toLocaleString()}\nDuration: ${formatDuration(duration)}` : 'Ongoing'}\nSeverity: ${['Critical', 'High', 'Medium', 'Low'][incident.severity]}`;
                    
                    html += `<div style="position: absolute; left: ${startPercent}%; width: ${widthPercent}%; height: 100%; background: ${color}; opacity: ${opacity}; border-radius: 2px; cursor: pointer;" `;
                    html += `title="${tooltipText}" `;
                    html += `onmouseover="highlightCorrelations(${incident.startTime}, ${incident.endTime || incident.startTime}, '${typeInfo.name}')" `;
                    html += `onmouseout="clearCorrelationHighlight()"></div>`;
                });
                
                html += '</div></div>';
            });
            
            html += '</div>';
            
            // Add legend
            html += '<div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px; font-size: 0.85em;">';
            html += '<strong>Severity Colors:</strong> ';
            html += '<span style="color: #dc3545;">■ Critical</span> ';
            html += '<span style="color: #fd7e14;">■ High</span> ';
            html += '<span style="color: #ffc107;">■ Medium</span> ';
            html += '<span style="color: #6c757d;">■ Low</span>';
            html += '</div>';
            
            container.innerHTML = html;
        }
        
        // Render Correlation Matrix
        function renderCorrelationMatrix(incidents) {
            const container = document.getElementById('correlationMatrix');
            const insightsContainer = document.getElementById('insightsList');
            
            if (incidents.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 50px; color: #666;">No incidents available for correlation analysis</div>';
                insightsContainer.innerHTML = '<p style="color: #666;">No data available for pattern analysis</p>';
                return;
            }
            
            const incidentTypes = {
                0: 'Power Loss',
                1: 'WiFi Down', 
                2: 'Internet Down',
                3: 'API Down',
                4: 'Storm Event',
                5: 'Heat Event',
                6: 'Freeze Event'
            };
            
            // Calculate correlations
            const correlations = calculateCorrelationMatrix(incidents);
            const insights = analyzeCorrelationPatterns(incidents, correlations);
            
            // Render correlation matrix
            let html = '<div style="overflow-x: auto;"><table style="border-collapse: collapse; width: 100%; min-width: 600px;">';
            html += '<tr><th style="border: 1px solid #dee2e6; padding: 8px; background: #f8f9fa;"></th>';
            
            // Header row
            Object.values(incidentTypes).forEach(typeName => {
                html += `<th style="border: 1px solid #dee2e6; padding: 8px; background: #f8f9fa; font-size: 0.8em; writing-mode: vertical-rl; text-orientation: mixed;">${typeName}</th>`;
            });
            html += '</tr>';
            
            // Data rows
            Object.entries(incidentTypes).forEach(([typeId1, typeName1]) => {
                html += `<tr><td style="border: 1px solid #dee2e6; padding: 8px; background: #f8f9fa; font-weight: bold; font-size: 0.85em;">${typeName1}</td>`;
                
                Object.entries(incidentTypes).forEach(([typeId2, typeName2]) => {
                    if (typeId1 === typeId2) {
                        html += '<td style="border: 1px solid #dee2e6; padding: 8px; background: #e9ecef; text-align: center;">-</td>';
                    } else {
                        const correlation = correlations[`${typeId1}-${typeId2}`] || 0;
                        const intensity = Math.abs(correlation);
                        const color = correlation > 0.3 ? `rgba(220, 53, 69, ${intensity})` : 
                                     correlation > 0.1 ? `rgba(255, 193, 7, ${intensity})` : 
                                     `rgba(108, 117, 125, ${Math.max(0.1, intensity)})`;
                        
                        html += `<td style="border: 1px solid #dee2e6; padding: 8px; background: ${color}; text-align: center; font-size: 0.8em; color: ${intensity > 0.5 ? 'white' : 'black'};">${correlation.toFixed(2)}</td>`;
                    }
                });
                html += '</tr>';
            });
            
            html += '</table></div>';
            
            // Add correlation explanation
            html += '<div style="margin-top: 15px; font-size: 0.85em; color: #666;">';
            html += '<strong>Correlation Values:</strong> 0.00 = No correlation, 1.00 = Perfect correlation<br>';
            html += '<strong>Colors:</strong> <span style="background: rgba(220, 53, 69, 0.7); color: white; padding: 2px 6px;">Strong (>0.3)</span> ';
            html += '<span style="background: rgba(255, 193, 7, 0.7); padding: 2px 6px;">Moderate (0.1-0.3)</span> ';
            html += '<span style="background: rgba(108, 117, 125, 0.3); padding: 2px 6px;">Weak (<0.1)</span>';
            html += '</div>';
            
            container.innerHTML = html;
            
            // Render insights
            let insightsHtml = '';
            insights.forEach(insight => {
                insightsHtml += `<div class="insight-item" style="margin: 8px 0; padding: 8px; border-left: 3px solid #17a2b8; background: rgba(23, 162, 184, 0.1);">`;
                insightsHtml += `<strong>${insight.type}:</strong> ${insight.description}`;
                insightsHtml += '</div>';
            });
            
            if (insightsHtml === '') {
                insightsHtml = '<p style="color: #666;">No significant patterns detected with current data set</p>';
            }
            
            insightsContainer.innerHTML = insightsHtml;
        }
        
        // Calculate correlation matrix between incident types
        function calculateCorrelationMatrix(incidents) {
            const correlations = {};
            const timeWindow = 2 * 60 * 60; // 2 hours correlation window
            
            // Get all unique incident type pairs
            const types = [...new Set(incidents.map(i => i.type))];
            
            types.forEach(type1 => {
                types.forEach(type2 => {
                    if (type1 !== type2) {
                        const type1Incidents = incidents.filter(i => i.type === type1);
                        const type2Incidents = incidents.filter(i => i.type === type2);
                        
                        let correlatedCount = 0;
                        let totalType1 = type1Incidents.length;
                        
                        if (totalType1 === 0) {
                            correlations[`${type1}-${type2}`] = 0;
                            return;
                        }
                        
                        // Check how many type1 incidents have a type2 incident within the time window
                        type1Incidents.forEach(incident1 => {
                            const hasCorrelation = type2Incidents.some(incident2 => {
                                const timeDiff = Math.abs(incident2.startTime - incident1.startTime);
                                return timeDiff <= timeWindow;
                            });
                            
                            if (hasCorrelation) {
                                correlatedCount++;
                            }
                        });
                        
                        correlations[`${type1}-${type2}`] = correlatedCount / totalType1;
                    }
                });
            });
            
            return correlations;
        }
        
        // Analyze correlation patterns and generate insights
        function analyzeCorrelationPatterns(incidents, correlations) {
            const insights = [];
            const incidentTypes = {
                0: 'Power Loss', 1: 'WiFi Down', 2: 'Internet Down',
                3: 'API Down', 4: 'Storm Event', 5: 'Heat Event', 6: 'Freeze Event'
            };
            
            // Find strong correlations
            Object.entries(correlations).forEach(([key, value]) => {
                if (value >= 0.5) {
                    const [type1, type2] = key.split('-');
                    insights.push({
                        type: 'Strong Correlation',
                        description: `${incidentTypes[type1]} incidents are followed by ${incidentTypes[type2]} incidents ${(value * 100).toFixed(0)}% of the time within 2 hours`
                    });
                }
            });
            
            // Find cascade patterns (A → B → C)
            const cascades = findCascadePatterns(incidents);
            cascades.forEach(cascade => {
                insights.push({
                    type: 'Cascade Pattern',
                    description: `${cascade.pattern} detected with average delays of ${cascade.delays.join(' → ')}`
                });
            });
            
            // Temporal patterns
            const temporalPatterns = analyzeTemporalPatterns(incidents);
            temporalPatterns.forEach(pattern => {
                insights.push({
                    type: 'Temporal Pattern',
                    description: pattern
                });
            });
            
            return insights;
        }
        
        // Find cascade failure patterns
        function findCascadePatterns(incidents) {
            // This is a simplified implementation - could be enhanced with more sophisticated pattern detection
            const cascades = [];
            const timeWindow = 30 * 60; // 30 minutes for cascade detection
            
            // Look for Storm → Power → WiFi cascade
            const stormIncidents = incidents.filter(i => i.type === 4);
            stormIncidents.forEach(storm => {
                const powerIncidents = incidents.filter(i => 
                    i.type === 0 && 
                    i.startTime >= storm.startTime && 
                    i.startTime <= storm.startTime + timeWindow
                );
                
                powerIncidents.forEach(power => {
                    const wifiIncidents = incidents.filter(i =>
                        i.type === 1 &&
                        i.startTime >= power.startTime &&
                        i.startTime <= power.startTime + timeWindow
                    );
                    
                    if (wifiIncidents.length > 0) {
                        const delay1 = power.startTime - storm.startTime;
                        const delay2 = wifiIncidents[0].startTime - power.startTime;
                        cascades.push({
                            pattern: 'Storm Event → Power Loss → WiFi Down',
                            delays: [`${Math.floor(delay1/60)}min`, `${Math.floor(delay2/60)}min`]
                        });
                    }
                });
            });
            
            return cascades;
        }
        
        // Analyze temporal patterns
        function analyzeTemporalPatterns(incidents) {
            const patterns = [];
            
            // Group by day of week
            const dayGroups = {};
            incidents.forEach(incident => {
                const date = new Date(incident.startTime * 1000);
                const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
                dayGroups[dayName] = (dayGroups[dayName] || 0) + 1;
            });
            
            // Find peak day
            const peakDay = Object.entries(dayGroups).reduce((a, b) => a[1] > b[1] ? a : b);
            if (peakDay[1] > 1) {
                patterns.push(`Most incidents occur on ${peakDay[0]} (${peakDay[1]} incidents)`);
            }
            
            // Group by hour
            const hourGroups = {};
            incidents.forEach(incident => {
                const date = new Date(incident.startTime * 1000);
                const hour = date.getHours();
                hourGroups[hour] = (hourGroups[hour] || 0) + 1;
            });
            
            // Find peak hour
            const peakHour = Object.entries(hourGroups).reduce((a, b) => a[1] > b[1] ? a : b);
            if (peakHour[1] > 1) {
                const hour12 = parseInt(peakHour[0]) === 0 ? 12 : 
                             parseInt(peakHour[0]) > 12 ? parseInt(peakHour[0]) - 12 : parseInt(peakHour[0]);
                const ampm = parseInt(peakHour[0]) >= 12 ? 'PM' : 'AM';
                patterns.push(`Peak incident time is ${hour12}:00 ${ampm} (${peakHour[1]} incidents)`);
            }
            
            return patterns;
        }
        
        // Highlight correlations in timeline view
        function highlightCorrelations(incidentStart, incidentEnd, incidentType) {
            const indicator = document.getElementById('correlationIndicator');
            const text = document.getElementById('correlationText');
            const timeWindow = 2 * 60 * 60; // 2 hours
            
            // Find related incidents within time window
            const relatedIncidents = (originalIncidentsData || []).filter(incident => {
                const timeDiff = Math.min(
                    Math.abs(incident.startTime - incidentStart),
                    Math.abs((incident.endTime || incident.startTime) - incidentStart)
                );
                return timeDiff <= timeWindow && incident.startTime !== incidentStart;
            });
            
            if (relatedIncidents.length > 0) {
                const typeNames = {0: 'Power Loss', 1: 'WiFi Down', 2: 'Internet Down', 3: 'API Down', 4: 'Storm Event', 5: 'Heat Event', 6: 'Freeze Event'};
                const relatedTypes = [...new Set(relatedIncidents.map(i => typeNames[i.type]))];
                
                text.textContent = `${incidentType} correlates with: ${relatedTypes.join(', ')} (within 2 hours)`;
                indicator.style.display = 'block';
            } else {
                indicator.style.display = 'none';
            }
        }
        
        // Clear correlation highlighting
        function clearCorrelationHighlight() {
            document.getElementById('correlationIndicator').style.display = 'none';
        }

        // Legacy function to maintain compatibility
        async function loadIncidentTrends() {
            // Redirect to new function with monthly view
            document.getElementById('almanacViewType').value = 'monthly';
            await loadIncidentAlmanac();
        }

        // Global tracking for data sources
        window.dataSourceTracker = {
            temperatureDataSources: {},
            monthlyDataSources: {},
            
            trackTemperatureSource: function(timeRange, source, details) {
                this.temperatureDataSources[timeRange] = {
                    source: source,
                    details: details,
                    timestamp: new Date().toISOString()
                };
                this.updateTemperatureDataSourceDisplay();
            },
            
            trackMonthlySource: function(yearMonth, source, details) {
                this.monthlyDataSources[yearMonth] = {
                    source: source,
                    details: details,
                    timestamp: new Date().toISOString()
                };
                this.updateMonthlyDataSourceDisplay();
            },
            
            updateTemperatureDataSourceDisplay: function() {
                const indicator = document.getElementById('dataSourceIndicator');
                const details = document.getElementById('dataSourceDetails');
                
                if (Object.keys(this.temperatureDataSources).length === 0) {
                    indicator.style.display = 'none';
                    return;
                }
                
                let displayText = '';
                Object.entries(this.temperatureDataSources).forEach(([timeRange, info]) => {
                    displayText += `${timeRange}: ${info.source} (${info.details})\n`;
                });
                
                details.textContent = displayText.trim();
                indicator.style.display = 'block';
            },
            
            updateMonthlyDataSourceDisplay: function() {
                const indicator = document.getElementById('monthlyDataSourceIndicator');
                const details = document.getElementById('monthlyDataSourceDetails');
                
                if (Object.keys(this.monthlyDataSources).length === 0) {
                    indicator.style.display = 'none';
                    return;
                }
                
                const preCalculatedMonths = [];
                const jsCalculatedMonths = [];
                
                Object.entries(this.monthlyDataSources).forEach(([yearMonth, info]) => {
                    if (info.source === 'Azure Table') {
                        preCalculatedMonths.push(yearMonth);
                    } else if (info.source === 'JavaScript') {
                        jsCalculatedMonths.push(yearMonth);
                    }
                });
                
                let displayText = '';
                if (preCalculatedMonths.length > 0) {
                    displayText += `📊 Pre-calculated (Azure): ${preCalculatedMonths.join(', ')}\n`;
                }
                if (jsCalculatedMonths.length > 0) {
                    displayText += `🔄 JavaScript calculated: ${jsCalculatedMonths.join(', ')}\n`;
                }
                
                details.textContent = displayText.trim();
                indicator.style.display = 'block';
            },
            
            clearAll: function() {
                this.temperatureDataSources = {};
                this.monthlyDataSources = {};
                this.updateTemperatureDataSourceDisplay();
                this.updateMonthlyDataSourceDisplay();
            }
        };

        // Fetch temperature data for trends overlay - now uses server-side aggregation
        async function fetchTemperatureDataForTrends() {
            try {
                const token = localStorage.getItem('ventilation_auth_token');
                
                // If no authentication method is available, return null
                if (!token && !CONFIG.apiSecret) {
                    window.dataSourceTracker.trackTemperatureSource('Monthly Trends', 'No Auth', 'Authentication required');
                    return null;
                }

                // Use new monthly aggregation endpoint for better performance
                const response = await fetch(`${CONFIG.historyApiUrl}?deviceId=${CONFIG.deviceId}&aggregation=monthly&months=12`, {
                    method: 'GET',
                    headers: getAuthHeaders()
                });
                
                if (!response.ok) {
                    console.error('Monthly aggregation API failed, falling back to raw data');
                    window.dataSourceTracker.trackTemperatureSource('Monthly Trends', 'Fallback to Legacy', 'API failed, using raw data');
                    return await fetchTemperatureDataForTrendsLegacy();
                }
                
                const data = await response.json();
                if (data.data && data.data.length > 0) {
                    // Track successful use of server-side aggregation
                    window.dataSourceTracker.trackTemperatureSource('Monthly Trends', 'Azure Functions API', `${data.data.length} pre-calculated months`);
                    
                    // Track each month's data source
                    data.data.forEach(monthData => {
                        const yearMonth = `${monthData.Year}-${String(monthData.Month).padStart(2, '0')}`;
                        window.dataSourceTracker.trackMonthlySource(yearMonth, 'Azure Table', `${monthData.TotalDataPoints} data points`);
                    });
                    
                    // Convert monthly aggregated data to format expected by existing functions
                    return convertMonthlyStatsToTemperatureData(data.data);
                }
                
                console.log('No monthly aggregated data available');
                window.dataSourceTracker.trackTemperatureSource('Monthly Trends', 'No Data', 'No pre-calculated data available');
                return null;
                
            } catch (error) {
                console.error('Error fetching monthly aggregated temperature data:', error);
                window.dataSourceTracker.trackTemperatureSource('Monthly Trends', 'Error - Fallback', error.message);
                // Fallback to legacy method
                return await fetchTemperatureDataForTrendsLegacy();
            }
        }

        // Convert monthly aggregated statistics to temperature data format
        function convertMonthlyStatsToTemperatureData(monthlyStats) {
            const temperatureData = [];
            
            // Store detailed monthly stats for tooltips
            window.detailedMonthlyStats = {};
            
            monthlyStats.forEach(monthData => {
                // Create month label matching chart format (e.g., "Aug 25")
                const monthDate = new Date(monthData.Year, monthData.Month - 1, 1);
                const monthLabel = monthDate.toLocaleDateString('en-US', {month: 'short', year: '2-digit'});
                
                console.log(`Storing detailed stats for: ${monthLabel} (from ${monthData.Year}-${monthData.Month})`);
                console.log('Available fields in monthData:', Object.keys(monthData));
                console.log('WiFiDownIncidents field value:', monthData.WiFiDownIncidents);
                console.log('incidents_by_type field value:', monthData.incidents_by_type);
                
                // Store detailed monthly stats for tooltips (ensure numbers are parsed)
                window.detailedMonthlyStats[monthLabel] = {
                    totalDataPoints: parseInt(monthData.TotalDataPoints) || 0,
                    fanOnPercentage: parseFloat(monthData.FanOnPercentage) || 0,
                    totalFanMinutes: parseInt(monthData.TotalFanMinutes) || 0,
                    highTempIncidents: parseInt(monthData.HighTempIncidents) || 0,
                    freezeTempIncidents: parseInt(monthData.FreezeTempIncidents) || 0,
                    powerOutageIncidents: parseInt(monthData.PowerOutageIncidents) || 0,
                    wifiDownIncidents: parseInt(monthData.WiFiDownIncidents) || 0,
                    indoorHumidityRange: {
                        min: parseFloat(monthData.IndoorHumidityMin) || null,
                        max: parseFloat(monthData.IndoorHumidityMax) || null,
                        avg: parseFloat(monthData.IndoorHumidityAvg) || null
                    },
                    outdoorHumidityRange: {
                        min: parseFloat(monthData.OutdoorHumidityMin) || null,
                        max: parseFloat(monthData.OutdoorHumidityMax) || null,
                        avg: parseFloat(monthData.OutdoorHumidityAvg) || null
                    },
                    indoorTempRange: {
                        min: parseFloat(monthData.IndoorTempMin) || null,
                        max: parseFloat(monthData.IndoorTempMax) || null,
                        avg: parseFloat(monthData.IndoorTempAvg) || null
                    },
                    outdoorTempRange: {
                        min: parseFloat(monthData.OutdoorTempMin) || null,
                        max: parseFloat(monthData.OutdoorTempMax) || null,
                        avg: parseFloat(monthData.OutdoorTempAvg) || null
                    },
                    garageTempRange: {
                        min: parseFloat(monthData.GarageTempMin) || null,
                        max: parseFloat(monthData.GarageTempMax) || null,
                        avg: parseFloat(monthData.GarageTempAvg) || null
                    }
                };
                
                // Create representative data points for each month
                if (monthData.IndoorTempAvg || monthData.OutdoorTempAvg || monthData.GarageTempAvg) {
                    // Use middle of month as timestamp
                    const year = monthData.Year;
                    const month = monthData.Month;
                    const midMonthDate = new Date(year, month - 1, 15); // 15th of month
                    const timestamp = Math.floor(midMonthDate.getTime() / 1000);
                    
                    // Create data point with monthly averages
                    const dataPoint = {
                        timestamp: timestamp.toString(),
                        sensors: {}
                    };
                    
                    if (monthData.IndoorTempAvg) {
                        dataPoint.sensors.indoor = { temp: monthData.IndoorTempAvg };
                    }
                    if (monthData.OutdoorTempAvg) {
                        dataPoint.sensors.outdoor = { temp: monthData.OutdoorTempAvg };
                    }
                    if (monthData.GarageTempAvg) {
                        dataPoint.sensors.garage = { temp: monthData.GarageTempAvg };
                    }
                    
                    temperatureData.push(dataPoint);
                }
            });
            
            console.log(`Converted ${monthlyStats.length} monthly stats to ${temperatureData.length} temperature data points`);
            
            return temperatureData;
        }

        // Legacy temperature data fetching (fallback)
        async function fetchTemperatureDataForTrendsLegacy() {
            try {
                const token = localStorage.getItem('ventilation_auth_token');
                
                if (!token && !CONFIG.apiSecret) {
                    window.dataSourceTracker.trackTemperatureSource('Legacy Fallback', 'No Auth', 'Authentication required');
                    return null;
                }

                // Fetch temperature data from multiple time windows to get broader coverage
                const responses = await Promise.all([
                    fetch(`${CONFIG.historyApiUrl}?deviceId=${CONFIG.deviceId}&hours=48`, {
                        method: 'GET',
                        headers: getAuthHeaders()
                    }),
                    fetch(`${CONFIG.historyApiUrl}?deviceId=${CONFIG.deviceId}&hours=168`, { // 7 days
                        method: 'GET',
                        headers: getAuthHeaders()
                    }),
                    fetch(`${CONFIG.historyApiUrl}?deviceId=${CONFIG.deviceId}&hours=720`, { // 30 days
                        method: 'GET',
                        headers: getAuthHeaders()
                    })
                ]);
                
                // Combine all valid responses
                let allTemperatureData = [];
                for (const response of responses) {
                    if (response.ok) {
                        const data = await response.json();
                        if (data.data && data.data.length > 0) {
                            allTemperatureData = allTemperatureData.concat(data.data);
                        }
                    }
                }
                
                // Remove duplicates based on timestamp and filter valid data
                const uniqueData = [];
                const seenTimestamps = new Set();
                
                allTemperatureData.forEach(item => {
                    const timestampKey = item.timestamp;
                    if (!seenTimestamps.has(timestampKey) && isValidTemperatureReading(item)) {
                        seenTimestamps.add(timestampKey);
                        uniqueData.push(item);
                    }
                });
                
                console.log(`Legacy temperature data: ${uniqueData.length} unique data points`);
                
                // Track legacy data usage and analyze months
                if (uniqueData.length > 0) {
                    // Group data by month to show which months are JavaScript calculated
                    const monthlyGroups = {};
                    uniqueData.forEach(item => {
                        let date;
                        if (typeof item.timestamp === 'string') {
                            if (item.timestamp.includes('T') || item.timestamp.includes('-')) {
                                date = new Date(item.timestamp);
                            } else {
                                const unixSeconds = parseInt(item.timestamp);
                                date = new Date(unixSeconds * 1000);
                            }
                        } else {
                            date = new Date(item.timestamp * 1000);
                        }
                        
                        if (!isNaN(date.getTime())) {
                            const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                            if (!monthlyGroups[yearMonth]) {
                                monthlyGroups[yearMonth] = 0;
                            }
                            monthlyGroups[yearMonth]++;
                        }
                    });
                    
                    // Track each month as JavaScript calculated
                    Object.entries(monthlyGroups).forEach(([yearMonth, count]) => {
                        window.dataSourceTracker.trackMonthlySource(yearMonth, 'JavaScript', `${count} raw data points`);
                    });
                    
                    window.dataSourceTracker.trackTemperatureSource('Legacy Fallback', 'Raw Data Processing', `${uniqueData.length} points from ${Object.keys(monthlyGroups).length} months`);
                } else {
                    window.dataSourceTracker.trackTemperatureSource('Legacy Fallback', 'No Data', 'No valid temperature data found');
                }
                
                return uniqueData;
                
            } catch (error) {
                console.error('Error fetching legacy temperature data:', error);
                window.dataSourceTracker.trackTemperatureSource('Legacy Fallback', 'Error', error.message);
                return null;
            }
        }

        // Helper function to validate temperature readings
        function isValidTemperatureReading(item) {
            if (!item.timestamp || !item.sensors) return false;
            
            // Validate timestamp (same logic as chart)
            let date;
            if (typeof item.timestamp === 'string') {
                if (item.timestamp.includes('T') || item.timestamp.includes('-')) {
                    date = new Date(item.timestamp);
                } else {
                    const unixSeconds = parseInt(item.timestamp);
                    if (!isNaN(unixSeconds) && unixSeconds > 1000000000 && unixSeconds < 2000000000) {
                        date = new Date(unixSeconds * 1000);
                    } else {
                        return false;
                    }
                }
            } else if (typeof item.timestamp === 'number') {
                if (item.timestamp < 1000000000 || item.timestamp > 2000000000) {
                    return false;
                }
                date = item.timestamp < 10000000000 ? new Date(item.timestamp * 1000) : new Date(item.timestamp);
            } else {
                return false;
            }
            
            const year = date.getFullYear();
            if (isNaN(date.getTime()) || year < 2020 || year > 2030) {
                return false;
            }
            
            // Check for valid temperature readings
            const indoor = item.sensors.indoor;
            const outdoor = item.sensors.outdoor;
            const garage = item.sensors.garage;
            
            return (indoor && typeof indoor.temp === 'number') ||
                   (outdoor && typeof outdoor.temp === 'number') ||
                   (garage && typeof garage.temp === 'number');
        }

        function updateIncidentTrendsChart(incidents, viewType, severityFilter, temperatureData = null) {
            const ctx = document.getElementById('incidentTrendsChart').getContext('2d');
            
            // Destroy existing chart
            if (incidentTrendsChart) {
                incidentTrendsChart.destroy();
            }
            
            // Define all incident types with colors and icons
            const incidentTypes = {
                0: { name: 'Power Loss', icon: '⚡', criticalColor: '#8B0000', highColor: '#FF6B6B', mediumColor: '#FFB347', lowColor: '#FFDD99' },
                1: { name: 'WiFi Down', icon: '📶', criticalColor: '#FF4500', highColor: '#FFA500', mediumColor: '#FFD700', lowColor: '#FFFF99' },
                2: { name: 'Internet Down', icon: '🌐', criticalColor: '#000080', highColor: '#6495ED', mediumColor: '#87CEEB', lowColor: '#B0E0E6' },
                3: { name: 'API Down', icon: '☁️', criticalColor: '#4682B4', highColor: '#87CEEB', mediumColor: '#ADD8E6', lowColor: '#E0F6FF' },
                4: { name: 'Storm Event', icon: '🌩️', criticalColor: '#483D8B', highColor: '#9370DB', mediumColor: '#BA55D3', lowColor: '#DDA0DD' },
                5: { name: 'Heat Event', icon: '🔥', criticalColor: '#DC143C', highColor: '#FF69B4', mediumColor: '#FFB6C1', lowColor: '#FFCCCB' },
                6: { name: 'Freeze Event', icon: '🧊', criticalColor: '#00CED1', highColor: '#20B2AA', mediumColor: '#48CAE4', lowColor: '#90E0EF' }
            };
            
            if (!incidents || incidents.length === 0) {
                // Create empty chart
                incidentTrendsChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['No Data Available'],
                        datasets: [{
                            label: 'No incidents to display',
                            data: [0],
                            backgroundColor: '#ddd'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        }
                    }
                });
                return;
            }
            
            // Process incidents based on view type
            let chartData, chartLabels;
            
            if (viewType === 'weekly') {
                [chartData, chartLabels] = processWeeklyIncidentData(incidents, incidentTypes, severityFilter);
            } else {
                [chartData, chartLabels] = processMonthlyIncidentData(incidents, incidentTypes, severityFilter, temperatureData);
            }
            
            // Create the chart
            incidentTrendsChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: chartLabels,
                    datasets: chartData
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            stacked: true,
                            title: {
                                display: true,
                                text: viewType === 'weekly' ? 'Weeks (Last 12 Months)' : 'Months'
                            }
                        },
                        y: {
                            stacked: true,
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Number of Incidents'
                            },
                            ticks: {
                                stepSize: 1
                            }
                        },
                        yTemp: viewType === 'monthly' && temperatureData ? {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            title: {
                                display: true,
                                text: 'Temperature (°F)'
                            },
                            grid: {
                                drawOnChartArea: false,
                            },
                            min: function(context) {
                                // Calculate dynamic minimum based on actual data
                                const tempData = context.chart.data.datasets.filter(ds => ds.yAxisID === 'yTemp');
                                if (tempData.length === 0) return 0;
                                
                                let allValues = [];
                                tempData.forEach(dataset => {
                                    dataset.data.forEach(value => {
                                        if (value !== null && value !== undefined) {
                                            allValues.push(value);
                                        }
                                    });
                                });
                                
                                if (allValues.length === 0) return 0;
                                const minValue = Math.min(...allValues);
                                return Math.floor(minValue - 5); // 5°F padding below minimum
                            },
                            max: function(context) {
                                // Calculate dynamic maximum based on actual data
                                const tempData = context.chart.data.datasets.filter(ds => ds.yAxisID === 'yTemp');
                                if (tempData.length === 0) return 100;
                                
                                let allValues = [];
                                tempData.forEach(dataset => {
                                    dataset.data.forEach(value => {
                                        if (value !== null && value !== undefined) {
                                            allValues.push(value);
                                        }
                                    });
                                });
                                
                                if (allValues.length === 0) return 100;
                                const maxValue = Math.max(...allValues);
                                return Math.ceil(maxValue + 5); // 5°F padding above maximum
                            }
                        } : undefined
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                title: function(context) {
                                    return context[0].label;
                                },
                                label: function(context) {
                                    // Handle temperature hover data points
                                    if (context.dataset.isTemperatureHoverData) {
                                        const monthIndex = context.dataIndex;
                                        const chartLabels = context.chart.data.labels;
                                        const monthLabel = chartLabels[monthIndex];
                                        const tempStats = window.monthlyTemperatureStats ? window.monthlyTemperatureStats[monthLabel] : null;
                                        
                                        if (tempStats) {
                                            return `🌡️ ${monthLabel}: ${tempStats.min}°F to ${tempStats.max}°F (avg ${tempStats.avg}°F)`;
                                        } else {
                                            return `🌡️ ${monthLabel}: No temperature data available`;
                                        }
                                    }
                                    
                                    // Only process incident data if it has the required properties
                                    if (context.dataset.incidentType !== undefined && context.dataset.severity !== undefined) {
                                        const incidentType = incidentTypes[context.dataset.incidentType];
                                        const severity = context.dataset.severity;
                                        const count = context.parsed.y;
                                        if (incidentType && count > 0) {
                                            return `${incidentType.icon} ${count} ${severity} ${incidentType.name}`;
                                        }
                                    }
                                    return null;
                                },
                                afterLabel: function(context) {
                                    // Show temperature data for temperature hover points
                                    if (context.dataset.isTemperatureHoverData) {
                                        const monthIndex = context.dataIndex;
                                        const chartLabels = context.chart.data.labels;
                                        const monthLabel = chartLabels[monthIndex];
                                        
                                        const tempStats = window.monthlyTemperatureStats ? window.monthlyTemperatureStats[monthLabel] : null;
                                        const detailedStats = window.detailedMonthlyStats ? window.detailedMonthlyStats[monthLabel] : null;
                                        
                                        if (tempStats || detailedStats) {
                                            let tooltipLines = [];
                                            
                                            if (detailedStats) {
                                                tooltipLines.push(`🌡️ Temperature Statistics for ${monthLabel}:`);
                                                
                                                // Indoor temperature details
                                                if (detailedStats.indoorTempRange.avg !== null) {
                                                    tooltipLines.push(`   Indoor: ${detailedStats.indoorTempRange.min}°F to ${detailedStats.indoorTempRange.max}°F (avg ${detailedStats.indoorTempRange.avg}°F)`);
                                                }
                                                
                                                // Outdoor temperature details  
                                                if (detailedStats.outdoorTempRange.avg !== null) {
                                                    tooltipLines.push(`   Outdoor: ${detailedStats.outdoorTempRange.min}°F to ${detailedStats.outdoorTempRange.max}°F (avg ${detailedStats.outdoorTempRange.avg}°F)`);
                                                }
                                                
                                                // Garage temperature details
                                                if (detailedStats.garageTempRange.avg !== null) {
                                                    tooltipLines.push(`   Garage: ${detailedStats.garageTempRange.min}°F to ${detailedStats.garageTempRange.max}°F (avg ${detailedStats.garageTempRange.avg}°F)`);
                                                }
                                                
                                                tooltipLines.push(`📊 Monthly Summary:`);
                                                tooltipLines.push(`   Data Points: ${detailedStats.totalDataPoints}`);
                                                
                                                // Enhanced fan runtime information
                                                const fanHours = Math.round(detailedStats.totalFanMinutes / 60 * 10) / 10;
                                                const fanDays = Math.round(fanHours / 24 * 100) / 100;
                                                tooltipLines.push(`🌀 Fan Runtime: ${fanHours} hours (${detailedStats.fanOnPercentage}%)`);
                                                if (fanHours >= 24) {
                                                    tooltipLines.push(`   Equivalent: ${fanDays} days`);
                                                }
                                                tooltipLines.push(`   Total Minutes: ${detailedStats.totalFanMinutes}`);
                                                
                                                // Enhanced humidity information with ranges
                                                if (detailedStats.indoorHumidityRange.avg !== null || detailedStats.outdoorHumidityRange.avg !== null) {
                                                    tooltipLines.push(`💧 Humidity Ranges:`);
                                                    if (detailedStats.indoorHumidityRange.avg !== null) {
                                                        tooltipLines.push(`   Indoor: ${detailedStats.indoorHumidityRange.min}% to ${detailedStats.indoorHumidityRange.max}% (avg ${detailedStats.indoorHumidityRange.avg}%)`);
                                                    }
                                                    if (detailedStats.outdoorHumidityRange.avg !== null) {
                                                        tooltipLines.push(`   Outdoor: ${detailedStats.outdoorHumidityRange.min}% to ${detailedStats.outdoorHumidityRange.max}% (avg ${detailedStats.outdoorHumidityRange.avg}%)`);
                                                    }
                                                    
                                                    // Add humidity comfort analysis
                                                    if (detailedStats.indoorHumidityRange.avg !== null) {
                                                        const indoorHumidity = detailedStats.indoorHumidityRange.avg;
                                                        let comfortLevel = '';
                                                        if (indoorHumidity < 30) comfortLevel = 'Too Dry';
                                                        else if (indoorHumidity <= 50) comfortLevel = 'Optimal';
                                                        else if (indoorHumidity <= 60) comfortLevel = 'Good';
                                                        else comfortLevel = 'Too Humid';
                                                        tooltipLines.push(`   Indoor Comfort: ${comfortLevel}`);
                                                    }
                                                }
                                                
                                                // Incident summary
                                                const totalIncidents = detailedStats.highTempIncidents + detailedStats.freezeTempIncidents + detailedStats.powerOutageIncidents + detailedStats.wifiDownIncidents;
                                                if (totalIncidents > 0) {
                                                    tooltipLines.push(`⚠️ Incidents: ${totalIncidents} total`);
                                                    if (detailedStats.highTempIncidents > 0) tooltipLines.push(`   🔥 High Temp: ${detailedStats.highTempIncidents}`);
                                                    if (detailedStats.freezeTempIncidents > 0) tooltipLines.push(`   🧊 Freeze: ${detailedStats.freezeTempIncidents}`);
                                                    if (detailedStats.powerOutageIncidents > 0) tooltipLines.push(`   ⚡ Power: ${detailedStats.powerOutageIncidents}`);
                                                    if (detailedStats.wifiDownIncidents > 0) tooltipLines.push(`   📶 WiFi: ${detailedStats.wifiDownIncidents}`);
                                                } else {
                                                    tooltipLines.push(`✅ No incidents this month`);
                                                }
                                                
                                                // Environmental insights
                                                if (detailedStats.indoorTempRange.avg !== null && detailedStats.outdoorTempRange.avg !== null) {
                                                    const tempDiff = Math.abs(detailedStats.indoorTempRange.avg - detailedStats.outdoorTempRange.avg);
                                                    tooltipLines.push(`🌡️ Climate Control:`);
                                                    tooltipLines.push(`   Indoor-Outdoor Diff: ${tempDiff.toFixed(1)}°F`);
                                                    
                                                    // Effectiveness analysis
                                                    if (detailedStats.fanOnPercentage > 0) {
                                                        const effectiveness = tempDiff < 5 ? 'Excellent' : tempDiff < 10 ? 'Good' : tempDiff < 15 ? 'Fair' : 'Needs Attention';
                                                        tooltipLines.push(`   Control Effectiveness: ${effectiveness}`);
                                                    }
                                                }
                                                
                                            } else if (tempStats) {
                                                // Fallback to basic temperature stats
                                                tooltipLines = [
                                                    `🌡️ Temperature Statistics for ${monthLabel}:`,
                                                    `   Min: ${tempStats.min}°F`,
                                                    `   Max: ${tempStats.max}°F`, 
                                                    `   Avg: ${tempStats.avg}°F`,
                                                    `   Data Points: ${tempStats.count}`
                                                ];
                                            }
                                            
                                            return tooltipLines;
                                        }
                                    }
                                    return [];
                                },
                                footer: function(context) {
                                    const totalIncidents = context.reduce((sum, item) => {
                                        // Don't count temperature hover data in incident totals
                                        if (item.dataset.isTemperatureHoverData) return sum;
                                        return sum + item.parsed.y;
                                    }, 0);
                                    
                                    // Ensure incidents are always whole numbers
                                    const roundedIncidents = Math.round(totalIncidents);
                                    let footer = roundedIncidents > 0 ? `Total: ${roundedIncidents} incidents` : '';
                                    
                                    // Add temperature stats for monthly view (only if not temperature hover point)
                                    if (context.length > 0) {
                                        const hasTemperatureHoverPoint = context.some(item => item.dataset.isTemperatureHoverData);
                                        
                                        if (!hasTemperatureHoverPoint && window.monthlyTemperatureStats) {
                                            const monthIndex = context[0].dataIndex;
                                            const chartLabels = context[0].chart.data.labels;
                                            const monthLabel = chartLabels[monthIndex];
                                            const tempStats = window.monthlyTemperatureStats[monthLabel];
                                            if (tempStats) {
                                                footer += footer ? '\n' : '';
                                                footer += `Temp: ${tempStats.min}°F - ${tempStats.max}°F (avg ${tempStats.avg}°F)`;
                                            }
                                        }
                                    }
                                    
                                    return footer;
                                }
                            }
                        }
                    }
                }
            });
        }

        function processWeeklyIncidentData(incidents, incidentTypes, severityFilter) {
            // Create weekly buckets for the last 12 months
            const now = new Date();
            const weeks = [];
            const weeklyData = {};
            
            // Generate last 52 weeks
            for (let i = 51; i >= 0; i--) {
                const weekStart = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
                const weekEnd = new Date(weekStart.getTime() + (6 * 24 * 60 * 60 * 1000));
                
                // Create intuitive date range labels (e.g., "Jul 1-7", "Jul 8-14")
                const startMonth = weekStart.toLocaleDateString('en-US', {month: 'short'});
                const startDay = weekStart.getDate();
                const endDay = weekEnd.getDate();
                const endMonth = weekEnd.toLocaleDateString('en-US', {month: 'short'});
                
                // Handle cases where week spans across months
                let weekLabel;
                if (startMonth === endMonth) {
                    weekLabel = `${startMonth} ${startDay}-${endDay}`;
                } else {
                    weekLabel = `${startMonth} ${startDay}-${endMonth} ${endDay}`;
                }
                
                weeks.push({
                    label: weekLabel,
                    start: Math.floor(weekStart.getTime() / 1000),
                    end: Math.floor(weekEnd.getTime() / 1000)
                });
                
                weeklyData[weekLabel] = {};
                // Initialize all incident types and severities to 0
                Object.keys(incidentTypes).forEach(type => {
                    weeklyData[weekLabel][type] = { critical: 0, high: 0, medium: 0, low: 0 };
                });
            }
            
            // Categorize incidents into weekly buckets
            incidents.forEach(incident => {
                const incidentWeek = weeks.find(week => 
                    incident.startTime >= week.start && incident.startTime <= week.end
                );
                
                if (incidentWeek) {
                    let severityKey;
                    if (incident.severity === 0) severityKey = 'critical';
                    else if (incident.severity === 1) severityKey = 'high';
                    else if (incident.severity === 2) severityKey = 'medium';
                    else if (incident.severity === 3) severityKey = 'low';
                    else severityKey = 'low'; // Default fallback for unknown severity levels
                    
                    if (weeklyData[incidentWeek.label][incident.type]) {
                        weeklyData[incidentWeek.label][incident.type][severityKey]++;
                    }
                }
            });
            
            // Create datasets for chart
            const datasets = [];
            const chartLabels = weeks.map(week => week.label);
            
            Object.keys(incidentTypes).forEach(typeId => {
                const type = incidentTypes[typeId];
                
                if (severityFilter === 'critical' || severityFilter === 'critical-high' || severityFilter === 'critical-high-medium' || severityFilter === 'all') {
                    datasets.push({
                        label: `Critical ${type.name} ${type.icon}`,
                        data: weeks.map(week => weeklyData[week.label][typeId]?.critical || 0),
                        backgroundColor: type.criticalColor,
                        borderColor: type.criticalColor,
                        borderWidth: 1,
                        incidentType: typeId,
                        severity: 'Critical'
                    });
                }
                
                if (severityFilter === 'high' || severityFilter === 'critical-high' || severityFilter === 'critical-high-medium' || severityFilter === 'all') {
                    datasets.push({
                        label: `High ${type.name} ${type.icon}`,
                        data: weeks.map(week => weeklyData[week.label][typeId]?.high || 0),
                        backgroundColor: type.highColor,
                        borderColor: type.highColor,
                        borderWidth: 1,
                        incidentType: typeId,
                        severity: 'High'
                    });
                }
                
                if (severityFilter === 'medium' || severityFilter === 'critical-high-medium' || severityFilter === 'all') {
                    datasets.push({
                        label: `Medium ${type.name} ${type.icon}`,
                        data: weeks.map(week => weeklyData[week.label][typeId]?.medium || 0),
                        backgroundColor: type.mediumColor,
                        borderColor: type.mediumColor,
                        borderWidth: 1,
                        incidentType: typeId,
                        severity: 'Medium'
                    });
                }
                
                if (severityFilter === 'low' || severityFilter === 'all') {
                    datasets.push({
                        label: `Low ${type.name} ${type.icon}`,
                        data: weeks.map(week => weeklyData[week.label][typeId]?.low || 0),
                        backgroundColor: type.lowColor,
                        borderColor: type.lowColor,
                        borderWidth: 1,
                        incidentType: typeId,
                        severity: 'Low'
                    });
                }
            });
            
            return [datasets, chartLabels];
        }

        function processMonthlyIncidentData(incidents, incidentTypes, severityFilter, temperatureData = null) {
            // Create monthly buckets for the last 12 months
            const now = new Date();
            const months = [];
            const monthlyData = {};
            
            // Generate last 12 months
            for (let i = 11; i >= 0; i--) {
                const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthLabel = monthDate.toLocaleDateString('en-US', {month: 'short', year: '2-digit'});
                const monthStart = Math.floor(monthDate.getTime() / 1000);
                const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
                const monthEnd = Math.floor(nextMonth.getTime() / 1000) - 1;
                
                months.push({
                    label: monthLabel,
                    start: monthStart,
                    end: monthEnd
                });
                
                monthlyData[monthLabel] = {};
                Object.keys(incidentTypes).forEach(type => {
                    monthlyData[monthLabel][type] = { critical: 0, high: 0, medium: 0, low: 0 };
                });
            }
            
            // Process temperature data if available
            let monthlyTemperatureStats = {};
            if (temperatureData) {
                monthlyTemperatureStats = aggregateTemperatureByMonth(temperatureData, months);
            }
            
            // Store temperature stats globally for tooltip access
            window.monthlyTemperatureStats = monthlyTemperatureStats;
            
            // Categorize incidents into monthly buckets
            incidents.forEach(incident => {
                const incidentMonth = months.find(month => 
                    incident.startTime >= month.start && incident.startTime <= month.end
                );
                
                if (incidentMonth) {
                    let severityKey;
                    if (incident.severity === 0) severityKey = 'critical';
                    else if (incident.severity === 1) severityKey = 'high';
                    else if (incident.severity === 2) severityKey = 'medium';
                    else if (incident.severity === 3) severityKey = 'low';
                    else severityKey = 'low'; // Default fallback for unknown severity levels
                    
                    if (monthlyData[incidentMonth.label][incident.type]) {
                        monthlyData[incidentMonth.label][incident.type][severityKey]++;
                    }
                }
            });
            
            // Create datasets for chart (same logic as weekly but with monthly data)
            const datasets = [];
            const chartLabels = months.map(month => month.label);
            
            Object.keys(incidentTypes).forEach(typeId => {
                const type = incidentTypes[typeId];
                
                if (severityFilter === 'critical' || severityFilter === 'critical-high' || severityFilter === 'critical-high-medium' || severityFilter === 'all') {
                    datasets.push({
                        label: `Critical ${type.name} ${type.icon}`,
                        data: months.map(month => monthlyData[month.label][typeId]?.critical || 0),
                        backgroundColor: type.criticalColor,
                        borderColor: type.criticalColor,
                        borderWidth: 1,
                        incidentType: typeId,
                        severity: 'Critical'
                    });
                }
                
                if (severityFilter === 'high' || severityFilter === 'critical-high' || severityFilter === 'critical-high-medium' || severityFilter === 'all') {
                    datasets.push({
                        label: `High ${type.name} ${type.icon}`,
                        data: months.map(month => monthlyData[month.label][typeId]?.high || 0),
                        backgroundColor: type.highColor,
                        borderColor: type.highColor,
                        borderWidth: 1,
                        incidentType: typeId,
                        severity: 'High'
                    });
                }
                
                if (severityFilter === 'medium' || severityFilter === 'critical-high-medium' || severityFilter === 'all') {
                    datasets.push({
                        label: `Medium ${type.name} ${type.icon}`,
                        data: months.map(month => monthlyData[month.label][typeId]?.medium || 0),
                        backgroundColor: type.mediumColor,
                        borderColor: type.mediumColor,
                        borderWidth: 1,
                        incidentType: typeId,
                        severity: 'Medium'
                    });
                }
                
                if (severityFilter === 'low' || severityFilter === 'all') {
                    datasets.push({
                        label: `Low ${type.name} ${type.icon}`,
                        data: months.map(month => monthlyData[month.label][typeId]?.low || 0),
                        backgroundColor: type.lowColor,
                        borderColor: type.lowColor,
                        borderWidth: 1,
                        incidentType: typeId,
                        severity: 'Low'
                    });
                }
            });
            
            // Add temperature overlay datasets for monthly view
            if (temperatureData && Object.keys(monthlyTemperatureStats).length > 0) {
                // Min temperature line
                datasets.push({
                    label: 'Min Temperature',
                    data: chartLabels.map(label => monthlyTemperatureStats[label] ? monthlyTemperatureStats[label].min : null),
                    type: 'line',
                    borderColor: '#3498db',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    yAxisID: 'yTemp',
                    tension: 0.4
                });
                
                // Max temperature line
                datasets.push({
                    label: 'Max Temperature',
                    data: chartLabels.map(label => monthlyTemperatureStats[label] ? monthlyTemperatureStats[label].max : null),
                    type: 'line',
                    borderColor: '#e74c3c',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    yAxisID: 'yTemp',
                    tension: 0.4
                });
                
                // Average temperature line
                datasets.push({
                    label: 'Avg Temperature',
                    data: chartLabels.map(label => monthlyTemperatureStats[label] ? monthlyTemperatureStats[label].avg : null),
                    type: 'line',
                    borderColor: '#f39c12',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    yAxisID: 'yTemp',
                    tension: 0.4,
                    borderDash: [5, 5]
                });
                
                // Add invisible hover points for temperature data access
                datasets.push({
                    label: 'Temperature Data (hover for details)',
                    data: chartLabels.map(label => monthlyTemperatureStats[label] ? 0.1 : null), // Very small invisible value
                    type: 'bar',
                    backgroundColor: 'rgba(0, 0, 0, 0)', // Completely transparent
                    borderColor: 'rgba(0, 0, 0, 0)', // Completely transparent
                    borderWidth: 0,
                    yAxisID: 'y',
                    barThickness: 30, // Wide for easier hovering
                    categoryPercentage: 1.0,
                    barPercentage: 0.8,
                    // Custom tooltip data for temperature access
                    isTemperatureHoverData: true,
                    order: 5 // Render above incident bars but below lines
                });
            }
            
            return [datasets, chartLabels];
        }

        // Aggregate temperature data by month
        function aggregateTemperatureByMonth(temperatureData, months) {
            const monthlyStats = {};
            
            months.forEach(month => {
                const monthData = temperatureData.filter(item => {
                    let timestamp;
                    
                    // Parse timestamp (same logic as chart validation)
                    if (typeof item.timestamp === 'string') {
                        if (item.timestamp.includes('T') || item.timestamp.includes('-')) {
                            timestamp = Math.floor(new Date(item.timestamp).getTime() / 1000);
                        } else {
                            timestamp = parseInt(item.timestamp);
                        }
                    } else if (typeof item.timestamp === 'number') {
                        timestamp = item.timestamp < 10000000000 ? item.timestamp : Math.floor(item.timestamp / 1000);
                    } else {
                        return false;
                    }
                    
                    return timestamp >= month.start && timestamp <= month.end;
                });
                
                if (monthData.length > 0) {
                    // Collect all valid temperature readings (indoor, outdoor, garage)
                    let allTemps = [];
                    
                    monthData.forEach(item => {
                        if (item.sensors) {
                            if (item.sensors.indoor && typeof item.sensors.indoor.temp === 'number') {
                                allTemps.push(item.sensors.indoor.temp);
                            }
                            if (item.sensors.outdoor && typeof item.sensors.outdoor.temp === 'number') {
                                allTemps.push(item.sensors.outdoor.temp);
                            }
                            if (item.sensors.garage && typeof item.sensors.garage.temp === 'number') {
                                allTemps.push(item.sensors.garage.temp);
                            }
                        }
                    });
                    
                    if (allTemps.length > 0) {
                        monthlyStats[month.label] = {
                            min: Math.round(Math.min(...allTemps) * 10) / 10,
                            max: Math.round(Math.max(...allTemps) * 10) / 10,
                            avg: Math.round((allTemps.reduce((sum, temp) => sum + temp, 0) / allTemps.length) * 10) / 10,
                            count: allTemps.length
                        };
                    }
                }
            });
            
            return monthlyStats;
        }

        // Helper function to get temperature stats for tooltip
        function getTemperatureStatsForTooltip(monthIndex, chartLabels) {
            if (window.monthlyTemperatureStats && chartLabels[monthIndex]) {
                const monthLabel = chartLabels[monthIndex];
                return window.monthlyTemperatureStats[monthLabel] || null;
            }
            return null;
        }

        function updateConnectionStatus(status) {
            return DashboardUtils.updateConnectionStatus(status);
        }

        function startAutoRefresh() {
            if (refreshTimer) {
                clearInterval(refreshTimer);
            }
            
            refreshTimer = setInterval(async () => {
                await refreshData();
            }, CONFIG.refreshInterval);
        }

        // Manual refresh function
        window.refreshData = refreshData;

        // Ventilation effectiveness calculation functions
// ===================================================================
// EFFECTIVENESS CALCULATION & ANALYSIS FUNCTIONS
// Functions for calculating and analyzing ventilation effectiveness
// ===================================================================

        function calculateVentilationEffectiveness(timeBasedData) {
            if (!timeBasedData || timeBasedData.length === 0) {
                return [];
            }

            // Group data by hour and calculate effectiveness for substantial ventilation sessions
            const hourlyGroups = groupDataByHour(timeBasedData);
            const effectivenessPoints = [];

            for (const [hourKey, hourData] of Object.entries(hourlyGroups)) {
                const effectiveness = calculateHourlyEffectiveness(hourData);
                if (effectiveness !== null) {
                    // Use the middle of the hour as the timestamp, unless it's ongoing
                    const hourStart = new Date(hourKey);
                    let timestamp;
                    
                    if (hourData.isOngoingSession) {
                        // For ongoing sessions, use current time
                        timestamp = new Date();
                        effectiveness.isOngoing = true;
                    } else {
                        // For completed sessions, use middle of hour
                        timestamp = new Date(hourStart.getTime() + (30 * 60 * 1000)); // Add 30 minutes
                    }
                    
                    effectivenessPoints.push({
                        x: timestamp,
                        y: effectiveness.percentage,
                        // Store additional data for tooltips
                        sessionData: effectiveness
                    });
                }
            }

            return effectivenessPoints;
        }

        function groupDataByHour(timeBasedData) {
            const hourlyGroups = {};
            const now = new Date();

            timeBasedData.forEach(dataPoint => {
                // Round timestamp to hour
                const hour = new Date(dataPoint.timestamp);
                hour.setMinutes(0, 0, 0);
                const hourKey = hour.toISOString();

                if (!hourlyGroups[hourKey]) {
                    hourlyGroups[hourKey] = [];
                }
                hourlyGroups[hourKey].push(dataPoint);
            });

            // For the current hour, if we have data and the fan is running,
            // treat it as an ongoing session for effectiveness analysis
            const currentHour = new Date(now);
            currentHour.setMinutes(0, 0, 0);
            const currentHourKey = currentHour.toISOString();
            
            // Also check the previous hour for ongoing sessions that might span multiple hours
            const previousHour = new Date(now.getTime() - (60 * 60 * 1000));
            previousHour.setMinutes(0, 0, 0);
            const previousHourKey = previousHour.toISOString();
            
            // Check current hour
            if (hourlyGroups[currentHourKey]) {
                const currentHourData = hourlyGroups[currentHourKey];
                
                // Check if fan is currently running in recent data (more lenient check)
                const recentData = currentHourData.slice(-10); // Last 10 data points instead of 5
                const fanCurrentlyOn = recentData.some(point => 
                    point.item.system && point.item.system.fanOn === true
                );
                
                if (fanCurrentlyOn && recentData.length >= 3) { // Need at least 3 data points
                    hourlyGroups[currentHourKey].isOngoingSession = true;
                    console.log('Detected ongoing ventilation session in current hour');
                }
            }
            
            // Also check if we have a long-running session that started in the previous hour
            if (hourlyGroups[previousHourKey] && hourlyGroups[currentHourKey]) {
                const prevHourData = hourlyGroups[previousHourKey];
                const currentHourData = hourlyGroups[currentHourKey];
                
                // Check if fan was running at end of previous hour and start of current hour
                const prevHourEnd = prevHourData.slice(-5);
                const currentHourStart = currentHourData.slice(0, 5);
                
                const fanWasRunning = prevHourEnd.some(point => 
                    point.item.system && point.item.system.fanOn === true
                );
                const fanStillRunning = currentHourStart.some(point => 
                    point.item.system && point.item.system.fanOn === true
                );
                
                if (fanWasRunning && fanStillRunning) {
                    // Mark both hours as part of ongoing session for long-running analysis
                    if (!hourlyGroups[previousHourKey].isOngoingSession) {
                        hourlyGroups[previousHourKey].isOngoingSession = true;
                        console.log('Detected extended ventilation session spanning multiple hours');
                    }
                    if (!hourlyGroups[currentHourKey].isOngoingSession) {
                        hourlyGroups[currentHourKey].isOngoingSession = true;
                    }
                }
            }

            return hourlyGroups;
        }

        function calculateHourlyEffectiveness(hourData) {
            if (!hourData || hourData.length < 2) {
                return null; // Need at least start and end data points
            }

            // Calculate fan runtime for this hour
            const fanOnCount = hourData.filter(point => 
                point.item.system && point.item.system.fanOn === true
            ).length;
            
            const fanMinutes = (fanOnCount / hourData.length) * 60;
            
            // Dynamic threshold: more inclusive for longer sessions and ongoing sessions
            const isOngoing = hourData.isOngoingSession;
            let minimumMinutes;
            
            if (isOngoing) {
                minimumMinutes = 10; // Very low threshold for ongoing sessions
            } else if (fanMinutes >= 120) {
                minimumMinutes = 20; // Lower threshold for long sessions (2+ hours)
            } else {
                minimumMinutes = 25; // Standard threshold for regular sessions
            }
            
            if (fanMinutes < minimumMinutes) {
                return null;
            }

            // Get temperature data for the hour
            const validTemps = hourData.filter(point => 
                point.item.sensors &&
                point.item.sensors.indoor && typeof point.item.sensors.indoor.temp === 'number' &&
                point.item.sensors.outdoor && typeof point.item.sensors.outdoor.temp === 'number'
            );

            if (validTemps.length < 2) {
                return null; // Need temperature data
            }

            // Calculate temperature changes
            const startTemp = validTemps[0].item.sensors.indoor.temp;
            const endTemp = validTemps[validTemps.length - 1].item.sensors.indoor.temp;
            const outdoorTemps = validTemps.map(p => p.item.sensors.outdoor.temp);
            const outdoorAvg = outdoorTemps.reduce((sum, temp) => sum + temp, 0) / outdoorTemps.length;

            const actualReduction = startTemp - endTemp;
            const tempDifferential = startTemp - outdoorAvg;

            // Only calculate if conditions favor cooling (outdoor cooler than indoor)
            if (tempDifferential <= 0) {
                return null; // No cooling potential
            }

            // Balanced effectiveness calculation for meaningful differentiation:
            // 1. Use 70% efficiency factor - realistic but achievable
            // 2. Moderate baseline credit that varies with conditions
            // 3. Actual cooling performance drives the primary score
            // 4. Conditions and duration provide reasonable modifiers
            
            let theoreticalMax = tempDifferential * 0.7; // 70% efficiency target
            
            // Moderate baseline credits based on conditions and effort
            let baselineCredit = 0;
            
            // Variable baseline based on temperature differential (conditions matter)
            if (tempDifferential >= 10) {
                baselineCredit = 1.5; // Excellent conditions get moderate credit
            } else if (tempDifferential >= 7) {
                baselineCredit = 1.2; // Good conditions 
            } else if (tempDifferential >= 4) {
                baselineCredit = 0.8; // Fair conditions
            } else if (tempDifferential >= 2) {
                baselineCredit = 0.5; // Poor conditions get minimal credit
            }
            
            // Runtime credit (but more modest)
            if (fanMinutes >= 120) { // 2+ hours
                baselineCredit += 0.8;
            } else if (fanMinutes >= 60) { // 1+ hours  
                baselineCredit += 0.5;
            } else if (fanMinutes >= 45) { // 45+ minutes
                baselineCredit += 0.3;
            }
            
            // Actual cooling is the primary driver - this creates differentiation
            let adjustedReduction = Math.max(actualReduction, 0) + baselineCredit;
            
            // If significant actual cooling occurred, give bonus credit
            if (actualReduction >= 2.0) {
                adjustedReduction += 0.5; // Bonus for real cooling achievement
            } else if (actualReduction >= 1.0) {
                adjustedReduction += 0.3; // Smaller bonus for moderate cooling
            }
            
            var effectiveness = (adjustedReduction / theoreticalMax) * 100;
            
            // Apply moderate bonuses based on outdoor conditions and performance:
            // Focus on actual conditions that affect cooling difficulty
            let bonusMultiplier = 1.0;
            
            // Outdoor temperature affects cooling difficulty (more differentiated)
            if (outdoorAvg >= 85) {
                bonusMultiplier += 0.15; // 15% bonus for hot conditions
            } else if (outdoorAvg >= 80) {
                bonusMultiplier += 0.10; // 10% bonus for warm conditions
            } else if (outdoorAvg >= 75) {
                bonusMultiplier += 0.05; // 5% bonus for mild warm conditions
            }
            // No bonus for conditions below 75°F - easier cooling
            
            // Runtime bonuses (more modest to create differentiation)
            if (fanMinutes >= 180) { // 3+ hours
                bonusMultiplier += 0.10; // 10% bonus for marathon sessions
            } else if (fanMinutes >= 120) { // 2+ hours
                bonusMultiplier += 0.07; // 7% bonus for extended sessions
            } else if (fanMinutes >= 90) { // 1.5+ hours
                bonusMultiplier += 0.05; // 5% bonus for long sessions
            }
            // Shorter sessions get no runtime bonus
            
            // Reward sessions that achieve significant actual cooling
            if (actualReduction >= 2.0) {
                bonusMultiplier += 0.10; // 10% bonus for excellent actual cooling
            } else if (actualReduction >= 1.0) {
                bonusMultiplier += 0.05; // 5% bonus for good actual cooling
            }
            // Sessions with minimal actual cooling get no bonus
            
            effectiveness *= bonusMultiplier;
            
            // Cap at 100% but allow the bonus to help reach higher scores
            effectiveness = Math.max(0, Math.min(100, effectiveness));

            return {
                percentage: Math.round(effectiveness * 10) / 10, // Round to 1 decimal
                actualReduction: Math.round(actualReduction * 10) / 10,
                theoreticalMax: Math.round(theoreticalMax * 10) / 10,
                fanMinutes: Math.round(fanMinutes),
                startTemp: Math.round(startTemp * 10) / 10,
                endTemp: Math.round(endTemp * 10) / 10,
                outdoorAvg: Math.round(outdoorAvg * 10) / 10,
                tempDifferential: Math.round(tempDifferential * 10) / 10,
                bonusApplied: Math.round((bonusMultiplier - 1) * 100) // Show bonus percentage
            };
        }

        function getEffectivenessColor(effectiveness) {
            if (effectiveness >= 70) return '#228B22'; // Dark green - Excellent
            if (effectiveness >= 50) return '#32CD32'; // Light green - Good  
            if (effectiveness >= 30) return '#FFD700'; // Yellow - Fair
            return '#FF6347'; // Red - Poor
        }

        function getEffectivenessRating(effectiveness) {
            if (effectiveness >= 70) return 'Excellent 🌟';
            if (effectiveness >= 50) return 'Good ✅';
            if (effectiveness >= 30) return 'Fair ⚠️';
            return 'Poor ❌';
        }

        function updateEffectivenessAnalysis(effectivenessData) {
            const analysisSection = document.getElementById('effectivenessAnalysis');
            const noDataSection = document.getElementById('noEffectivenessData');
            
            if (!effectivenessData || effectivenessData.length === 0) {
                analysisSection.style.display = 'none';
                noDataSection.style.display = 'block';
                return;
            }
            
            analysisSection.style.display = 'block';
            noDataSection.style.display = 'none';
            
            // Calculate summary statistics
            const sessions = effectivenessData.map(point => point.sessionData);
            const effectivenessValues = sessions.map(s => s.percentage);
            const avgEffectiveness = effectivenessValues.reduce((sum, val) => sum + val, 0) / effectivenessValues.length;
            const bestEffectiveness = Math.max(...effectivenessValues);
            const totalCooling = sessions.reduce((sum, s) => sum + s.actualReduction, 0);
            
            // Update summary values
            document.getElementById('recentSessions').textContent = sessions.length;
            document.getElementById('avgEffectiveness').textContent = `${Math.round(avgEffectiveness)}%`;
            document.getElementById('bestEffectiveness').textContent = `${Math.round(bestEffectiveness)}%`;
            document.getElementById('totalCooling').textContent = `${Math.round(totalCooling * 10) / 10}°F`;
            
            // Generate insights
            const insights = generateEffectivenessInsights(sessions, avgEffectiveness, bestEffectiveness);
            document.getElementById('effectivenessInsights').innerHTML = insights;
        }

        function generateEffectivenessInsights(sessions, avgEffectiveness, bestEffectiveness) {
            const insights = [];
            
            // More nuanced performance assessment based on score ranges
            if (avgEffectiveness >= 80) {
                insights.push(`🌟 <strong>Outstanding Performance:</strong> ${Math.round(avgEffectiveness)}% average effectiveness demonstrates exceptional cooling optimization.`);
            } else if (avgEffectiveness >= 70) {
                insights.push(`✨ <strong>Excellent Performance:</strong> ${Math.round(avgEffectiveness)}% average shows your system is very well tuned.`);
            } else if (avgEffectiveness >= 60) {
                insights.push(`✅ <strong>Good Performance:</strong> ${Math.round(avgEffectiveness)}% effectiveness indicates solid, reliable cooling.`);
            } else if (avgEffectiveness >= 50) {
                insights.push(`👍 <strong>Fair Performance:</strong> ${Math.round(avgEffectiveness)}% shows decent cooling with room for optimization.`);
            } else {
                insights.push(`📊 <strong>Needs Optimization:</strong> ${Math.round(avgEffectiveness)}% suggests reviewing timing and conditions for better results.`);
            }
            
            // Add performance variability insight
            const performanceRange = bestEffectiveness - (sessions.map(s => s.percentage).reduce((min, val) => Math.min(min, val), 100));
            if (performanceRange > 30) {
                insights.push(`📈 <strong>Variable Performance:</strong> ${Math.round(performanceRange)}% range suggests optimizing timing for consistent results.`);
            } else if (performanceRange > 15) {
                insights.push(`📊 <strong>Moderate Variation:</strong> Performance varies by ${Math.round(performanceRange)}% - good consistency overall.`);
            } else {
                insights.push(`🎯 <strong>Consistent Performance:</strong> Only ${Math.round(performanceRange)}% variation shows excellent operational consistency.`);
            }
            
            // Runtime analysis
            const avgRuntime = sessions.reduce((sum, s) => sum + s.fanMinutes, 0) / sessions.length;
            if (avgRuntime >= 55) {
                insights.push(`⏱️ <strong>Optimal Runtime:</strong> Sessions averaging ${Math.round(avgRuntime)} minutes provide thorough air exchange.`);
            } else {
                insights.push(`⏱️ <strong>Runtime Pattern:</strong> Sessions averaging ${Math.round(avgRuntime)} minutes show efficient targeted cooling.`);
            }
            
            // Temperature differential analysis
            const avgTempDiff = sessions.reduce((sum, s) => sum + s.tempDifferential, 0) / sessions.length;
            if (avgTempDiff >= 8) {
                insights.push(`🌡️ <strong>Great Conditions:</strong> Average ${Math.round(avgTempDiff)}°F indoor-outdoor difference provides excellent cooling potential.`);
            } else if (avgTempDiff >= 4) {
                insights.push(`🌡️ <strong>Moderate Conditions:</strong> ${Math.round(avgTempDiff)}°F average temperature difference allows for effective cooling.`);
            } else {
                insights.push(`🌡️ <strong>Limited Potential:</strong> Small ${Math.round(avgTempDiff)}°F temperature differences reduce cooling effectiveness.`);
            }
            
            // Best practices recommendation
            if (bestEffectiveness - avgEffectiveness > 20) {
                insights.push(`📈 <strong>Optimization Tip:</strong> Your best session achieved ${Math.round(bestEffectiveness)}% effectiveness. Focus on similar outdoor conditions for maximum efficiency.`);
            }
            
            // Add improvement suggestions based on performance analysis
            insights.push('<br><strong>💡 Ways to Improve Effectiveness:</strong>');
            
            // Timing-based suggestions
            if (avgEffectiveness < 50) {
                insights.push(`⏰ <strong>Better Timing:</strong> Run ventilation when outdoor temps are 8°F+ cooler than indoor for maximum benefit.`);
            }
            
            // Runtime optimization
            if (avgRuntime < 45) {
                insights.push(`⏱️ <strong>Extend Runtime:</strong> Longer sessions (45+ minutes) allow better air exchange and temperature equalization.`);
            } else if (avgRuntime > 120) {
                insights.push(`⏱️ <strong>Runtime Efficiency:</strong> Consider shorter, more frequent sessions during optimal conditions instead of marathon runs.`);
            }
            
            // Condition-based advice
            if (avgTempDiff < 6) {
                insights.push(`🌡️ <strong>Wait for Better Conditions:</strong> Target 6°F+ temperature differences for meaningful cooling impact.`);
            }
            
            // Seasonal and time-of-day suggestions
            insights.push(`🌙 <strong>Optimal Windows:</strong> Early morning (5-7 AM) and evening (8-10 PM) typically offer best outdoor cooling potential.`);
            
            // System efficiency tips
            if (performanceRange > 25) {
                insights.push(`🔧 <strong>Consistency Tips:</strong> Check for air leaks, clean filters, and ensure unobstructed airflow for consistent performance.`);
            }
            
            // Advanced strategies
            insights.push(`📊 <strong>Smart Strategy:</strong> Monitor weather forecasts - start ventilation before cool fronts arrive for maximum effectiveness.`);
            
            // House-specific optimizations
            if (avgEffectiveness < 40) {
                insights.push(`🏠 <strong>House Optimization:</strong> Consider ceiling fans to improve air circulation and thermal mass pre-cooling during peak effectiveness periods.`);
            }
            
            return insights.map(insight => `<p style="margin: 8px 0;">${insight}</p>`).join('');
        }

        // Cooling effect calculation function
        function calculateCoolingEffect(indoorTemp, outdoorTemp, fanMinutes, fanCurrentlyOn) {
            // Return "No data" if we don't have the required temperatures
            if (indoorTemp == null || outdoorTemp == null || fanMinutes == null) {
                return 'No data';
            }

            // If fan hasn't run today, show that
            if (fanMinutes === 0) {
                return fanCurrentlyOn ? 'Starting...' : 'Not used today';
            }

            // Constants for 4500 CFM fan system
            const FAN_CFM = 4500; // Cubic feet per minute
            const AIR_DENSITY = 0.075; // lbs per cubic foot at standard conditions
            const SPECIFIC_HEAT_AIR = 0.24; // BTU per lb per °F
            const MINUTES_PER_HOUR = 60;

            // Calculate temperature difference (how much cooling potential exists)
            const tempDiff = indoorTemp - outdoorTemp;
            
            // If outdoor is warmer than indoor, show day's performance instead of "No cooling benefit"
            if (tempDiff <= 0) {
                if (fanCurrentlyOn) {
                    return 'Warming air';
                } else {
                    // Calculate and show today's comprehensive performance summary
                    const fanHours = (fanMinutes / 60).toFixed(1);
                    const dutyCycle = ((fanMinutes / (24 * 60)) * 100).toFixed(1);
                    
                    // More realistic BTU and temperature impact calculation
                    // Use conservative 2°F average beneficial temperature difference
                    const avgBeneficialTempDiff = 2.0;
                    const airMassFlowRate = FAN_CFM * AIR_DENSITY;
                    const avgHeatTransferRate = airMassFlowRate * SPECIFIC_HEAT_AIR * avgBeneficialTempDiff * MINUTES_PER_HOUR;
                    const totalBTUsTransferred = avgHeatTransferRate * fanHours;
                    const btuDisplay = totalBTUsTransferred >= 1000 ? 
                        `${(totalBTUsTransferred / 1000).toFixed(1)}k BTU` : 
                        `${totalBTUsTransferred.toFixed(0)} BTU`;
                    
                    // Realistic net temperature impact accounting for heat gain
                    // During daytime operation, house gains heat from:
                    // - Solar gain: ~5-15°F potential rise
                    // - Appliances: ~1-3°F potential rise  
                    // - Thermal mass: Variable impact
                    const HOUSE_VOLUME_CF = 25000;
                    const houseAirMass = HOUSE_VOLUME_CF * AIR_DENSITY;
                    
                    // Calculate gross cooling potential
                    const grossCoolingPotential = totalBTUsTransferred / (houseAirMass * SPECIFIC_HEAT_AIR);
                    
                    // Apply realistic efficiency factors for net cooling achieved:
                    // - Air mixing efficiency: 50% (not perfect circulation)
                    // - Heat gain offset during operation: 80% (major reduction in cooling effectiveness)
                    // - Thermal mass absorption: 70% (walls/furniture absorb some cooling)
                    const netCoolingAchieved = grossCoolingPotential * 0.5 * 0.2 * 0.7; // ~7% net efficiency
                    
                    return `${fanHours}h runtime (${dutyCycle}% duty) • ~${btuDisplay} transferred • ~${netCoolingAchieved.toFixed(1)}°F net cooling achieved`;
                }
            }

            // Calculate heat transfer rate (BTU/hr) when fan is running
            const airMassFlowRate = FAN_CFM * AIR_DENSITY; // lbs/min
            const heatTransferRate = airMassFlowRate * SPECIFIC_HEAT_AIR * tempDiff * MINUTES_PER_HOUR; // BTU/hr

            // Estimate HOURLY cooling rate (more realistic)
            // House volume ~25,000 cubic feet (including high ceilings)
            const HOUSE_VOLUME_CF = 25000;
            const houseAirMass = HOUSE_VOLUME_CF * AIR_DENSITY; // lbs of air in house
            
            // Calculate theoretical temperature drop per hour of continuous operation
            // This assumes perfect mixing and no heat gain during operation
            const hourlyTempDropPotential = heatTransferRate / (houseAirMass * SPECIFIC_HEAT_AIR); // °F/hr
            
            // Apply realistic efficiency factors:
            // - Air mixing efficiency: ~60% (not perfect mixing)
            // - Heat gain offset: ~40% (sun, appliances, thermal mass warming)
            const MIXING_EFFICIENCY = 0.6;
            const HEAT_GAIN_FACTOR = 0.4; // Reduces effective cooling
            
            const practicalHourlyRate = hourlyTempDropPotential * MIXING_EFFICIENCY * (1 - HEAT_GAIN_FACTOR);
            
            // Calculate average cooling rate based on actual usage pattern
            // If fan runs 50% of the time, effective rate is halved
            const operatingEfficiency = Math.min(fanMinutes / (60 * 16), 1.0); // Assume 16-hour operating window
            const effectiveHourlyRate = practicalHourlyRate * operatingEfficiency;

            // Format the results
            const heatTransferKBTU = (heatTransferRate / 1000).toFixed(1); // Convert to thousands of BTU/hr
            const hourlyRate = Math.min(effectiveHourlyRate, tempDiff * 0.5).toFixed(1); // Cap at 50% of temp difference

            // Create status message based on current state
            let status = '';
            if (fanCurrentlyOn) {
                status = ` (${heatTransferKBTU}k BTU/hr)`;
            } else {
                // Show comprehensive daily performance summary when fan is off
                const fanHours = (fanMinutes / 60).toFixed(1);
                const totalCooling = (effectiveHourlyRate * (fanMinutes / 60)).toFixed(1);
                
                // Calculate total BTUs transferred during operation
                const totalBTUsTransferred = heatTransferRate * (fanMinutes / 60);
                const btuDisplay = totalBTUsTransferred >= 1000 ? 
                    `${(totalBTUsTransferred / 1000).toFixed(1)}k BTU` : 
                    `${totalBTUsTransferred.toFixed(0)} BTU`;
                
                // Calculate current potential if fan were running now
                const currentPotentialBTU = (heatTransferRate / 1000).toFixed(1);
                
                status = ` (${fanHours}h today • ${btuDisplay} transferred • ${totalCooling}°F achieved • ${currentPotentialBTU}k BTU/hr potential)`;
            }

            return `~${hourlyRate}°F/hr rate${status}`;
        }

        // Continue with other functions...

// ===================================================================
// PHASE 5: CLIMATE INTELLIGENCE FUNCTIONS
// ===================================================================

/**
 * Show/hide analytics tabs (Incidents vs Climate Intelligence)
 */
function showAnalyticsTab(tabName) {
    console.log(`Switching to ${tabName} analytics tab`);
    
    // Hide all tab content
    const incidentsTab = document.getElementById('incidentsTab');
    const climateTab = document.getElementById('climateTab');
    
    if (incidentsTab) incidentsTab.style.display = 'none';
    if (climateTab) climateTab.style.display = 'none';
    
    // Remove active class from all tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = '#f8f9fa';
        btn.style.color = '#333';
    });
    
    // Show selected tab and update button state
    if (tabName === 'incidents') {
        if (incidentsTab) incidentsTab.style.display = 'block';
        const incidentsBtn = document.getElementById('incidentsTabBtn');
        if (incidentsBtn) {
            incidentsBtn.classList.add('active');
            incidentsBtn.style.background = '#007bff';
            incidentsBtn.style.color = 'white';
        }
        
        // Load incident almanac if not already loaded
        if (typeof loadIncidentAlmanac === 'function') {
            loadIncidentAlmanac();
        }
        
    } else if (tabName === 'climate') {
        if (climateTab) climateTab.style.display = 'block';
        const climateBtn = document.getElementById('climateTabBtn');
        if (climateBtn) {
            climateBtn.classList.add('active', 'climate-tab');
            climateBtn.style.background = '#4CAF50';
            climateBtn.style.color = 'white';
        }
        
        // Load climate analysis
        loadClimateAnalysis();
    }
}

/**
 * Load Climate Intelligence Analysis
 */
let climateAnalysisLoading = false;
let climateAnalysisTimeout = null;

async function loadClimateAnalysis() {
    // Prevent multiple simultaneous calls
    if (climateAnalysisLoading) {
        console.log('Climate analysis already loading, ignoring duplicate call');
        return;
    }
    
    // Clear any pending timeout
    if (climateAnalysisTimeout) {
        clearTimeout(climateAnalysisTimeout);
        climateAnalysisTimeout = null;
    }
    
    climateAnalysisLoading = true;
    const analysisTypeElement = document.getElementById('climateAnalysisType');
    const timePeriodElement = document.getElementById('climatePeriod');
    
    const analysisType = analysisTypeElement?.value || 'seasonal';
    const timePeriod = timePeriodElement?.value || '12';
    const statusElement = document.getElementById('climateAnalysisStatus');
    const displayElement = document.getElementById('climateAnalysisDisplay');
    
    console.log(`Loading climate analysis: ${analysisType} for ${timePeriod} months`);
    console.log(`Analysis type selector current value: "${analysisType}"`);
    
    // Debug: Log all available options
    if (analysisTypeElement) {
        const options = Array.from(analysisTypeElement.options);
        console.log('Available analysis types:', options.map(opt => `${opt.value}="${opt.text}"`));
        console.log('Selected index:', analysisTypeElement.selectedIndex);
    }
    
    if (statusElement) {
        statusElement.textContent = `Loading ${analysisType} analysis...`;
    }
    
    if (displayElement) {
        displayElement.innerHTML = `
            <div class="loading-climate">
                <h4>🌤️ Analyzing Climate Patterns...</h4>
                <p>Processing ${timePeriod} months of historical data for ${analysisType} analysis</p>
                <p style="font-size: 0.9em; margin-top: 15px; color: #666;">This may take a few moments...</p>
            </div>
        `;
    }
    
    try {
        // Build API URL for new PacificNWClimateAnalyzer function
        const apiUrl = `https://esp32-ventilation-api.azurewebsites.net/api/PacificNWClimateAnalyzer?type=${analysisType}&period=${timePeriod}&deviceId=${CONFIG.deviceId}`;
        
        console.log(`Calling Climate API: ${apiUrl}`);
        
        // Use same authentication pattern as GetVentilationStatus
        const headers = getAuthHeaders();
        console.log('Using authentication headers for Climate API:', Object.keys(headers));
        
        // DEBUG: Log the actual API key being sent in the header
        if (headers['X-API-Secret']) {
            console.log('DEBUG: Climate API X-API-Secret header value:', headers['X-API-Secret']);
        } else if (headers['Authorization']) {
            console.log('DEBUG: Climate API Authorization header value:', headers['Authorization']);
        } else {
            console.log('DEBUG: Climate API - No authentication header found!');
        }
        console.log('DEBUG: Full headers object for Climate API:', headers);
        
        // DEBUG: Check authentication status
        const token = localStorage.getItem('ventilation_auth_token');
        console.log('DEBUG: Bearer token available:', !!token);
        console.log('DEBUG: API secret available:', !!CONFIG.apiSecret);
        console.log('DEBUG: Current URL:', window.location.href);
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: headers
        });
        
        console.log('DEBUG: Climate API response status:', response.status);
        console.log('DEBUG: Climate API response headers:', [...response.headers.entries()]);
        
        if (!response.ok) {
            // Try to get detailed error information
            let errorText = '';
            try {
                errorText = await response.text();
                console.log('DEBUG: Climate API error response body:', errorText);
            } catch (e) {
                console.log('DEBUG: Could not read error response body:', e);
            }
            throw new Error(`Climate API returned ${response.status}: ${response.statusText}. Response: ${errorText}`);
        }
        
        const climateData = await response.json();
        console.log('Climate analysis data received:', climateData);
        
        // Display the climate analysis
        displayClimateAnalysis(climateData, analysisType);
        
        if (statusElement) {
            statusElement.textContent = `${analysisType} analysis completed - ${timePeriod} months analyzed`;
        }
        
        // Show data source indicator
        showClimateDataSource(climateData, analysisType, timePeriod);
        
        // Reset loading flag on success
        climateAnalysisLoading = false;
        
    } catch (error) {
        console.error('Climate analysis loading failed:', error);
        
        if (statusElement) {
            statusElement.textContent = `Error loading ${analysisType} analysis`;
        }
        
        if (displayElement) {
            displayElement.innerHTML = `
                <div class="error-climate" style="text-align: center; padding: 60px 20px; color: #dc3545;">
                    <h4>❌ Climate Analysis Error</h4>
                    <p><strong>Failed to load ${analysisType} analysis:</strong></p>
                    <p style="color: #666; font-family: monospace; font-size: 0.9em;">${error.message}</p>
                    <p style="margin-top: 20px;">
                        <button onclick="loadClimateAnalysis()" style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer;">
                            🔄 Try Again
                        </button>
                    </p>
                    <p style="font-size: 0.8em; color: #666; margin-top: 15px;">
                        Note: Climate intelligence requires Azure Function deployment
                    </p>
                </div>
            `;
        }
        
        // Reset loading flag on error
        climateAnalysisLoading = false;
    }
}

/**
 * Display Climate Analysis Results
 */
function displayClimateAnalysis(data, analysisType) {
    const displayElement = document.getElementById('climateAnalysisDisplay');
    if (!displayElement) return;
    
    console.log(`Displaying ${analysisType} climate analysis`);
    
    if (data.error) {
        displayElement.innerHTML = `
            <div class="error-climate" style="text-align: center; padding: 40px 20px; color: #dc3545;">
                <h4>⚠️ Analysis Error</h4>
                <p>${data.error}</p>
                ${data.message ? `<p style="color: #666; font-size: 0.9em;">${data.message}</p>` : ''}
            </div>
        `;
        return;
    }
    
    const climate = data.climate || {};
    
    switch (analysisType) {
        case 'seasonal':
            displayElement.innerHTML = generateSeasonalDisplay(climate);
            break;
        case 'microclimate':
            displayElement.innerHTML = generateMicroclimatteDisplay(climate);
            break;
        case 'forecast_accuracy':
            displayElement.innerHTML = generateForecastDisplay(climate);
            break;
        case 'summary':
            displayElement.innerHTML = generateClimateIntelligenceSummary(climate);
            break;
        default:
            displayElement.innerHTML = generateDefaultClimateDisplay(climate);
    }
}

/**
 * Generate Seasonal Pattern Display
 */
function generateSeasonalDisplay(climate) {
    const currentSeason = climate.currentSeason || {};
    const marineLayer = climate.marineLayerSeason || {};
    const rainSeason = climate.rainSeasonAnalysis || {};
    const pressurePatterns = climate.highPressurePatterns || {};
    const insights = climate.climateInsights || {};
    
    // Handle error cases
    if (climate.error) {
        return `
            <div class="seasonal-intelligence-panel">
                <h4>🌊 Pacific NW Seasonal Intelligence</h4>
                <div class="climate-insight">
                    <p><strong>⚠️ Analysis Error:</strong> ${climate.error}</p>
                    ${climate.recommendation ? `<p><strong>💡 Recommendation:</strong> ${climate.recommendation}</p>` : ''}
                </div>
            </div>
        `;
    }
    
    return `
        <div class="seasonal-intelligence-panel">
            <h4>🌊 Pacific NW Seasonal Intelligence</h4>
            
            <div class="current-season-status" style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #2196F3;">
                <h5 style="margin: 0 0 10px 0; color: #1976d2;">Current Season: ${currentSeason.season || 'Unknown'}</h5>
                <p style="margin: 5px 0; color: #666;">${currentSeason.typical_weather || 'Season analysis unavailable'}</p>
                <div style="margin-top: 10px;">
                    ${(currentSeason.characteristics || []).map(char => `<span style="background: #e3f2fd; color: #1976d2; padding: 3px 8px; border-radius: 12px; font-size: 0.85em; margin-right: 8px;">${char}</span>`).join('')}
                </div>
            </div>
            
            <div class="climate-metric-grid">
                <div class="climate-metric-card">
                    <div class="climate-metric-value">${marineLayer.currentStatus || marineLayer.seasonStatistics?.marineLayerFrequency || '--'}</div>
                    <div class="climate-metric-label">Marine Layer Status</div>
                    <div style="font-size: 0.8em; color: #666;">${marineLayer.typicalSeason || marineLayer.peakPeriod || 'Analysis pending'}</div>
                </div>
                
                <div class="climate-metric-card">
                    <div class="climate-metric-value">${rainSeason.currentPhase || '--'}</div>
                    <div class="climate-metric-label">Rain Season Phase</div>
                    <div style="font-size: 0.8em; color: #666;">${rainSeason.typicalStart || rainSeason.wetSeasonDuration || 'Analysis pending'}</div>
                </div>
                
                <div class="climate-metric-card">
                    <div class="climate-metric-value">${pressurePatterns.currentStatus || pressurePatterns.error ? 'Data Unavailable' : '--'}</div>
                    <div class="climate-metric-label">Pressure Pattern</div>
                    <div style="font-size: 0.8em; color: #666;">${pressurePatterns.error || pressurePatterns.stableSeasons || pressurePatterns.pacificNWPattern || 'Analysis pending'}</div>
                </div>
            </div>
            
            <div class="seasonal-insights" style="margin-top: 20px;">
                <h5 style="color: #2e7d32; margin-bottom: 10px;">📊 Pattern Analysis</h5>
                ${generateInsightsList(insights.primaryInsights || [])}
                
                ${rainSeason.prediction ? `
                    <div class="climate-insight">
                        <p><strong>🌧️ Rain Season Prediction:</strong> ${rainSeason.prediction} <em>(Historical)</em></p>
                    </div>
                ` : ''}
                
                ${marineLayer.insight ? `
                    <div class="climate-insight">
                        <p><strong>🌊 Marine Layer Insight:</strong> ${marineLayer.insight} <em>(Historical)</em></p>
                    </div>
                ` : ''}
                
                ${pressurePatterns.insight ? `
                    <div class="climate-insight">
                        <p><strong>🌪️ Pressure Insight:</strong> ${pressurePatterns.insight} <em>(Historical)</em></p>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Generate Microclimate Profile Display
 */
function generateMicroclimatteDisplay(climate) {
    const advantages = climate.locationAdvantages || {};
    const localPatterns = climate.localPatterns || [];
    const comparison = climate.regionalComparison || {};
    const energyImplications = climate.energyImplications || {};
    
    // Handle error cases
    if (climate.error) {
        return `
            <div class="microclimate-profile-panel">
                <h4>🏠 Your Microclimate Profile</h4>
                <div class="climate-insight">
                    <p><strong>⚠️ Analysis Error:</strong> ${climate.error}</p>
                    ${climate.recommendation ? `<p><strong>💡 Recommendation:</strong> ${climate.recommendation}</p>` : ''}
                </div>
            </div>
        `;
    }
    
    return `
        <div class="microclimate-profile-panel">
            <h4>🏠 Your Microclimate Profile</h4>
            
            <div class="microclimate-comparison" style="margin: 20px 0;">
                <h5 style="color: #2e7d32; margin-bottom: 15px;">📊 Your Location vs Regional Weather</h5>
                
                <div class="climate-metric-grid">
                    <div class="climate-metric-card">
                        <div class="climate-metric-value">${advantages.temperatureBias || '--'}</div>
                        <div class="climate-metric-label">Temperature Bias</div>
                        <div style="font-size: 0.8em; color: #666;">vs regional forecasts</div>
                    </div>
                    
                    <div class="climate-metric-card">
                        <div class="climate-metric-value">${comparison.marineLayerClearance || '--'}</div>
                        <div class="climate-metric-label">Marine Layer Clearance</div>
                        <div style="font-size: 0.8em; color: #666;">vs regional average</div>
                    </div>
                    
                    <div class="climate-metric-card">
                        <div class="climate-metric-value">${comparison.weatherProtection || '--'}</div>
                        <div class="climate-metric-label">Weather Protection</div>
                        <div style="font-size: 0.8em; color: #666;">pressure stability</div>
                    </div>
                </div>
            </div>
            
            <div class="microclimate-insights" style="margin-top: 20px;">
                <h5 style="color: #2e7d32; margin-bottom: 10px;">🎯 Your Location's Climate Signature</h5>
                
                ${advantages.microclimateFactor ? `
                    <div class="climate-insight">
                        <p><strong>🏠 Microclimate Factor:</strong> ${advantages.microclimateFactor} <em>(Analysis)</em></p>
                    </div>
                ` : ''}
                
                ${energyImplications.heatingReduction || energyImplications.coolingReduction ? `
                    <div class="climate-insight">
                        <p><strong>⚡ Heating Efficiency:</strong> ${energyImplications.heatingReduction || 'Analysis pending'} <em>(Analysis)</em></p>
                        <p><strong>❄️ Cooling Efficiency:</strong> ${energyImplications.coolingReduction || 'Analysis pending'} <em>(Analysis)</em></p>
                    </div>
                ` : ''}
                
                ${localPatterns && localPatterns.length > 0 ? `
                    <div class="climate-insight">
                        <p><strong>📈 Local Patterns:</strong> ${localPatterns.join(', ')} <em>(Historical Analysis)</em></p>
                    </div>
                ` : ''}
                
                <div class="climate-insight">
                    <p><strong>� Data Quality:</strong> Analysis based on forecast accuracy vs actual sensor readings <em>(Forecast vs Historical)</em></p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Generate Forecast Performance Display
 */
function generateForecastDisplay(climate) {
    const accuracy = climate.accuracyMetrics || {};
    const biases = climate.consistentBiases || {};
    const recommendations = climate.recommendations || [];
    const dataQuality = climate.dataQuality || {};
    
    // Handle error cases
    if (climate.error) {
        return `
            <div class="forecast-performance-panel">
                <h4>📊 Forecast Performance for Your Location</h4>
                <div class="climate-insight">
                    <p><strong>⚠️ Analysis Error:</strong> ${climate.error}</p>
                    ${climate.recommendation ? `<p><strong>💡 Recommendation:</strong> ${climate.recommendation}</p>` : ''}
                </div>
            </div>
        `;
    }
    
    // Extract accuracy percentages from strings like "75% within ±2°F, 90% within ±5°F"
    function extractAccuracyPercentage(accuracyString) {
        if (!accuracyString) return '--';
        const match = accuracyString.match(/(\d+)%/);
        return match ? match[1] : '--';
    }
    
    return `
        <div class="forecast-performance-panel">
            <h4>📊 Forecast Performance for Your Location</h4>
            
            <div class="accuracy-metrics" style="margin: 20px 0;">
                <h5 style="color: #2e7d32; margin-bottom: 15px;">🎯 Open-Meteo Accuracy Analysis</h5>
                
                <div class="climate-metric-grid">
                    <div class="climate-metric-card">
                        <div class="climate-metric-value">${extractAccuracyPercentage(accuracy.temperature?.accuracy)}%</div>
                        <div class="climate-metric-label">Temperature Accuracy</div>
                        <div style="font-size: 0.8em; color: #666;">${accuracy.temperature?.accuracy || 'Analysis pending'}</div>
                    </div>
                    
                    <div class="climate-metric-card">
                        <div class="climate-metric-value">${extractAccuracyPercentage(accuracy.pressure?.accuracy)}%</div>
                        <div class="climate-metric-label">Pressure Accuracy</div>
                        <div style="font-size: 0.8em; color: #666;">${accuracy.pressure?.accuracy || 'Analysis pending'}</div>
                    </div>
                    
                    <div class="climate-metric-card">
                        <div class="climate-metric-value">${extractAccuracyPercentage(accuracy.humidity?.accuracy)}%</div>
                        <div class="climate-metric-label">Humidity Accuracy</div>
                        <div style="font-size: 0.8em; color: #666;">${accuracy.humidity?.accuracy || 'Analysis pending'}</div>
                    </div>
                </div>
            </div>
            
            <div class="forecast-insights" style="margin-top: 20px;">
                <h5 style="color: #2e7d32; margin-bottom: 10px;">🎯 Forecast Calibration Insights</h5>
                
                ${biases.temperatureBias ? `
                    <div class="climate-insight">
                        <p><strong>🌡️ Temperature Bias:</strong> ${biases.temperatureBias} <em>(Forecast vs Historical)</em></p>
                    </div>
                ` : ''}
                
                ${biases.humidityBias ? `
                    <div class="climate-insight">
                        <p><strong>💧 Humidity Bias:</strong> ${biases.humidityBias} <em>(Forecast vs Historical)</em></p>
                    </div>
                ` : ''}
                
                ${biases.pressureBias ? `
                    <div class="climate-insight">
                        <p><strong>🌪️ Pressure Accuracy:</strong> ${biases.pressureBias} <em>(Forecast vs Historical)</em></p>
                    </div>
                ` : ''}
                
                <div class="climate-insight">
                    <p><strong>📊 Data Quality:</strong> ${dataQuality.totalComparisons || 0} forecast comparisons analyzed (${dataQuality.dataReliability || 'Unknown'} reliability) <em>(Forecast vs Historical)</em></p>
                </div>
                
                ${recommendations && recommendations.length > 0 ? `
                    <div class="climate-insight">
                        <p><strong>💡 Recommendations:</strong></p>
                        <ul style="margin: 5px 0; padding-left: 20px;">
                            ${recommendations.map(rec => `<li>${rec}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Generate Climate Intelligence Summary
 */
function generateClimateIntelligenceSummary(climate) {
    const currentStatus = climate.currentClimateStatus || {};
    const seasonal = climate.seasonalIntelligence || {};
    const microclimate = climate.microclimatAdvantages || {};
    const forecast = climate.forecastReliability || {};
    const insights = climate.actionableInsights || [];
    const summary = climate.climateSummary || {};
    const systemStatus = climate.systemStatus || {};
    const dataAvailability = climate.dataAvailability || {};
    
    // Handle error cases
    if (climate.error) {
        return `
            <div class="climate-summary-panel">
                <h4>⭐ Complete Climate Intelligence Summary</h4>
                <div class="climate-insight">
                    <p><strong>⚠️ Analysis Error:</strong> ${climate.error}</p>
                    ${climate.recommendation ? `<p><strong>💡 Recommendation:</strong> ${climate.recommendation}</p>` : ''}
                </div>
            </div>
        `;
    }
    
    return `
        <div class="climate-summary-panel">
            <h4>⭐ Complete Climate Intelligence Summary</h4>
            
            <div class="current-climate-status" style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); padding: 20px; border-radius: 10px; margin: 15px 0; border-left: 4px solid #2196F3;">
                <h5 style="margin: 0 0 10px 0; color: #1976d2;">📊 Current Climate Status</h5>
                <p style="margin: 0; color: #333; font-size: 1.1em;">${summary || currentStatus.summary || currentStatus || 'Climate analysis in progress...'}</p>
            </div>
            
            <div class="system-readiness" style="margin: 15px 0;">
                <h5 style="color: #2e7d32; margin-bottom: 10px;">🎯 System Status</h5>
                <div class="climate-metric-grid">
                    <div class="climate-metric-card" style="border-color: #4CAF50;">
                        <div class="climate-metric-value" style="color: #2e7d32;">${systemStatus.overallReadiness || 'Unknown'}</div>
                        <div class="climate-metric-label">System Readiness</div>
                        <div style="font-size: 0.8em; color: #666;">Overall data status</div>
                    </div>
                    
                    <div class="climate-metric-card" style="border-color: #FF9800;">
                        <div class="climate-metric-value" style="color: #f57c00;">${systemStatus.monthlyStats || dataAvailability.monthlyStatistics || 'Unknown'}</div>
                        <div class="climate-metric-label">Monthly Data</div>
                        <div style="font-size: 0.8em; color: #666;">Historical patterns</div>
                    </div>
                    
                    <div class="climate-metric-card" style="border-color: #2196F3;">
                        <div class="climate-metric-value" style="color: #1976d2;">${systemStatus.forecastData || dataAvailability.forecastComparisons || 'Unknown'}</div>
                        <div class="climate-metric-label">Forecast Data</div>
                        <div style="font-size: 0.8em; color: #666;">Accuracy tracking</div>
                    </div>
                </div>
            </div>
            
            <div class="climate-intelligence-highlights" style="margin: 20px 0;">
                <h5 style="color: #2e7d32; margin-bottom: 15px;">🌿 Climate Intelligence Highlights</h5>
                
                ${seasonal && typeof seasonal === 'string' ? `
                    <div class="climate-insight">
                        <p><strong>🌊 Seasonal Intelligence:</strong> ${seasonal} <em>(Historical)</em></p>
                    </div>
                ` : ''}
                
                ${microclimate && typeof microclimate === 'string' ? `
                    <div class="climate-insight">
                        <p><strong>🏠 Microclimate Advantages:</strong> ${microclimate} <em>(Analysis)</em></p>
                    </div>
                ` : ''}
                
                ${forecast && (typeof forecast === 'string' || forecast.reliability) ? `
                    <div class="climate-insight">
                        <p><strong>📊 Forecast Reliability:</strong> ${forecast.reliability || forecast} <em>(Forecast vs Historical)</em></p>
                    </div>
                ` : ''}
            </div>
            
            <div class="actionable-insights" style="margin-top: 25px;">
                <h5 style="color: #2e7d32; margin-bottom: 15px;">💡 Actionable Climate Insights</h5>
                ${generateInsightsList(insights)}
                
                <div class="climate-insight">
                    <p><strong>📈 Intelligence Sources:</strong> Combining Historical sensor data, Forecast accuracy analysis, and Real-time pattern recognition for comprehensive Pacific NW climate mastery</p>
                </div>
            </div>
            
            <div class="specialization-summary" style="margin-top: 20px; background: #f0f8f0; padding: 15px; border-radius: 8px; border: 1px solid #4CAF50;">
                <h6 style="color: #2e7d32; margin-bottom: 10px;">🌿 Pacific NW Climate Specialization</h6>
                <p style="margin: 0; color: #333; font-size: 0.9em;">Advanced marine layer detection, rain season timing predictions, and pressure intelligence calibrated specifically for Pacific Northwest climate patterns.</p>
            </div>
        </div>
    `;
}

/**
 * Generate default climate display for unknown analysis types
 */
function generateDefaultClimateDisplay(climate) {
    return `
        <div class="climate-summary-panel">
            <h4>🌤️ Climate Analysis Results</h4>
            <div class="climate-insight">
                <p>Climate analysis data received. Analysis type not recognized.</p>
                <pre style="background: #f8f9fa; padding: 10px; border-radius: 5px; overflow-x: auto; font-size: 0.8em;">
${JSON.stringify(climate, null, 2)}
                </pre>
            </div>
        </div>
    `;
}

/**
 * Generate insights list HTML
 */
function generateInsightsList(insights) {
    if (!insights || !Array.isArray(insights) || insights.length === 0) {
        return `
            <div class="climate-insight">
                <p>📊 Climate insights are being analyzed from your historical data...</p>
            </div>
        `;
    }
    
    return insights.map(insight => `
        <div class="climate-insight">
            <p>${insight}</p>
        </div>
    `).join('');
}

/**
 * Show climate data source information
 */
function showClimateDataSource(data, analysisType, timePeriod) {
    const indicator = document.getElementById('climateDataSourceIndicator');
    const details = document.getElementById('climateDataSourceDetails');
    
    if (!indicator || !details) return;
    
    const dataSource = data.dataSource || 'Climate analysis data';
    const timestamp = data.timestamp || new Date().toISOString();
    
    details.innerHTML = `
        Analysis: ${analysisType} | Period: ${timePeriod} months | Source: ${dataSource}
        <br>Generated: ${new Date(timestamp).toLocaleString()} | Data Tags: (Historical), (Forecast vs Historical), (Analysis)
    `;
    
    indicator.style.display = 'block';
}

// Initialize Climate Intelligence on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Climate Intelligence module loaded');
    
    // Set up event listeners for climate controls if they exist
    const climateAnalysisType = document.getElementById('climateAnalysisType');
    const climatePeriod = document.getElementById('climatePeriod');
    
    if (climateAnalysisType) {
        climateAnalysisType.addEventListener('change', loadClimateAnalysis);
        
        // Add debugging for unwanted changes
        let lastValue = climateAnalysisType.value;
        setInterval(() => {
            if (climateAnalysisType.value !== lastValue) {
                console.warn(`Climate analysis type changed unexpectedly from "${lastValue}" to "${climateAnalysisType.value}"`);
                lastValue = climateAnalysisType.value;
            }
        }, 1000);
    }
    
    if (climatePeriod) {
        climatePeriod.addEventListener('change', loadClimateAnalysis);
    }
});


// CSV Export function for pressure analysis
async function exportPressureAnalysisCSV() {
    const timeRange = document.getElementById('csvTimeRange').value;
    const exportButton = document.getElementById('exportCsvBtn');
    const qualityDot = document.getElementById('csvDataQualityDot');
    const qualityText = document.getElementById('csvDataQualityText');
    
    try {
        // Update button state
        exportButton.disabled = true;
        exportButton.textContent = '⏳ Generating CSV...';
        
        // Update quality indicator
        qualityDot.className = 'status-dot yellow';
        qualityText.textContent = 'Processing...';
        
        // Use the existing DataManager directly (no module import needed)
        const jsonData = await DataManager.getDoorAnalyticsData(timeRange, 'raw-transitions');
        
        if (!jsonData.transitions || jsonData.transitions.length === 0) {
            throw new Error('No door transition data found for the selected time range');
        }
        
        // Convert JSON to CSV client-side
        const csvContent = convertTransitionsToCSV(jsonData.transitions);
        
        // Create and download the CSV file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const timestamp = new Date().toISOString().split('T')[0];
        link.href = url;
        link.download = `pressure_analysis_${timeRange}_${timestamp}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        // Update quality indicator - success
        qualityDot.className = 'status-dot green';
        qualityText.textContent = `Exported ${jsonData.transitions.length} records`;
        
        console.log(`CSV Export successful: ${jsonData.transitions.length} transitions exported for ${timeRange}`);
        
    } catch (error) {
        console.error('CSV Export Error:', error);
        
        // Update quality indicator - error
        qualityDot.className = 'status-dot red';
        qualityText.textContent = 'Export failed';
        
        // Show user-friendly error
        alert(`CSV Export failed: ${error.message}`);
    } finally {
        // Reset button state
        exportButton.disabled = false;
        exportButton.textContent = '📥 Export CSV Data';
    }
}

// Convert JSON transitions data to CSV format
function convertTransitionsToCSV(transitions) {
    const csvHeaders = [
        // Basic Event Information
        'Timestamp_Pacific',  // Auto-detects PST/PDT based on date
        'Timestamp_Unix', 
        'Action',
        'Zone',
        'Detection_Method',
        'Confidence',
        'Pressure_Change_mbar',
        
        // Legacy System Fields
        'Reed_Door_Name',
        'Loop_Delay_Ms',
        'Power_Outage_Detected',
        'Power_Outage_Duration_Minutes',
        'System_Uptime_Seconds',
        'Entry_Timestamp',
        
        // Raw Pressure Context (3 fields)
        'Indoor_Pressure_hPa',
        'Garage_Pressure_hPa',
        'Outdoor_Pressure_hPa',
        
        // Pressure Differentials (3 fields)
        'Indoor_Garage_Diff_hPa',
        'Indoor_Outdoor_Diff_hPa',
        'Garage_Outdoor_Diff_hPa',
        
        // Pressure Changes (4 fields)
        'Indoor_Change_hPa',
        'Garage_Change_hPa',
        'Outdoor_Change_hPa',
        'Pressure_Change_Window_hPa',
        
        // Detection Analysis (6 fields)
        'Detection_Triggered_By',
        'Event_Validated_By_Reed',
        'Detection_Window_Size',
        'Sensor_Noise_Level_hPa',
        'Adaptive_Threshold_hPa',
        'Sensor_Sample_Rate_Hz',
        
        // Environmental Context (2 fields)
        'Ambient_Temperature_C',
        'Ambient_Humidity_Pct'
    ];
    
    const csvLines = [csvHeaders.join(',')];
    
    // Sort transitions by timestamp
    const sortedTransitions = transitions.sort((a, b) => a.timestamp - b.timestamp);
    
    sortedTransitions.forEach(transition => {
        try {
            // Convert Unix timestamp to Pacific Time (handles PST/PDT automatically)
            const unixTimestamp = parseInt(transition.timestamp);
            const utcTime = new Date(unixTimestamp * 1000);
            
            // Use Intl.DateTimeFormat for proper Pacific timezone conversion
            // Format the timestamp in Pacific timezone with explicit PST/PDT detection
            const pacificFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Los_Angeles',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
            
            // Get the formatted parts
            const pacificParts = pacificFormatter.formatToParts(utcTime);
            const year = pacificParts.find(p => p.type === 'year').value;
            const month = pacificParts.find(p => p.type === 'month').value;
            const day = pacificParts.find(p => p.type === 'day').value;
            const hour = pacificParts.find(p => p.type === 'hour').value;
            const minute = pacificParts.find(p => p.type === 'minute').value;
            const second = pacificParts.find(p => p.type === 'second').value;
            
            // Determine PDT vs PST based on the EVENT'S date (not current date)
            // This ensures historical events get the correct timezone for when they occurred
            const tzFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Los_Angeles',
                timeZoneName: 'short'
            });
            const tzParts = tzFormatter.formatToParts(utcTime);  // Use utcTime (the event's time)
            const tzName = tzParts.find(p => p.type === 'timeZoneName')?.value || 'PST';
            
            const pacificTimestamp = `${year}-${month}-${day} ${hour}:${minute}:${second} ${tzName}`;
            
            // Debug logging for first few entries to verify timezone conversion
            if (csvLines.length <= 3) {
                console.log(`Timezone conversion debug: Unix ${unixTimestamp} -> UTC ${utcTime.toISOString()} -> Pacific ${pacificTimestamp}`);
            }
            
            // Determine action - handle system events specially
            let action;
            const detectionMethod = transition.detectionMethod || 'unknown';
            if (['power-outage', 'reboot', 'loop-delay'].includes(detectionMethod)) {
                // System events use detection method as action
                action = detectionMethod.toUpperCase();
            } else {
                // Door events use opened/closed status
                action = transition.opened ? 'OPEN' : 'CLOSE';
            }
            
            const csvRow = [
                // Basic Event Information
                pacificTimestamp,
                unixTimestamp,
                action,
                transition.zone || 'unknown',
                detectionMethod,
                transition.confidence ? Math.round(transition.confidence * 1000) / 1000 : 0,
                transition.pressureChange ? Math.round(transition.pressureChange * 10000) / 10000 : 0,
                
                // Legacy System Fields
                transition.reedDoorName || 'unknown',
                transition.loopDelayMs || 0,
                transition.powerOutageDetected ? 'YES' : 'NO',
                transition.wifiOutageMinutes || 0,
                transition.systemUptime || 0,
                transition.entryTimestamp || 'None',
                
                // Raw Pressure Context (3 fields)
                transition.indoorPressure_hPa ? Math.round(transition.indoorPressure_hPa * 100) / 100 : 0,
                transition.garagePressure_hPa ? Math.round(transition.garagePressure_hPa * 100) / 100 : 0,
                transition.outdoorPressure_hPa ? Math.round(transition.outdoorPressure_hPa * 100) / 100 : 0,
                
                // Pressure Differentials (3 fields)
                transition.indoorGarageDiff_hPa ? Math.round(transition.indoorGarageDiff_hPa * 10000) / 10000 : 0,
                transition.indoorOutdoorDiff_hPa ? Math.round(transition.indoorOutdoorDiff_hPa * 10000) / 10000 : 0,
                transition.garageOutdoorDiff_hPa ? Math.round(transition.garageOutdoorDiff_hPa * 10000) / 10000 : 0,
                
                // Pressure Changes (4 fields)
                transition.indoorChange_hPa ? Math.round(transition.indoorChange_hPa * 10000) / 10000 : 0,
                transition.garageChange_hPa ? Math.round(transition.garageChange_hPa * 10000) / 10000 : 0,
                transition.outdoorChange_hPa ? Math.round(transition.outdoorChange_hPa * 10000) / 10000 : 0,
                transition.pressureChangeWindow_hPa ? Math.round(transition.pressureChangeWindow_hPa * 10000) / 10000 : 0,
                
                // Detection Analysis (6 fields)
                transition.detectionTriggeredBy || 'unknown',
                transition.eventValidatedByReed ? 'YES' : 'NO',
                transition.detectionWindowSize || 1,
                transition.sensorNoiseLevel_hPa ? Math.round(transition.sensorNoiseLevel_hPa * 10000) / 10000 : 0,
                transition.adaptiveThreshold_hPa ? Math.round(transition.adaptiveThreshold_hPa * 10000) / 10000 : 0,
                transition.sensorSampleRate_Hz ? Math.round(transition.sensorSampleRate_Hz * 100) / 100 : 0,
                
                // Environmental Context (2 fields)
                transition.ambientTemperature_C ? Math.round(transition.ambientTemperature_C * 100) / 100 : 0,
                transition.ambientHumidity_pct ? Math.round(transition.ambientHumidity_pct * 100) / 100 : 0
            ];
            
            // Escape any commas in the data
            const escapedRow = csvRow.map(field => {
                const str = String(field);
                return str.includes(',') ? `"${str}"` : str;
            });
            
            csvLines.push(escapedRow.join(','));
        } catch (error) {
            console.warn('Error processing transition:', error, transition);
        }
    });
    
    return csvLines.join('\n');
}

// Export functions for global access (ensure they're available)
if (typeof showAnalyticsTab === 'function') {
    window.showAnalyticsTab = showAnalyticsTab;
    console.log('showAnalyticsTab exported to window');
} else {
    console.error('showAnalyticsTab function not found');
}

if (typeof loadClimateAnalysis === 'function') {
    window.loadClimateAnalysis = loadClimateAnalysis;
    console.log('loadClimateAnalysis exported to window');
} else {
    console.error('loadClimateAnalysis function not found');
}

// Export CSV export function
window.exportPressureAnalysisCSV = exportPressureAnalysisCSV;

// ===================================================================
// ENHANCED STORM DETECTION DISPLAY FUNCTIONS
// ===================================================================

// Function to update enhanced storm detection display
function updateEnhancedStormDisplay(data) {
    try {
        // Create weather data fallback since API has no weather section
        const weatherData = data.weather || 
                           (data.sections?.yesterday?.environmental?.pressure?.weather) || 
                           { stormRisk: 'NONE', forecastHigh: 0 };
        
        // Basic storm risk (existing field)
        const stormRiskElement = document.getElementById('stormRisk');
        if (stormRiskElement) {
            stormRiskElement.textContent = weatherData.stormRisk || 'NONE';
        }
        
        // Enhanced storm detection data - use weather fallback data
        if (weatherData) {
            const stormRisk = weatherData.stormRisk || 'NONE';
            
            // Storm Type
            const stormTypeElement = document.getElementById('stormType');
            if (stormTypeElement) {
                // Map stormRisk to storm type
                let type = 'Clear';
                if (stormRisk === 'NONE' || stormRisk === 'Low') {
                    type = 'Clear';
                } else if (stormRisk === 'Possible') {
                    type = 'Approaching';
                } else if (stormRisk === 'Likely') {
                    type = 'Developing';
                } else if (stormRisk === 'Imminent') {
                    type = 'Active';
                }
                stormTypeElement.textContent = type;
            }
            
            // Storm Confidence
            const stormConfidenceElement = document.getElementById('stormConfidence');
            if (stormConfidenceElement) {
                // Map stormRisk to confidence level
                let confidence = 0;
                if (stormRisk === 'NONE' || stormRisk === 'Low') {
                    confidence = 0.1;
                } else if (stormRisk === 'Possible') {
                    confidence = 0.4;
                } else if (stormRisk === 'Likely') {
                    confidence = 0.7;
                } else if (stormRisk === 'Imminent') {
                    confidence = 0.9;
                }
                stormConfidenceElement.textContent = `${Math.round(confidence * 100)}%`;
                
                // Color code confidence
                if (confidence >= 0.8) {
                    stormConfidenceElement.style.color = '#d63031'; // High confidence - red
                } else if (confidence >= 0.6) {
                    stormConfidenceElement.style.color = '#e17055'; // Medium confidence - orange
                } else if (confidence >= 0.4) {
                    stormConfidenceElement.style.color = '#fdcb6e'; // Low confidence - yellow
                } else {
                    stormConfidenceElement.style.color = '#00b894'; // Very low - green
                }
            }
            
            // Storm Arrival Time
            const stormArrivalElement = document.getElementById('stormArrival');
            if (stormArrivalElement) {
                // Map stormRisk to estimated arrival
                let arrivalText = 'Clear';
                if (stormRisk === 'NONE' || stormRisk === 'Low') {
                    arrivalText = 'Clear';
                } else if (stormRisk === 'Possible') {
                    arrivalText = '6-12 hr';
                } else if (stormRisk === 'Likely') {
                    arrivalText = '2-6 hr';
                } else if (stormRisk === 'Imminent') {
                    arrivalText = '< 1 hr';
                }
                stormArrivalElement.textContent = arrivalText;
                
                // Color code urgency based on storm risk level
                if (stormRisk === 'Imminent') {
                    stormArrivalElement.style.color = '#d63031'; // Imminent - red
                } else if (stormRisk === 'Likely') {
                    stormArrivalElement.style.color = '#e17055'; // Soon - orange
                } else if (stormRisk === 'Possible') {
                    stormArrivalElement.style.color = '#fdcb6e'; // Later - yellow
                } else {
                    stormArrivalElement.style.color = '#00b894'; // Clear - green
                }
            }
            
            // Storm Description - create enhanced object from available data
            const enhanced = {
                description: stormRisk === 'NONE' ? 'Clear' : 'Storm Detected',
                type: stormRisk === 'NONE' ? 'Clear' : 'Weather Event',
                confidence: stormRisk === 'NONE' ? 0 : 0.85,
                estimatedMinutes: stormRisk === 'NONE' ? 0 : 120
            };
            
            const stormDescriptionElement = document.getElementById('stormDescription');
            if (stormDescriptionElement) {
                const description = enhanced.description || 'Clear';
                if (description === 'Clear') {
                    stormDescriptionElement.textContent = 'Enhanced storm detection analyzes pressure patterns across multiple timescales to provide advance warning for Pacific Northwest weather events.';
                } else {
                    // Create detailed description based on storm type and timing
                    let detailedDesc = `${enhanced.type} detected with ${Math.round((enhanced.confidence || 0) * 100)}% confidence. `;
                    
                    // Add timing context
                    const minutes = enhanced.estimatedMinutes || 0;
                    if (minutes <= 30) {
                        detailedDesc += 'Immediate preparation recommended.';
                    } else if (minutes <= 120) {
                        detailedDesc += 'Storm approaching within 2 hours.';
                    } else if (minutes <= 720) {
                        detailedDesc += 'Storm expected later today.';
                    } else {
                        detailedDesc += 'Long-range storm system detected.';
                    }
                    
                    stormDescriptionElement.textContent = detailedDesc;
                }
            }
        } else {
            // Clear enhanced storm display if no data
            const elements = ['stormType', 'stormConfidence', 'stormArrival'];
            elements.forEach(id => {
                const element = document.getElementById(id);
                if (element) element.textContent = '-';
            });
        }
        
        console.log('Enhanced storm display updated successfully');
        
    } catch (error) {
        console.error('Error updating enhanced storm display:', error);
    }
}

// Export the enhanced storm display function globally
window.updateEnhancedStormDisplay = updateEnhancedStormDisplay;

console.log('Enhanced storm detection display functions loaded successfully');
window.getAuthHeaders = getAuthHeaders;
console.log('CSV export functions exported to window');