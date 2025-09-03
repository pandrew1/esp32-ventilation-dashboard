// ESP32 Ventilation Dashboard JavaScript
// Extracted from dashboard.html for easier debugging and maintenance

/*
🚨 CRITICAL DEPLOYMENT REMINDER:
- This dashboard ONLY works on Azure Static Web App (has API keys)
- Local file testing WILL FAIL - no API access locally
- MUST GIT PUSH all changes before testing
- Wait 1-2 minutes after git push for Azure deployment to complete
*/

// Helper function to get API key from URL parameter (must be defined first)
function getApiKeyFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('apikey') || urlParams.get('key');
}

// Configuration - Replace with your actual Azure Function URLs
const CONFIG = {
    statusApiUrl: 'https://esp32-ventilation-api.azurewebsites.net/api/GetVentilationStatus',
    historyApiUrl: 'https://esp32-ventilation-api.azurewebsites.net/api/GetVentilationHistory',
    deviceId: 'ESP32-Ventilation-01',
    refreshInterval: 30000, // 30 seconds - check for new telemetry data
    apiSecret: null, // Will be set dynamically
    enhancedApiUrl: 'https://esp32-ventilation-api.azurewebsites.net/api/GetEnhancedDashboardData'
};

// Initialize API secret from URL parameter
function initializeApiSecret() {
    if (!CONFIG.apiSecret) {
        CONFIG.apiSecret = getApiKeyFromUrl();
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

// Authentication and API helper functions
function getAuthHeaders() {
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
}

function logout() {
    localStorage.removeItem('ventilation_auth_token');
    localStorage.removeItem('ventilation_user_email');
    window.location.href = 'login.html';
}

// Function to show API failure notifications
function showApiFailureNotice(message, type = 'warning') {
    // Remove any existing notices
    const existingNotice = document.querySelector('.api-failure-notice');
    if (existingNotice) {
        existingNotice.remove();
    }

    const header = document.querySelector('.header');
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
function updateConnectionStatus(status) {
    const statusElement = document.getElementById('connectionStatus');
    const statusText = document.getElementById('connectionStatusText');
    const statusTimestamp = document.getElementById('connectionStatusTimestamp');
    
    if (!statusElement) return;
    
    // Remove all status classes
    statusElement.classList.remove('connected', 'connecting', 'disconnected');
    
    switch(status) {
        case 'connected':
            statusElement.classList.add('connected');
            statusText.textContent = 'Connected';
            break;
        case 'connecting':
            statusElement.classList.add('connecting');
            statusText.textContent = 'Connecting...';
            break;
        case 'disconnected':
            statusElement.classList.add('disconnected');
            statusText.textContent = 'Disconnected';
            break;
    }
    
    // Update timestamp
    if (statusTimestamp) {
        const now = new Date();
        statusTimestamp.textContent = now.toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
}

// Auto-refresh functionality
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
            const token = localStorage.getItem('ventilation_auth_token');
            if (!token && CONFIG.apiSecret) {
                logout();
                return;
            } else if (token) {
                showApiFailureNotice('Status API returned 401 Unauthorized. Please check authentication or contact system administrator.', 'error');
                showNoDataState();
                updateConnectionStatus('disconnected');
                return;
            }
        }
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 404) {
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
        
        // Update dashboard with new data
        updateDashboard(data);
        
        // Monthly Data Aggregation moved to Yesterday's Report detailed view
        // console.log('RefreshData: About to call loadAggregationStatus()');
        // await loadAggregationStatus();
        
        updateConnectionStatus('connected');
        
        // Clear any existing error notices
        const apiFailureNotice = document.getElementById('apiFailureNotice');
        if (apiFailureNotice) {
            apiFailureNotice.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error refreshing dashboard data:', error);
        showApiFailureNotice(`Network error connecting to Status API: ${error.message}. Data is currently unavailable.`, 'error');
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

// Authentication and API helper functions
        function getAuthHeaders() {
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
        }

        function logout() {
            localStorage.removeItem('ventilation_auth_token');
            localStorage.removeItem('ventilation_user_email');
            window.location.href = 'login.html';
        }

        // Function to show API failure notifications
        function showApiFailureNotice(message, type = 'warning') {
            // Remove any existing notices
            const existingNotice = document.querySelector('.api-failure-notice');
            if (existingNotice) {
                existingNotice.remove();
            }

            const header = document.querySelector('.header');
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
            
            initializeDashboard();
            setupEnhancedDashboard(); // Initialize Phase 2 enhancements
        });

        // Helper function to format detailed timestamps consistently
        function formatDetailedTimestamp(date = new Date()) {
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
        }

        // Initialize dashboard
        async function initializeDashboard() {
            console.log('Initializing dashboard...');
            
            // Initialize API secret from URL parameters
            initializeApiSecret();
            
            // Clear any previous data source tracking
            if (window.dataSourceTracker) {
                window.dataSourceTracker.clearAll();
            }
            
            // Load dashboard components
            await refreshData();
            // Monthly aggregation moved to Yesterday's Report
            // await loadAggregationStatus();
            await loadChart(6); // Load 6-hour chart by default
            await loadPressureChart(6); // Load 6-hour pressure chart by default
            await loadIncidentAlmanac();
            
            // Load Enhanced API data sections (only the ones that work)
            loadYesterdaySummaryMetrics();
            updateEnhancedDoorActivity();
            updateSystemHealthWidget();
            // Note: Monthly aggregation status is handled by loadAggregationStatus() above
            
            // Start auto-refresh
            startAutoRefresh();
            
            console.log('Dashboard initialization complete');
        }

        // Enhanced Dashboard Functions for Phase 2

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

        function loadYesterdayDetailedContent() {
            // Show loading states initially for all sections
            document.getElementById('yesterdayEnvironmental').innerHTML = '<div style="text-align: center; padding: 20px; color: #666;"><em>Loading environmental data...</em></div>';
            document.getElementById('yesterdayHumidity').innerHTML = '<div style="text-align: center; padding: 20px; color: #666;"><em>Loading humidity analysis...</em></div>';
            document.getElementById('yesterdayPressure').innerHTML = '<div style="text-align: center; padding: 20px; color: #666;"><em>Loading pressure analysis...</em></div>';
            document.getElementById('yesterdayPerformance').innerHTML = '<div style="text-align: center; padding: 20px; color: #666;"><em>Loading performance metrics...</em></div>';
            document.getElementById('yesterdayVentilation').innerHTML = '<div style="text-align: center; padding: 20px; color: #666;"><em>Loading ventilation analysis...</em></div>';
            document.getElementById('yesterdayDoorTimeline').innerHTML = '<div style="text-align: center; padding: 20px; color: #666;"><em>Loading door activity...</em></div>';
            document.getElementById('yesterdayAggregation').innerHTML = '<div style="text-align: center; padding: 20px; color: #666;"><em>Loading aggregation status...</em></div>';
            document.getElementById('yesterdayIncidentSummary').innerHTML = '<div style="text-align: center; padding: 20px; color: #666;"><em>Loading incident analysis...</em></div>';
            
            // Get API key from URL (no hardcoded secrets in public repo)
            const urlParams = new URLSearchParams(window.location.search);
            const apiKey = urlParams.get('apikey') || urlParams.get('key') || '';
            
            // Check if we have any authentication method (Bearer token or API key)
            const headers = getAuthHeaders();
            const hasAuth = headers['Authorization'] || headers['X-API-Secret'];
            
            if (!hasAuth) {
                console.log('loadYesterdayDetailedContent: No authentication available - Bearer token or API key required');
                return;
            }
            
            // Call the enhanced dashboard API
            const apiUrl = 'https://esp32-ventilation-api.azurewebsites.net/api/GetEnhancedDashboardData';
            
            fetch(apiUrl, {
                method: 'GET',
                headers: headers
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(data => {
                    // Extract yesterday's data from the sections
                    const yesterdayData = data.sections && data.sections.yesterday;
                    if (!yesterdayData) {
                        throw new Error('Yesterday section not found in API response');
                    }
                    
                    // Check if this is real data or just a status message
                    if (yesterdayData.status === 'waiting_for_esp32_data') {
                        throw new Error('Real ESP32 data not yet available: ' + yesterdayData.message);
                    }
                    
                    // Load environmental data
                    if (yesterdayData.environmental) {
                        const env = yesterdayData.environmental;
                        document.getElementById('yesterdayEnvironmental').innerHTML = `
                            <div class="env-summary">
                                <p><strong>Temperature Range:</strong> ${env.tempMin}°F - ${env.tempMax}°F (Avg: ${env.tempAvg}°F)</p>
                                <p><strong>Humidity Range:</strong> ${env.humidityMin}% - ${env.humidityMax}% (Avg: ${env.humidityAvg}%)</p>
                                <p><strong>Pressure:</strong> ${env.pressureMin} - ${env.pressureMax} inHg</p>
                                <p><strong>Air Quality:</strong> ${env.airQuality}${env.aqi ? ` (AQI: ${env.aqi})` : ''}${env.aqiNote ? ` - ${env.aqiNote}` : ''}</p>
                            </div>
                        `;
                    } else {
                        document.getElementById('yesterdayEnvironmental').innerHTML = '<div class="error-state">Environmental data not available</div>';
                    }
                    
                    // Load performance data
                    if (yesterdayData.performance) {
                        const perf = yesterdayData.performance;
                        document.getElementById('yesterdayPerformance').innerHTML = `
                            <div class="perf-summary">
                                <p><strong>Efficiency:</strong> ${perf.efficiency}%</p>
                                <p><strong>Runtime:</strong> ${perf.runtime} hours</p>
                                <p><strong>Energy Usage:</strong> ${perf.energyUsage}</p>
                                <p><strong>Peak Load:</strong> ${perf.peakLoad}</p>
                            </div>
                        `;
                    } else {
                        document.getElementById('yesterdayPerformance').innerHTML = '<div class="error-state">Performance data not available</div>';
                    }
                    
                    // System assessments based on real yesterday data
                    if (yesterdayData.environmental || yesterdayData.performance || yesterdayData.incidents) {
                        const env = yesterdayData.environmental || {};
                        const perf = yesterdayData.performance || {};
                        const incidents = yesterdayData.incidents || {};
                        const doors = yesterdayData.doors || {};
                        
                        // Calculate assessment scores
                        let systemHealth = "Good";
                        let healthIcon = "✅";
                        if (incidents.totalIncidents > 5) {
                            systemHealth = "Fair";
                            healthIcon = "⚠️";
                        }
                        if (incidents.totalIncidents > 10) {
                            systemHealth = "Poor";
                            healthIcon = "❌";
                        }
                        
                        let operationalStatus = "Normal";
                        let operationalIcon = "✅";
                        if (perf.efficiency < 20) {
                            operationalStatus = "Below Average";
                            operationalIcon = "⚠️";
                        }
                        if (perf.efficiency < 10) {
                            operationalStatus = "Poor";
                            operationalIcon = "❌";
                        }
                        
                        let environmentalStatus = "Stable";
                        let envIcon = "✅";
                        const tempRange = (env.tempMax || 0) - (env.tempMin || 0);
                        if (tempRange > 15) {
                            environmentalStatus = "Variable";
                            envIcon = "⚠️";
                        }
                        if (tempRange > 25) {
                            environmentalStatus = "Extreme";
                            envIcon = "❌";
                        }
                        
                        const tempRangeText = (env.tempMax && env.tempMin) ? tempRange.toFixed(1) : 'Unknown';
                        
                        document.getElementById('yesterdayAssessments').innerHTML = `
                            <div class="assessment-summary">
                                <p><strong>${healthIcon} System Health:</strong> ${systemHealth} (${incidents.totalIncidents || 0} incidents recorded)</p>
                                <p><strong>${operationalIcon} Operational Status:</strong> ${operationalStatus} (${perf.efficiency || 0}% efficiency, ${perf.runtime || 0} hours runtime)</p>
                                <p><strong>${envIcon} Environmental Conditions:</strong> ${environmentalStatus} (${tempRangeText}°F temperature range)</p>
                                <p><strong>🚪 Door Activity:</strong> ${doors.totalEvents || 0} events across ${doors.activeDoors || 0} doors (${doors.peakActivity || 'Unknown'} activity level)</p>
                                <p><strong>🌤️ Air Quality:</strong> ${env.airQuality || 'Unknown'} conditions</p>
                            </div>
                        `;
                    } else {
                        document.getElementById('yesterdayAssessments').innerHTML = '<div class="error-state">System assessment data not available - no yesterday summary found</div>';
                    }
                    
                    // Load door timeline - get real door activity data from History API like the main timeline
                    loadYesterdayDoorActivity();
                    
                    // Load humidity analysis - use actual API structure
                    if (yesterdayData.environmental) {
                        const env = yesterdayData.environmental;
                        document.getElementById('yesterdayHumidity').innerHTML = `
                            <div class="humidity-analysis">
                                <p><strong>Yesterday's Humidity Range:</strong> ${env.humidityMin || '--'}% → ${env.humidityMax || '--'}%</p>
                                <p><strong>Average Humidity:</strong> ${env.humidityAvg || '--'}%</p>
                                <p><strong>Humidity Variation:</strong> ${env.humidityMax && env.humidityMin ? (env.humidityMax - env.humidityMin).toFixed(1) : '--'}% range</p>
                                <p><strong>Air Quality:</strong> ${env.airQuality || 'Unknown'}</p>
                                ${env.aqi ? `<p><strong>AQI:</strong> ${env.aqi}</p>` : ''}
                            </div>
                        `;
                    } else {
                        document.getElementById('yesterdayHumidity').innerHTML = '<div class="error-state">Humidity analysis not available</div>';
                    }
                    
                    // Load pressure analysis - use actual API structure  
                    if (yesterdayData.environmental) {
                        const env = yesterdayData.environmental;
                        document.getElementById('yesterdayPressure').innerHTML = `
                            <div class="pressure-analysis">
                                <p><strong>Pressure Range:</strong> ${env.pressureMin || '--'} → ${env.pressureMax || '--'} inHg</p>
                                <p><strong>Pressure Variation:</strong> ${env.pressureMax && env.pressureMin ? (env.pressureMax - env.pressureMin).toFixed(2) : '--'} inHg</p>
                                <p><strong>Weather Stability:</strong> ${env.pressureMax && env.pressureMin && (env.pressureMax - env.pressureMin) < 0.1 ? 'Stable' : 'Variable'}</p>
                                <p><strong>Storm Risk Assessment:</strong> Based on pressure trends</p>
                            </div>
                        `;
                    } else {
                        document.getElementById('yesterdayPressure').innerHTML = '<div class="error-state">Pressure analysis not available</div>';
                    }
                    
                    // Load ventilation analysis - use actual API structure
                    if (yesterdayData.performance) {
                        const perf = yesterdayData.performance;
                        document.getElementById('yesterdayVentilation').innerHTML = `
                            <div class="ventilation-analysis">
                                <p><strong>Efficiency:</strong> ${perf.efficiency || '--'}%</p>
                                <p><strong>Runtime:</strong> ${perf.runtime || '--'} hours</p>
                                <p><strong>Energy Usage:</strong> ${perf.energyUsage || 'Unknown'}</p>
                                <p><strong>Peak Load:</strong> ${perf.peakLoad || 'Unknown'}</p>
                                <p><strong>Operational Assessment:</strong> Based on runtime and efficiency metrics</p>
                            </div>
                        `;
                    } else {
                        document.getElementById('yesterdayVentilation').innerHTML = '<div class="error-state">Ventilation analysis not available</div>';
                    }
                    
                    // Load monthly aggregation status - call existing updateDashboard to get Status API data
                    loadYesterdayMonthlyAggregationFromStatusAPI();
                    
                    // Load incident summary from Status API (Enhanced API doesn't have real incident data)
                    loadYesterdayIncidentSummary();
                })
                .catch(error => {
                    console.error('Error loading yesterday detailed content:', error);
                    
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

        function loadYesterdaySummaryMetrics() {
            console.log('=== ENHANCED API: loadYesterdaySummaryMetrics() started ===');
            
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
            
            // Get API key from URL (no hardcoded secrets in public repo)
            const urlParams = new URLSearchParams(window.location.search);
            const apiKey = urlParams.get('apikey') || urlParams.get('key') || '';
            
            // Check if we have any authentication method (Bearer token or API key)
            const headers = getAuthHeaders();
            const hasAuth = headers['Authorization'] || headers['X-API-Secret'];
            
            if (!hasAuth) {
                console.log('loadYesterdaySummaryMetrics: No authentication available - Bearer token or API key required');
                return;
            }
            
            // Call the enhanced dashboard API for summary data
            const apiUrl = 'https://esp32-ventilation-api.azurewebsites.net/api/GetEnhancedDashboardData';
            
            console.log('loadYesterdaySummaryMetrics: Making API call to:', apiUrl);
            
            fetch(apiUrl, {
                method: 'GET',
                headers: headers
            })
                .then(response => {
                    console.log('loadYesterdaySummaryMetrics: Received response, status:', response.status);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('loadYesterdaySummaryMetrics: Received data:', data);
                    
                    // Extract yesterday summary data from sections
                    const yesterday = data.sections && data.sections.yesterday;
                    console.log('loadYesterdaySummaryMetrics: Yesterday section:', yesterday);
                    
                    if (yesterday && yesterday.status !== 'waiting_for_esp32_data') {
                        console.log('loadYesterdaySummaryMetrics: Yesterday data available, status:', yesterday.status);
                        console.log('loadYesterdaySummaryMetrics: Processing yesterday data');
                        console.log('loadYesterdaySummaryMetrics: Yesterday data structure:', {
                            environmental: yesterday.environmental ? 'PRESENT' : 'MISSING',
                            performance: yesterday.performance ? 'PRESENT' : 'MISSING', 
                            doors: yesterday.doors ? 'PRESENT' : 'MISSING',
                            incidents: yesterday.incidents ? 'PRESENT' : 'MISSING'
                        });
                        // Update temperature metrics
                        if (yesterday.environmental) {
                            const env = yesterday.environmental;
                            document.getElementById('yesterdayAvgTemp').textContent = `${env.tempAvg}°F`;
                            document.getElementById('yesterdayTempRange').textContent = `${env.tempMin}° - ${env.tempMax}°`;
                            document.getElementById('yesterdayTempTrend').textContent = 'Data available';
                            document.getElementById('yesterdayTempTrend').className = 'metric-trend';
                        } else {
                            document.getElementById('yesterdayAvgTemp').textContent = 'No temp data';
                            document.getElementById('yesterdayTempRange').textContent = 'No range data';
                            document.getElementById('yesterdayTempTrend').textContent = 'Missing environmental data';
                        }
                        
                        // Update efficiency metrics
                        if (yesterday.performance) {
                            const perf = yesterday.performance;
                            document.getElementById('yesterdayEfficiency').textContent = `${perf.efficiency}%`;
                            document.getElementById('yesterdayRuntime').textContent = `${perf.runtime} hrs runtime`;
                            document.getElementById('yesterdayEfficiencyTrend').textContent = 'Data available';
                            document.getElementById('yesterdayEfficiencyTrend').className = 'metric-trend';
                        } else {
                            document.getElementById('yesterdayEfficiency').textContent = 'No data';
                            document.getElementById('yesterdayRuntime').textContent = 'No runtime data';
                            document.getElementById('yesterdayEfficiencyTrend').textContent = 'Missing performance data';
                        }
                        
                        // Update door activity metrics
                        if (yesterday.doors) {
                            const doors = yesterday.doors;
                            console.log('loadYesterdaySummaryMetrics: Door data:', doors);
                            document.getElementById('yesterdayDoorsActive').textContent = `${doors.activeDoors || 0}/${doors.totalDoors || 0}`;
                            document.getElementById('yesterdaySessions').textContent = `${doors.totalEvents || 0} events`;
                            document.getElementById('yesterdayPeakTime').textContent = `Peak: ${doors.peakActivity || 'N/A'}`;
                        } else {
                            console.log('loadYesterdaySummaryMetrics: No door data in yesterday section');
                            document.getElementById('yesterdayDoorsActive').textContent = 'No door data';
                            document.getElementById('yesterdaySessions').textContent = '0 events';
                            document.getElementById('yesterdayPeakTime').textContent = 'Peak: No data';
                        }
                        
                        // Update system health metrics - use incident data with proper null handling
                        if (yesterday.incidents) {
                            const incidents = yesterday.incidents;
                            console.log('loadYesterdaySummaryMetrics: Incident data:', incidents);
                            
                            const totalIncidents = incidents.total || 0;
                            const resolvedIncidents = incidents.resolved || 0;
                            const criticalIncidents = incidents.critical || 0;
                            const pendingIncidents = incidents.pending || 0;
                            
                            // Enhanced system health calculation
                            let systemHealthScore = 100;
                            if (totalIncidents > 0) {
                                // More sophisticated health scoring based on incident severity
                                systemHealthScore = Math.max(0, 100 - (criticalIncidents * 20) - (incidents.high * 10) - (incidents.medium * 5) - (incidents.low * 2));
                            }
                            
                            document.getElementById('yesterdaySystemHealth').textContent = `${systemHealthScore}%`;
                            
                            // Enhanced incident reporting with severity breakdown
                            let incidentText = `${totalIncidents} incidents`;
                            if (totalIncidents > 0) {
                                const severityBreakdown = [];
                                if (criticalIncidents > 0) severityBreakdown.push(`${criticalIncidents} critical`);
                                if (incidents.high > 0) severityBreakdown.push(`${incidents.high} high`);
                                if (incidents.medium > 0) severityBreakdown.push(`${incidents.medium} medium`);
                                if (incidents.low > 0) severityBreakdown.push(`${incidents.low} low`);
                                
                                if (severityBreakdown.length > 0) {
                                    incidentText += ` (${severityBreakdown.join(', ')})`;
                                }
                            }
                            // Add note about data source for transparency
                            if (incidents.realDataNote) {
                                incidentText += ' ✓';
                            }
                            
                            document.getElementById('yesterdayIncidents').textContent = incidentText;
                            
                            // Better uptime calculation with fallbacks
                            let uptimeText = 'No uptime data';
                            if (incidents.uptime !== undefined && incidents.uptime !== null) {
                                uptimeText = `${incidents.uptime}% uptime`;
                            } else if (totalIncidents === 0) {
                                uptimeText = '100% uptime';
                            } else if (resolvedIncidents >= 0 && totalIncidents > 0) {
                                uptimeText = `${resolvedIncidents}/${totalIncidents} resolved`;
                            }
                            document.getElementById('yesterdayUptime').textContent = uptimeText;
                        } else {
                            // No incidents data available
                            console.log('loadYesterdaySummaryMetrics: No incident data in yesterday section');
                            document.getElementById('yesterdaySystemHealth').textContent = 'No data';
                            document.getElementById('yesterdayIncidents').textContent = 'No incident data';
                            document.getElementById('yesterdayUptime').textContent = 'No uptime data';
                        }
                    } else {
                        console.log('loadYesterdaySummaryMetrics: Yesterday data not available or waiting for ESP32 data');
                        console.log('loadYesterdaySummaryMetrics: Yesterday status:', yesterday ? yesterday.status : 'yesterday object is null/undefined');
                        
                        // Show waiting states for all metrics
                        const waitingText = 'Waiting for data';
                        
                        // Temperature metrics - check if elements exist
                        const tempAvgElement = document.getElementById('yesterdayAvgTemp');
                        const tempRangeElement = document.getElementById('yesterdayTempRange');
                        const tempTrendElement = document.getElementById('yesterdayTempTrend');
                        
                        console.log('loadYesterdaySummaryMetrics: DOM elements found:');
                        console.log('  yesterdayAvgTemp:', tempAvgElement ? 'EXISTS' : 'NULL');
                        console.log('  yesterdayTempRange:', tempRangeElement ? 'EXISTS' : 'NULL');
                        console.log('  yesterdayTempTrend:', tempTrendElement ? 'EXISTS' : 'NULL');
                        
                        if (tempAvgElement) tempAvgElement.textContent = waitingText;
                        if (tempRangeElement) tempRangeElement.textContent = waitingText;
                        if (tempTrendElement) tempTrendElement.textContent = 'Pending';
                        
                        // Efficiency metrics - check if elements exist
                        const efficiencyElement = document.getElementById('yesterdayEfficiency');
                        const runtimeElement = document.getElementById('yesterdayRuntime');
                        const efficiencyTrendElement = document.getElementById('yesterdayEfficiencyTrend');
                        
                        console.log('  yesterdayEfficiency:', efficiencyElement ? 'EXISTS' : 'NULL');
                        console.log('  yesterdayRuntime:', runtimeElement ? 'EXISTS' : 'NULL');
                        console.log('  yesterdayEfficiencyTrend:', efficiencyTrendElement ? 'EXISTS' : 'NULL');
                        
                        if (efficiencyElement) efficiencyElement.textContent = waitingText;
                        if (runtimeElement) runtimeElement.textContent = waitingText;
                        if (efficiencyTrendElement) efficiencyTrendElement.textContent = 'Pending';
                        
                        // Door activity metrics - check if elements exist
                        const doorsActiveElement = document.getElementById('yesterdayDoorsActive');
                        const sessionsElement = document.getElementById('yesterdaySessions');
                        const peakTimeElement = document.getElementById('yesterdayPeakTime');
                        
                        console.log('  yesterdayDoorsActive:', doorsActiveElement ? 'EXISTS' : 'NULL');
                        console.log('  yesterdaySessions:', sessionsElement ? 'EXISTS' : 'NULL');
                        console.log('  yesterdayPeakTime:', peakTimeElement ? 'EXISTS' : 'NULL');
                        
                        if (doorsActiveElement) doorsActiveElement.textContent = waitingText;
                        if (sessionsElement) sessionsElement.textContent = waitingText;
                        if (peakTimeElement) peakTimeElement.textContent = 'Pending';
                        
                        // System health metrics - check if elements exist
                        const systemHealthElement = document.getElementById('yesterdaySystemHealth');
                        const incidentsElement = document.getElementById('yesterdayIncidents');
                        const uptimeElement = document.getElementById('yesterdayUptime');
                        
                        console.log('  yesterdaySystemHealth:', systemHealthElement ? 'EXISTS' : 'NULL');
                        console.log('  yesterdayIncidents:', incidentsElement ? 'EXISTS' : 'NULL');
                        console.log('  yesterdayUptime:', uptimeElement ? 'EXISTS' : 'NULL');
                        
                        if (systemHealthElement) systemHealthElement.textContent = waitingText;
                        if (incidentsElement) incidentsElement.textContent = waitingText;
                        if (uptimeElement) uptimeElement.textContent = 'Pending';
                        
                        console.log('loadYesterdaySummaryMetrics: Set all yesterday metrics to waiting state');
                    }
                })
                .catch(error => {
                    console.error('loadYesterdaySummaryMetrics: Error loading data:', error);
                    
                    // Show error state for all metrics
                    const errorText = 'Error';
                    
                    // Temperature metrics
                    document.getElementById('yesterdayAvgTemp').textContent = errorText;
                    document.getElementById('yesterdayTempRange').textContent = 'Failed to load';
                    document.getElementById('yesterdayTempTrend').textContent = 'No data';
                    document.getElementById('yesterdayTempTrend').className = 'metric-trend';
                    
                    // Efficiency metrics
                    document.getElementById('yesterdayEfficiency').textContent = errorText;
                    document.getElementById('yesterdayRuntime').textContent = 'Failed to load';
                    document.getElementById('yesterdayEfficiencyTrend').textContent = 'No data';
                    document.getElementById('yesterdayEfficiencyTrend').className = 'metric-trend';
                    
                    // Door activity metrics
                    document.getElementById('yesterdayDoorsActive').textContent = errorText;
                    document.getElementById('yesterdaySessions').textContent = 'Failed to load';
                    document.getElementById('yesterdayPeakTime').textContent = 'No data';
                    
                    // System health metrics
                    document.getElementById('yesterdaySystemHealth').textContent = errorText;
                    document.getElementById('yesterdayIncidents').textContent = 'Failed to load';
                    document.getElementById('yesterdayUptime').textContent = 'No data';
                });
        }

        function updateEnhancedDoorActivity() {
            console.log('=== DOOR ACTIVITY CENTER: updateEnhancedDoorActivity() started - using real data ===');
            
            // Show loading states
            document.getElementById('activeDoorsCount').textContent = '...';
            document.getElementById('totalSessionsCount').textContent = '...';
            document.getElementById('lastActivityTime').textContent = 'Loading...';
            
            document.getElementById('firstActivityStat').textContent = 'Loading...';
            document.getElementById('peakHourStat').textContent = 'Loading...';
            document.getElementById('totalSessionsStat').textContent = 'Loading...';
            
            // Check if we have any authentication method (Bearer token or API key)  
            const headers = getAuthHeaders();
            const hasAuth = headers['Authorization'] || headers['X-API-Secret'];
            
            if (!hasAuth) {
                console.log('updateEnhancedDoorActivity: No authentication available - Bearer token or API key required');
                return;
            }
            
            // Use GetVentilationHistory API (same as Activity Timeline) for real door data
            const apiUrl = 'https://esp32-ventilation-api.azurewebsites.net/api/GetVentilationHistory?deviceId=ESP32-Ventilation-01&hours=24';
            
            console.log('updateEnhancedDoorActivity: Making API call to:', apiUrl);
            
            fetch(apiUrl, {
                method: 'GET',
                headers: headers
            })
                .then(response => {
                    console.log('updateEnhancedDoorActivity: Received response, status:', response.status);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('updateEnhancedDoorActivity: Received history data:', data);
                    
                    // Process door data same way as Activity Timeline
                    const doorEvents = [];
                    const doorNames = new Set();
                    const todaysOpenings = new Set(); // Track unique door opening sessions
                    const hourlyActivity = {}; // Track activity by hour
                    
                    let latestActivity = null;
                    let earliestActivity = null;
                    
                    if (data.data && Array.isArray(data.data)) {
                        data.data.forEach(record => {
                            if (record.doors && Array.isArray(record.doors)) {
                                record.doors.forEach(door => {
                                    doorNames.add(door.name);
                                    
                                    // Track current open doors
                                    if (door.openedAt) {
                                        const openTimestamp = parseInt(door.openedAt);
                                        const openTime = new Date(openTimestamp * 1000);
                                        const hour = openTime.getHours();
                                        
                                        doorEvents.push({
                                            timestamp: openTimestamp,
                                            door: door.name,
                                            action: 'opened'
                                        });
                                        
                                        // Update latest/earliest activity
                                        if (!latestActivity || openTimestamp > latestActivity) {
                                            latestActivity = openTimestamp;
                                        }
                                        if (!earliestActivity || openTimestamp < earliestActivity) {
                                            earliestActivity = openTimestamp;
                                        }
                                        
                                        // Count hourly activity
                                        hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
                                    }
                                    
                                    // Track today's openings for session count
                                    if (door.firstOpenedToday) {
                                        todaysOpenings.add(`${door.name}-${door.firstOpenedToday}`);
                                    }
                                    if (door.lastOpenedToday && door.lastOpenedToday !== door.firstOpenedToday) {
                                        todaysOpenings.add(`${door.name}-${door.lastOpenedToday}`);
                                    }
                                });
                            }
                        });
                    }
                    
                    console.log('updateEnhancedDoorActivity: Processed door events:', {
                        totalEvents: doorEvents.length,
                        uniqueDoors: doorNames.size,
                        todaysSessions: todaysOpenings.size,
                        latestActivity: latestActivity,
                        earliestActivity: earliestActivity
                    });
                    
                    // Update Door Activity Center with real calculated data
                    if (doorEvents.length > 0) {
                        console.log('updateEnhancedDoorActivity: Displaying real door activity data');
                        
                        // Calculate peak activity hour
                        const peakHour = Object.keys(hourlyActivity).reduce((a, b) => 
                            hourlyActivity[a] > hourlyActivity[b] ? a : b
                        );
                        const peakHourFormatted = `${peakHour}:00-${parseInt(peakHour)+1}:00`;
                        
                        // Update main door activity stats
                        document.getElementById('activeDoorsCount').textContent = doorNames.size;
                        document.getElementById('totalSessionsCount').textContent = todaysOpenings.size;
                        
                        // Format last activity time
                        const lastActivityDate = new Date(latestActivity * 1000);
                        const lastActivityFormatted = lastActivityDate.toLocaleString([], {
                            month: 'short', day: 'numeric', 
                            hour: '2-digit', minute: '2-digit'
                        });
                        document.getElementById('lastActivityTime').textContent = lastActivityFormatted;
                        
                        // Update detailed stats in summary section
                        const firstActivityDate = new Date(earliestActivity * 1000);
                        const firstActivityFormatted = firstActivityDate.toLocaleString([], {
                            month: 'short', day: 'numeric', 
                            hour: '2-digit', minute: '2-digit'
                        });
                        
                        document.getElementById('firstActivityStat').textContent = `First: ${firstActivityFormatted}`;
                        document.getElementById('peakHourStat').textContent = `Peak: ${peakHourFormatted}`;
                        document.getElementById('totalSessionsStat').textContent = `${todaysOpenings.size} sessions`;
                        
                        console.log('updateEnhancedDoorActivity: Updated Door Activity Center with real data:', {
                            activeDoors: doorNames.size,
                            totalSessions: todaysOpenings.size,
                            lastActivity: lastActivityFormatted,
                            firstActivity: firstActivityFormatted,
                            peakHour: peakHourFormatted
                        });
                        
                    } else {
                        console.log('updateEnhancedDoorActivity: No door activity events found - showing honest message');
                        
                        // Update with honest "no data" message
                        document.getElementById('activeDoorsCount').textContent = '0';
                        document.getElementById('totalSessionsCount').textContent = '0';
                        document.getElementById('lastActivityTime').textContent = 'No recent activity';
                        
                        document.getElementById('firstActivityStat').textContent = 'No data';
                        document.getElementById('peakHourStat').textContent = 'No data';
                        document.getElementById('totalSessionsStat').textContent = '0 sessions';
                    }
                })
                .catch(error => {
                    console.error('updateEnhancedDoorActivity: Error:', error);
                    
                    // Show error state
                    document.getElementById('activeDoorsCount').textContent = 'Error';
                    document.getElementById('totalSessionsCount').textContent = 'Error';
                    document.getElementById('lastActivityTime').textContent = 'Data unavailable';
                    
                    document.getElementById('firstActivityStat').textContent = 'Error loading';
                    document.getElementById('peakHourStat').textContent = 'Error loading';
                    document.getElementById('totalSessionsStat').textContent = 'Error loading';
                });
        }

        function updateSystemHealthWidget() {
            console.log('=== ENHANCED API: updateSystemHealthWidget() started ===');
            
            // Show loading states with null checks for simplified health metrics
            const healthUptime = document.getElementById('healthUptime');
            const healthWifi = document.getElementById('healthWifi'); 
            const healthErrors = document.getElementById('healthErrors');
            const lastBootInfo = document.getElementById('lastBootInfo');
            
            if (healthUptime) healthUptime.textContent = 'Loading...';
            if (healthWifi) healthWifi.textContent = 'Loading...';
            if (healthErrors) healthErrors.textContent = 'Loading...';
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
            
            // Call the enhanced dashboard API for system health data
            const apiUrl = 'https://esp32-ventilation-api.azurewebsites.net/api/GetEnhancedDashboardData';
            
            console.log('updateSystemHealthWidget: Making API call to:', apiUrl);
            
            fetch(apiUrl, {
                method: 'GET',
                headers: headers
            })
                .then(response => {
                    console.log('updateSystemHealthWidget: Received response, status:', response.status);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('updateSystemHealthWidget: Received data:', data);
                    
                    // Extract startup data from sections - correct API structure
                    const startup = data.sections && data.sections.startup;
                    console.log('updateSystemHealthWidget: Startup section:', startup);
                    
                    if (startup) {
                        console.log('updateSystemHealthWidget: Processing startup data');
                        console.log('updateSystemHealthWidget: Startup hardware:', startup.hardware);
                        console.log('updateSystemHealthWidget: Startup system:', startup.system);
                        
                        // Update simplified health metrics with null checks using actual API fields
                        const healthUptime = document.getElementById('healthUptime');
                        const healthWifi = document.getElementById('healthWifi'); 
                        const healthErrors = document.getElementById('healthErrors');
                        const lastBootInfo = document.getElementById('lastBootInfo');
                        const bootReasonInfo = document.getElementById('bootReasonInfo');
                        
                        // Map API response fields to display elements
                        if (healthUptime) {
                            // Calculate actual uptime from boot time instead of trusting ESP32's uptime value
                            if (startup.bootTime) {
                                const bootTimestamp = parseInt(startup.bootTime);
                                const currentTimestamp = Math.floor(Date.now() / 1000);
                                const actualUptimeMinutes = Math.floor((currentTimestamp - bootTimestamp) / 60);
                                
                                const hours = Math.floor(actualUptimeMinutes / 60);
                                const minutes = actualUptimeMinutes % 60;
                                
                                console.log('updateSystemHealthWidget: Uptime calculation:', {
                                    bootTimestamp: bootTimestamp,
                                    currentTimestamp: currentTimestamp,
                                    reportedUptime: startup.uptime,
                                    calculatedUptimeMinutes: actualUptimeMinutes,
                                    display: `${hours}h ${minutes}m`
                                });
                                
                                healthUptime.textContent = `${hours}h ${minutes}m`;
                            } else {
                                // Fallback to ESP32's reported uptime if no boot time available
                                const uptimeMinutes = startup.uptime || 0;
                                const hours = Math.floor(uptimeMinutes / 60);
                                const minutes = uptimeMinutes % 60;
                                healthUptime.textContent = `${hours}h ${minutes}m`;
                            }
                        }
                        
                        if (healthWifi) {
                            // Use signal strength from system data with quality indicator
                            const signalStrength = startup.system?.signalStrength;
                            if (signalStrength) {
                                let signalQuality = 'Excellent';
                                if (signalStrength < -70) signalQuality = 'Poor';
                                else if (signalStrength < -60) signalQuality = 'Fair'; 
                                else if (signalStrength < -50) signalQuality = 'Good';
                                
                                healthWifi.textContent = `${signalStrength} dBm`;
                                healthWifi.title = `WiFi Signal: ${signalQuality} (${signalStrength} dBm)\nRange: Excellent > -50, Good > -60, Fair > -70, Poor < -70`;
                            } else {
                                healthWifi.textContent = 'Unknown';
                                healthWifi.title = 'WiFi signal strength unavailable';
                            }
                        }
                        
                        if (healthErrors) {
                            // Calculate memory usage percentage from system data with details
                            const freeHeap = startup.system?.freeHeap;
                            const heapSize = startup.system?.heapSize;
                            if (freeHeap && heapSize) {
                                const memoryUsed = Math.round(((heapSize - freeHeap) / heapSize) * 100);
                                const freeKB = Math.round(freeHeap / 1024);
                                const totalKB = Math.round(heapSize / 1024);
                                
                                healthErrors.textContent = `${memoryUsed}%`;
                                healthErrors.title = `Memory Usage: ${memoryUsed}% used\nFree: ${freeKB} KB of ${totalKB} KB total\nESP32 RAM utilization`;
                                
                                // Change color based on memory usage
                                if (memoryUsed > 80) {
                                    healthErrors.style.color = '#dc2626'; // Red
                                } else if (memoryUsed > 60) {
                                    healthErrors.style.color = '#ea580c'; // Orange  
                                } else {
                                    healthErrors.style.color = '#16a34a'; // Green
                                }
                            } else {
                                healthErrors.textContent = 'Unknown';
                                healthErrors.title = 'Memory usage information unavailable';
                            }
                        }
                        
                        if (lastBootInfo) {
                            // Format boot time from timestamp
                            if (startup.bootTime) {
                                const bootDate = new Date(parseInt(startup.bootTime) * 1000);
                                lastBootInfo.textContent = bootDate.toLocaleString();
                            } else {
                                lastBootInfo.textContent = 'Boot time unavailable';
                            }
                        }
                        
                        if (bootReasonInfo) {
                            // Use bootReason field (not boot_reason)
                            bootReasonInfo.textContent = `Reason: ${startup.bootReason || 'Unknown'}`;
                        }
                        
                        // Update System Specifications elements
                        const chipModel = document.getElementById('chipModel');
                        const cpuFreq = document.getElementById('cpuFreq');
                        const flashSize = document.getElementById('flashSize');
                        const freeHeap = document.getElementById('freeHeap');
                        const wifiIP = document.getElementById('wifiIP');
                        const macAddress = document.getElementById('macAddress');
                        
                        if (chipModel) chipModel.textContent = startup.system?.chipModel || 'Unknown';
                        if (cpuFreq) cpuFreq.textContent = startup.system?.cpuFreq ? `${startup.system.cpuFreq} MHz` : 'Unknown';
                        if (flashSize) flashSize.textContent = startup.system?.flashSize ? `${Math.round(startup.system.flashSize / (1024 * 1024))} MB` : 'Unknown';
                        if (freeHeap) freeHeap.textContent = startup.system?.freeHeap ? `${Math.round(startup.system.freeHeap / 1024)} KB` : 'Unknown';
                        if (wifiIP) wifiIP.textContent = startup.system?.wifiIP || 'Unknown';
                        if (macAddress) macAddress.textContent = startup.system?.macAddress || 'Unknown';
                        
                        // Update Hardware Status elements
                        const displayStatus = document.getElementById('displayStatus');
                        const sensorStatus = document.getElementById('sensorStatus');
                        
                        if (displayStatus) displayStatus.textContent = startup.hardware?.display ? 'OK' : 'Error';
                        if (sensorStatus) {
                            // Count working sensors
                            const workingSensors = [
                                startup.hardware?.indoorBME,
                                startup.hardware?.outdoorBME,
                                startup.hardware?.garageBME
                            ].filter(Boolean).length;
                            sensorStatus.textContent = `${workingSensors}/3 OK`;
                        }
                        
                        // Note: Relay and Watchdog status are updated in updateDashboard() function
                        // to avoid conflicts with the more detailed status display
                        
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
                        // Handle case where startup data is not available
                        const healthUptime = document.getElementById('healthUptime');
                        const healthWifi = document.getElementById('healthWifi'); 
                        const healthErrors = document.getElementById('healthErrors');
                        const lastBootInfo = document.getElementById('lastBootInfo');
                        const bootReasonInfo = document.getElementById('bootReasonInfo');
                        
                        if (healthUptime) healthUptime.textContent = 'Waiting...';
                        if (healthWifi) healthWifi.textContent = 'Waiting...';
                        if (healthErrors) healthErrors.textContent = 'Waiting...';
                        if (lastBootInfo) lastBootInfo.textContent = 'Boot information pending';
                        if (bootReasonInfo) bootReasonInfo.textContent = 'Reason: Pending';
                        
                        // Handle System Specifications waiting states
                        const chipModel = document.getElementById('chipModel');
                        const cpuFreq = document.getElementById('cpuFreq');
                        const flashSize = document.getElementById('flashSize');
                        const freeHeap = document.getElementById('freeHeap');
                        const wifiIP = document.getElementById('wifiIP');
                        const macAddress = document.getElementById('macAddress');
                        
                        if (chipModel) chipModel.textContent = 'Waiting...';
                        if (cpuFreq) cpuFreq.textContent = 'Waiting...';
                        if (flashSize) flashSize.textContent = 'Waiting...';
                        if (freeHeap) freeHeap.textContent = 'Waiting...';
                        if (wifiIP) wifiIP.textContent = 'Waiting...';
                        if (macAddress) macAddress.textContent = 'Waiting...';
                        
                        // Handle Hardware Status waiting states
                        const displayStatus = document.getElementById('displayStatus');
                        const sensorStatus = document.getElementById('sensorStatus');
                        const relayStatus = document.getElementById('relayStatus');
                        const watchdogStatus = document.getElementById('watchdogStatus');
                        
                        if (displayStatus) displayStatus.textContent = 'Waiting...';
                        if (sensorStatus) sensorStatus.textContent = 'Waiting...';
                        if (relayStatus) relayStatus.textContent = 'Unknown';
                        if (watchdogStatus) watchdogStatus.textContent = 'Unknown';
                    }
                })
                .catch(error => {
                    console.error('updateSystemHealthWidget: Error loading system health data:', error);
                    
                    // Show error states with null checks
                    const healthUptime = document.getElementById('healthUptime');
                    const healthWifi = document.getElementById('healthWifi'); 
                    const healthErrors = document.getElementById('healthErrors');
                    const lastBootInfo = document.getElementById('lastBootInfo');
                    const bootReasonInfo = document.getElementById('bootReasonInfo');
                    
                    if (healthUptime) healthUptime.textContent = 'Error';
                    if (healthWifi) healthWifi.textContent = 'Error';
                    if (healthErrors) healthErrors.textContent = 'Error';
                    if (lastBootInfo) lastBootInfo.textContent = 'Boot information unavailable';
                    if (bootReasonInfo) bootReasonInfo.textContent = 'Reason: Data not available';
                    
                    // Handle System Specifications error states
                    const chipModel = document.getElementById('chipModel');
                    const cpuFreq = document.getElementById('cpuFreq');
                    const flashSize = document.getElementById('flashSize');
                    const freeHeap = document.getElementById('freeHeap');
                    const wifiIP = document.getElementById('wifiIP');
                    const macAddress = document.getElementById('macAddress');
                    
                    if (chipModel) chipModel.textContent = 'Error';
                    if (cpuFreq) cpuFreq.textContent = 'Error';
                    if (flashSize) flashSize.textContent = 'Error';
                    if (freeHeap) freeHeap.textContent = 'Error';
                    if (wifiIP) wifiIP.textContent = 'Error';
                    if (macAddress) macAddress.textContent = 'Error';
                    
                    // Handle System Configuration error state - FIX for stuck "Loading configuration..."
                    const systemConfigElement = document.getElementById('systemConfig');
                    if (systemConfigElement) systemConfigElement.textContent = 'Configuration unavailable';
                    
                    // Handle Hardware Status error states
                    const displayStatus = document.getElementById('displayStatus');
                    const sensorStatus = document.getElementById('sensorStatus');
                    const relayStatus = document.getElementById('relayStatus');
                    const watchdogStatus = document.getElementById('watchdogStatus');
                    
                    if (displayStatus) displayStatus.textContent = 'Error';
                    if (sensorStatus) sensorStatus.textContent = 'Error';
                    if (relayStatus) relayStatus.textContent = 'Unknown';
                    if (watchdogStatus) watchdogStatus.textContent = 'Unknown';
                    
                    // Show error state in gauge
                    updateSystemHealthGauge(0);
                });
            
            // Update health gauge percentage
            const gauge = document.querySelector('.gauge-container');
            if (gauge) {
                gauge.style.setProperty('--health-percentage', '98%');
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
            
            // Call the ventilation history API for door timeline data
            const apiUrl = `https://esp32-ventilation-api.azurewebsites.net/api/GetVentilationHistory?deviceId=ESP32-Ventilation-01&hours=${hours}`;
            
            console.log('TIMELINE: Making API call to:', apiUrl);
            
            fetch(apiUrl, {
                method: 'GET',
                headers: headers
            })
                .then(response => {
                    console.log('TIMELINE: Received response, status:', response.status);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(data => {
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
                                    const eventKey = `${transition.timestamp}-door-${transition.doorId}-${transition.opened ? 'open' : 'close'}`;
                                    if (!uniqueEvents.has(eventKey)) {
                                        const event = {
                                            timestamp: transition.timestamp,
                                            door: transition.doorName || `Door ${transition.doorId}`,
                                            action: transition.opened ? 'opened' : 'closed',
                                            duration: 0,
                                            source: 'transition'
                                        };
                                        uniqueEvents.set(eventKey, event);
                                        console.log(`    Added door transition: ${event.door} ${event.action} at ${transition.timestamp}`);
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
                    console.error('TIMELINE ERROR: Failed to load timeline data:', error);
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

        async function loadYesterdayDoorActivity() {
            console.log('=== YESTERDAY DOOR ACTIVITY: loadYesterdayDoorActivity() started ===');
            
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
                
                // Get door activity data from History API (24 hours = yesterday)
                const apiUrl = 'https://esp32-ventilation-api.azurewebsites.net/api/GetVentilationHistory?deviceId=ESP32-Ventilation-01&hours=24';
                
                const response = await fetch(apiUrl, { 
                    method: 'GET', 
                    headers: headers 
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                
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
                
                historyData.forEach(entry => {
                    // Check for doors array (door status data) - doors are objects, not strings
                    if (entry.doors && Array.isArray(entry.doors)) {
                        entry.doors.forEach(door => {
                            // Door data comes as objects with properties like {id: 2, name: "D2 (House Hinge)", wasOpenedToday: true, ...}
                            if (door.name && door.wasOpenedToday === true) {
                                const doorName = door.name.trim();
                                doorActivityStats.activeDoors.add(doorName);
                                doorEvents.push({
                                    door: doorName,
                                    status: 'active',
                                    timestamp: entry.timestamp,
                                    type: 'daily_activity'
                                });
                            }
                        });
                    }
                    
                    // Check for doorTransitions array (actual door events)  
                    if (entry.doorTransitions && Array.isArray(entry.doorTransitions)) {
                        entry.doorTransitions.forEach(transition => {
                            // Transition data comes as objects with properties like {doorId: 2, doorName: "D2 (House Hinge)", opened: true, ...}
                            if (transition.doorName) {
                                const doorName = transition.doorName.trim();
                                const opened = transition.opened === true;
                                
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
                yesterdayElement.innerHTML = `
                    <div class="door-summary">
                        <p><strong>Active Doors:</strong> ${doorActivityStats.activeDoors.size} detected</p>
                        <p><strong>Total Events:</strong> ${doorActivityStats.totalEvents}</p>
                        <p><strong>Peak Activity:</strong> ${peakActivity}</p>
                        <p><strong>Most Active:</strong> ${doorActivityStats.mostActiveDoor}</p>
                    </div>
                `;
                
                console.log(`YESTERDAY DOOR ACTIVITY: Found ${doorActivityStats.totalEvents} events, ${doorActivityStats.activeDoors.size} active doors`);
                
            } catch (error) {
                console.error('Error loading yesterday door activity:', error);
                yesterdayElement.innerHTML = '<div class="error-state">Failed to load door activity data</div>';
            }
        }

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
                    
                    // Format timestamps (same function as updateDashboard)
                    const formatDateTime = (isoString) => {
                        if (!isoString) return 'Unknown';
                        try {
                            const date = new Date(isoString);
                            return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
                        } catch (e) {
                            return 'Invalid date';
                        }
                    };
                    
                    const statusIcon = agg.Success ? '✅' : '❌';
                    const statusText = agg.Success ? 'Successful' : 'Failed';
                    const errorText = agg.ErrorMessage ? ` (${agg.ErrorMessage})` : '';
                    
                    // Use exact same HTML as updateDashboard function
                    aggregationElement.innerHTML = `
                        <div class="aggregation-status-detail">
                            <p><strong>Status:</strong> ${statusIcon} ${statusText}${errorText}</p>
                            <p><strong>Last Run:</strong> ${formatDateTime(agg.LastRun)}</p>
                            <p><strong>Next Run:</strong> ${formatDateTime(agg.NextScheduledRun)}</p>
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
            
            // Format timestamps with helper function
            const formatDateTime = (isoString) => {
                if (!isoString) return 'Unknown';
                try {
                    const date = new Date(isoString);
                    return date.toLocaleString();
                } catch (e) {
                    return 'Invalid date';
                }
            };
            
            // Update all elements with null checks
            if (lastRunElement) lastRunElement.textContent = formatDateTime(status.LastRun);
            if (recordsUpdatedElement) recordsUpdatedElement.textContent = status.RecordsUpdated || 'Unknown';
            if (nextRunElement) nextRunElement.textContent = formatDateTime(status.NextScheduledRun);
        }

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
                
                // Update dashboard with new data
                updateDashboard(data);
                updateConnectionStatus('connected');

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
                console.error('Error refreshing dashboard data:', error);
                showApiFailureNotice(`Network error connecting to Status API: ${error.message}. Data is currently unavailable.`, 'error');
                showNoDataState();
                updateConnectionStatus('disconnected');
            }
        }

        function showNoDataState() {
            // Hide loading, show content with no data message
            document.getElementById('loadingSection').style.display = 'none';
            document.getElementById('errorSection').style.display = 'none';
            document.getElementById('dashboardContent').style.display = 'block';

            // Set all sensor readings to "No data"
            document.getElementById('indoorTemp').textContent = 'No data';
            document.getElementById('indoorHumidity').textContent = 'No data';
            document.getElementById('indoorPressure').textContent = 'No data';
            document.getElementById('outdoorTemp').textContent = 'No data';
            document.getElementById('outdoorHumidity').textContent = 'No data';
            document.getElementById('outdoorPressure').textContent = 'No data';
            document.getElementById('garageTemp').textContent = 'No data';
            document.getElementById('garageHumidity').textContent = 'No data';
            document.getElementById('garagePressure').textContent = 'No data';

            // Set system status to no data
            document.getElementById('fanStatus').textContent = '❓';
            document.getElementById('fanStatus').className = 'fan-status';
            document.getElementById('fanStatusText').textContent = 'No data';
            document.getElementById('ventilationMode').textContent = 'No data';
            document.getElementById('fanMinutes').textContent = 'No data';
            document.getElementById('freshAirStatus').textContent = 'No data';
            document.getElementById('ventilationHours').textContent = 'No data';
            document.getElementById('coolingEffect').textContent = 'No data';

            // Set weather to no data
            document.getElementById('forecastHigh').textContent = 'No data';
            document.getElementById('stormRisk').textContent = 'No data';
            document.getElementById('stormRiskExplanation').textContent = 'Storm risk status will be explained here.';
            
            // Set enhanced forecast to no data
            const forecastHumidityElement = document.getElementById('forecastHumidity');
            if (forecastHumidityElement) forecastHumidityElement.textContent = 'No data';
            const forecastPrecipitationElement = document.getElementById('forecastPrecipitation');
            if (forecastPrecipitationElement) forecastPrecipitationElement.textContent = 'No data';

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

        function updateDashboard(data) {
            // Hide loading, show content
            document.getElementById('loadingSection').style.display = 'none';
            document.getElementById('errorSection').style.display = 'none';
            document.getElementById('dashboardContent').style.display = 'block';

            // Update sensors with proper null/undefined handling
            const sensors = data.sensors || {};
            const indoor = sensors.indoor || {};
            const outdoor = sensors.outdoor || {};
            const garage = sensors.garage || {};
            
            document.getElementById('indoorTemp').textContent = indoor.temp != null ? `${indoor.temp.toFixed(1)}°F` : 'No data';
            document.getElementById('indoorHumidity').textContent = indoor.humidity != null ? `${indoor.humidity.toFixed(0)}%` : 'No data';
            document.getElementById('indoorPressure').textContent = indoor.pressure != null ? `${indoor.pressure.toFixed(2)} inHg` : 'No data';
            
            document.getElementById('outdoorTemp').textContent = outdoor.temp != null ? `${outdoor.temp.toFixed(1)}°F` : 'No data';
            document.getElementById('outdoorHumidity').textContent = outdoor.humidity != null ? `${outdoor.humidity.toFixed(0)}%` : 'No data';
            document.getElementById('outdoorPressure').textContent = outdoor.pressure != null ? `${outdoor.pressure.toFixed(2)} inHg` : 'No data';
            
            document.getElementById('garageTemp').textContent = garage.temp != null ? `${garage.temp.toFixed(1)}°F` : 'No data';
            document.getElementById('garageHumidity').textContent = garage.humidity != null ? `${garage.humidity.toFixed(0)}%` : 'No data';
            document.getElementById('garagePressure').textContent = garage.pressure != null ? `${garage.pressure.toFixed(2)} inHg` : 'No data';

            // Update system status with proper null/undefined handling
            const system = data.system || {};
            const fanOn = system.fanOn;
            
            if (fanOn != null) {
                document.getElementById('fanStatus').textContent = fanOn ? '🌀' : '⏸️';
                document.getElementById('fanStatus').className = `fan-status ${fanOn ? 'fan-on' : 'fan-off'}`;
                document.getElementById('fanStatusText').textContent = fanOn ? 'RUNNING' : 'STOPPED';
            } else {
                document.getElementById('fanStatus').textContent = '❓';
                document.getElementById('fanStatus').className = 'fan-status';
                document.getElementById('fanStatusText').textContent = 'No data';
            }
            
            document.getElementById('ventilationMode').textContent = system.ventilationMode || 'No data';
            document.getElementById('fanMinutes').textContent = system.fanMinutesToday != null ? system.fanMinutesToday : 'No data';
            document.getElementById('freshAirStatus').textContent = system.freshAirActive != null ? (system.freshAirActive ? 'Active' : 'Inactive') : 'No data';
            document.getElementById('ventilationHours').textContent = system.operatingHours || 'No data';
            
            // Calculate and display cooling effect
            const coolingEffect = calculateCoolingEffect(
                indoor.temp, 
                outdoor.temp, 
                system.fanMinutesToday, 
                fanOn
            );
            document.getElementById('coolingEffect').textContent = coolingEffect;

            // Update weather with proper null/undefined handling
            const weather = data.weather || {};
            const stormRiskValue = weather.stormRisk || 'No data';
            document.getElementById('forecastHigh').textContent = weather.forecastHigh != null ? `${weather.forecastHigh.toFixed(0)}°F` : 'No data';
            document.getElementById('stormRisk').textContent = stormRiskValue;
            
            // Enhanced forecast data display (PHASE 1)
            const enhancedForecast = weather.enhancedForecast;
            if (enhancedForecast && enhancedForecast.valid) {
                // Update humidity forecast (could add new dashboard element)
                const humidityElement = document.getElementById('forecastHumidity');
                if (humidityElement) {
                    humidityElement.textContent = `${enhancedForecast.humidity.toFixed(0)}% (Forecast)`;
                }
                
                // Update precipitation forecast (could add new dashboard element) 
                const precipElement = document.getElementById('forecastPrecipitation');
                if (precipElement) {
                    precipElement.textContent = `${enhancedForecast.precipitationProb.toFixed(0)}% (Forecast)`;
                }
                
                // Enhanced storm risk explanation with more detailed forecast data
                const stormRiskExplanation = document.getElementById('stormRiskExplanation');
                if (stormRiskExplanation) {
                    let explanation = '';
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
                    stormRiskExplanation.textContent = explanation;
                }
            } else {
                // Fallback to basic explanation when enhanced forecast not available
                const stormRiskExplanation = document.getElementById('stormRiskExplanation');
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
            }
            
            // PHASE 2: Pacific NW Comfort Intelligence Display
            const comfortIntelligence = weather.comfortIntelligence;
            if (comfortIntelligence && comfortIntelligence.valid) {
                // Update comfort score with color coding
                const comfortScoreElement = document.getElementById('comfort-score');
                if (comfortScoreElement && comfortIntelligence.comfortIndex != null) {
                    const score = comfortIntelligence.comfortIndex.toFixed(1);
                    comfortScoreElement.textContent = `${score}/10`;
                    
                    // Color code the comfort score
                    if (comfortIntelligence.comfortIndex >= 8.0) {
                        comfortScoreElement.style.color = '#4CAF50'; // Excellent - Green
                    } else if (comfortIntelligence.comfortIndex >= 6.5) {
                        comfortScoreElement.style.color = '#2196F3'; // Good - Blue
                    } else if (comfortIntelligence.comfortIndex >= 5.0) {
                        comfortScoreElement.style.color = '#FF9800'; // Fair - Orange
                    } else {
                        comfortScoreElement.style.color = '#F44336'; // Poor - Red
                    }
                }
                
                // Update fog risk with color coding
                const fogRiskElement = document.getElementById('fog-risk');
                if (fogRiskElement && comfortIntelligence.fogRisk != null) {
                    const fogRisk = comfortIntelligence.fogRisk.toFixed(0);
                    fogRiskElement.textContent = `${fogRisk}%`;
                    
                    // Color code fog risk
                    if (comfortIntelligence.fogRisk >= 70) {
                        fogRiskElement.style.color = '#F44336'; // High - Red
                    } else if (comfortIntelligence.fogRisk >= 40) {
                        fogRiskElement.style.color = '#FF9800'; // Medium - Orange
                    } else {
                        fogRiskElement.style.color = '#4CAF50'; // Low - Green
                    }
                }
                
                // Update marine layer status
                const marineLayerElement = document.getElementById('marine-layer');
                if (marineLayerElement) {
                    const marineStatus = comfortIntelligence.marineLayerActive ? 'Active' : 'Clear';
                    marineLayerElement.textContent = marineStatus;
                    marineLayerElement.style.color = comfortIntelligence.marineLayerActive ? '#2196F3' : '#4CAF50';
                }
                
                // Update ventilation window recommendation
                const ventilationWindowElement = document.getElementById('ventilation-window');
                if (ventilationWindowElement && comfortIntelligence.ventilationWindow) {
                    ventilationWindowElement.textContent = comfortIntelligence.ventilationWindow;
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
            const uptimeHours = system.uptime != null ? Math.floor(system.uptime / 3600) : null;
            const uptimeElement = document.getElementById('uptime');
            if (uptimeElement) uptimeElement.textContent = uptimeHours != null ? `${uptimeHours}h` : 'No data';

            // Update reliability statistics with proper null/undefined handling (only elements that still exist)
            const reliability = data.reliability || {};
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
            const uptimeMinutes = reliability.uptimeMinutes != null ? reliability.uptimeMinutes : (system.uptime != null ? system.uptime : null);
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
            if (data.sections && data.sections.startup) {
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
                    const flashMB = startupSystem.flashSize ? Math.round(startupSystem.flashSize / 1024 / 1024) : null;
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
                if (relayStatusElement) relayStatusElement.textContent = system.relayPin ? `Pin ${system.relayPin}` : 'Pin 17';
                
                const watchdogStatusElement = document.getElementById('watchdogStatus');
                if (watchdogStatusElement) watchdogStatusElement.textContent = system.watchdogEnabled ? '✅ Enabled' : '⚪ Disabled';
                
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
                    
                    // Format timestamps
                    const formatDateTime = (isoString) => {
                        if (!isoString) return 'Unknown';
                        try {
                            const date = new Date(isoString);
                            return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
                        } catch (e) {
                            return 'Invalid date';
                        }
                    };
                    
                    const statusIcon = agg.Success ? '✅' : '❌';
                    const statusText = agg.Success ? 'Successful' : 'Failed';
                    const errorText = agg.ErrorMessage ? ` (${agg.ErrorMessage})` : '';
                    
                    monthlyAggElement.innerHTML = `
                        <div class="aggregation-status-detail">
                            <p><strong>Status:</strong> ${statusIcon} ${statusText}${errorText}</p>
                            <p><strong>Last Run:</strong> ${formatDateTime(agg.LastRun)}</p>
                            <p><strong>Next Run:</strong> ${formatDateTime(agg.NextScheduledRun)}</p>
                            <p><strong>Records Updated:</strong> ${agg.RecordsUpdated || 0}</p>
                            <p><strong>Months Processed:</strong> ${agg.MonthsProcessed || 0}</p>
                            <p><strong>Trigger:</strong> ${agg.TriggerType || 'Unknown'}</p>
                        </div>
                    `;
                } else if (monthlyAggElement) {
                    monthlyAggElement.innerHTML = '<div class="error-state">Monthly aggregation status not available</div>';
                }
                
                // Boot Information from sections.startup
                const lastBootInfoElement = document.getElementById('lastBootInfo');
                if (lastBootInfoElement && startup.bootTime) {
                    const bootDate = new Date(parseInt(startup.bootTime) * 1000);
                    lastBootInfoElement.textContent = `${bootDate.toLocaleDateString()} ${bootDate.toLocaleTimeString()}`;
                }
                
                const bootReasonInfoElement = document.getElementById('bootReasonInfo');
                if (bootReasonInfoElement) bootReasonInfoElement.textContent = `Reason: ${startup.bootReason || 'Unknown'}`;
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
                updateDoorStatus(data.doors);
            }

            // Check for alerts
            checkAlerts(data);

            // Update last update time - use ESP32's timestamp if available, otherwise browser time
            let updateTime = new Date(); // Default to browser time
            let isESP32Time = false; // Track if we're using ESP32's actual time
            
            // Check if ESP32 provides its timestamp in the data
            if (data.system && data.system.currentTime) {
                // ESP32 timestamp is available (Unix timestamp in seconds)
                updateTime = new Date(parseInt(data.system.currentTime) * 1000);
                isESP32Time = true;
            } else if (data.timestamp) {
                // Alternative location for timestamp
                updateTime = new Date(parseInt(data.timestamp) * 1000);
                isESP32Time = true;
            } else if (data.readingTime) {
                // Another alternative location
                updateTime = new Date(parseInt(data.readingTime) * 1000);
                isESP32Time = true;
            }
            // If none available, use browser time (already set above, isESP32Time remains false)
            
            const timestamp = formatDetailedTimestamp(updateTime);
            
            // Display time with clear indication of source
            if (isESP32Time) {
                document.getElementById('lastUpdate').innerHTML = `${timestamp.combined}`;
                document.getElementById('lastUpdate').style.color = '#28a745'; // Green for ESP32 time
                document.getElementById('lastUpdate').title = 'ESP32 device time - actual transmission timestamp';
            } else {
                document.getElementById('lastUpdate').innerHTML = `${timestamp.combined}<br><small style="color: #dc3545; font-weight: bold;">[Browser Time - No ESP32 timestamp]</small>`;
                document.getElementById('lastUpdate').style.color = '#dc3545'; // Red for browser fallback
                document.getElementById('lastUpdate').title = 'Browser time fallback - ESP32 did not provide timestamp';
            }
            
            // Fallback: Ensure systemConfig is never stuck on "Loading configuration..."
            const systemConfigElement = document.getElementById('systemConfig');
            if (systemConfigElement && systemConfigElement.textContent === 'Loading configuration...') {
                systemConfigElement.textContent = 'No data loaded';
            }
        }

        function updateDoorStatus(doors) {
            const doorSection = document.getElementById('doorSection');
            const doorList = document.getElementById('doorList');
            
            if (doors.length === 0) {
                doorSection.style.display = 'none';
                return;
            }

            doorSection.style.display = 'block';
            doorList.innerHTML = '';

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

            // Filter out incidents with corrupted timestamps (more lenient validation)
            function isValidIncidentTimestamp(timestamp) {
                if (!timestamp || timestamp === 0) return false;
                
                // Convert to Date object
                const date = new Date(timestamp * 1000); // Incidents use Unix timestamps in seconds
                
                // Validate date and check year range (more lenient range)
                if (isNaN(date.getTime())) return false;
                const year = date.getFullYear();
                // More lenient timestamp validation - allow wider range and ongoing incidents
                return year >= 2015 && year <= 2035;
            }
            
            // Filter incidents with valid timestamps, but be more lenient for ongoing incidents
            const validIncidents = incidents.filter(incident => {
                const validStart = isValidIncidentTimestamp(incident.startTime);
                // For ongoing incidents (endTime === 0), only validate startTime
                const validEnd = incident.endTime === 0 || isValidIncidentTimestamp(incident.endTime);
                
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

            // Filter out incidents with corrupted timestamps (more lenient validation for filtering)
            function isValidIncidentTimestamp(timestamp) {
                if (!timestamp || timestamp <= 0) return false;
                
                const date = new Date(timestamp * 1000);
                if (isNaN(date.getTime())) return false;
                
                const year = date.getFullYear();
                // More lenient timestamp validation for filtering
                return year >= 2015 && year <= 2035;
            }
            
            const validIncidents = incidents.filter(incident => {
                const validStart = isValidIncidentTimestamp(incident.startTime);
                const validEnd = incident.endTime === 0 || isValidIncidentTimestamp(incident.endTime);
                
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
                
                const formatDateTime = (date) => {
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
                };
                
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
                    `${formatDateTime(startTime)} - ${formatDateTime(endTime)} (${duration})` :
                    `${formatDateTime(startTime)} - Ongoing`;
                
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

        async function loadChart(hours) {
            // Track the current chart time period
            currentChartHours = hours;            // Update active button - find the button with matching hours
            document.querySelectorAll('.time-btn').forEach(btn => {
                btn.classList.remove('active');
                // Check if this button's onclick matches the requested hours
                const onclick = btn.getAttribute('onclick');
                if (onclick && onclick.includes(`loadChart(${hours})`)) {
                    btn.classList.add('active');
                }
            });

            try {
                const token = localStorage.getItem('ventilation_auth_token');
                
                // If no authentication method is available, show empty chart
                if (!token && !CONFIG.apiSecret) {
                    // No authentication available, show empty chart
                    window.dataSourceTracker.trackTemperatureSource(`${hours} Hours`, 'No Auth', 'Authentication required');
                    updateChart([], hours);
                    return;
                }

                const response = await fetch(`${CONFIG.historyApiUrl}?deviceId=${CONFIG.deviceId}&hours=${hours}`, {
                    method: 'GET',
                    headers: getAuthHeaders()
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
                        // Bearer token chart authentication failed, show empty chart
                        showApiFailureNotice('History API returned 401 Unauthorized. Chart data is currently unavailable.', 'warning');
                        window.dataSourceTracker.trackTemperatureSource(`${hours} Hours`, 'Auth Failed', '401 Unauthorized');
                        updateChart([], hours);
                        return;
                    }
                }
                
                if (!response.ok) {
                    // Show empty chart if API fails
                    // Chart API call failed, show empty chart
                    showApiFailureNotice(`History API returned ${response.status} ${response.statusText}. Chart data is currently unavailable.`, 'warning');
                    window.dataSourceTracker.trackTemperatureSource(`${hours} Hours`, 'API Error', `${response.status} ${response.statusText}`);
                    updateChart([], hours);
                    return;
                }
                
                const data = await response.json();
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
                console.error('Error loading chart data:', error);
                // Show empty chart instead of mock data
                showApiFailureNotice(`Network error loading chart data: ${error.message}. Chart data is currently unavailable.`, 'warning');
                window.dataSourceTracker.trackTemperatureSource(`${hours} Hours`, 'Network Error', error.message);
                updateChart([], hours);
            }
        }

        // Fetch pressure data from API or generate sample data for demonstration
        // Pressure chart now uses real data from Azure Functions API
        // The fetchPressureData sample function has been removed

        async function loadPressureChart(hours) {
            // Track the current pressure chart time period
            currentPressureChartHours = hours;
            
            // Update active button for pressure chart - look for buttons with onclick containing loadPressureChart
            document.querySelectorAll('.time-btn').forEach(btn => {
                const onclick = btn.getAttribute('onclick');
                if (onclick && onclick.includes('loadPressureChart')) {
                    btn.classList.remove('active');
                    if (onclick.includes(`loadPressureChart(${hours})`)) {
                        btn.classList.add('active');
                    }
                }
            });

            try {
                // Fetch real pressure and forecast data from Azure Functions API
                const token = localStorage.getItem('ventilation_auth_token');
                
                if (!token && !CONFIG.apiSecret) {
                    console.log('No authentication available for pressure data');
                    updatePressureChart([], hours);
                    return;
                }

                const response = await fetch(`${CONFIG.historyApiUrl}?deviceId=${CONFIG.deviceId}&hours=${hours}`, {
                    method: 'GET',
                    headers: getAuthHeaders()
                });
                
                if (response.status === 401) {
                    console.log('Pressure API returned 401 Unauthorized');
                    showApiFailureNotice('API returned 401 Unauthorized. Pressure chart data is currently unavailable.', 'warning');
                    updatePressureChart([], hours);
                    return;
                }
                
                if (!response.ok) {
                    console.error(`Pressure API error: ${response.status} ${response.statusText}`);
                    showApiFailureNotice(`API returned ${response.status} ${response.statusText}. Pressure chart data is currently unavailable.`, 'warning');
                    updatePressureChart([], hours);
                    return;
                }
                
                const apiData = await response.json();
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
                
                // Check if data has actually changed to avoid unnecessary chart refreshes
                const newDataHash = JSON.stringify(pressureData.map(p => ({ 
                    t: p.timestamp, 
                    p: p.pressure, 
                    c: p.pressureChange 
                })));
                
                if (latestPressureDataTimestamp === newDataHash) {
                    console.log('Pressure chart data unchanged, skipping refresh animation');
                    return;
                }
                
                // Update the data hash to track changes
                latestPressureDataTimestamp = newDataHash;
                
                console.log(`Processed ${pressureData.length} pressure data points (data changed, refreshing chart)`);
                updatePressureChart(pressureData, hours);
                
            } catch (error) {
                console.error('Error loading pressure chart data:', error);
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
                await loadPressureChart(currentPressureChartHours);
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
                    console.log(`Chart refresh: New data available`);
                    
                    // Update our stored timestamp and refresh the chart
                    latestChartDataTimestamp = newLatestTimestamp;
                    updateChart(data.data, hours);
                } else {
                    // No new data, skip refresh to avoid unnecessary animations
                }

            } catch (error) {
                console.error('Error checking for new chart data:', error);
                // On error, don't refresh to avoid unnecessary animations
            }
        }

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
                let date;
                
                if (typeof timestamp === 'string') {
                    if (timestamp.includes('T') || timestamp.includes('-')) {
                        date = new Date(timestamp);
                    } else {
                        const unixSeconds = parseInt(timestamp);
                        if (!isNaN(unixSeconds) && unixSeconds > 1000000000 && unixSeconds < 2000000000) {
                            date = new Date(unixSeconds * 1000);
                        } else {
                            return false;
                        }
                    }
                } else if (typeof timestamp === 'number') {
                    if (timestamp < 1000000000 || timestamp > 2000000000) {
                        return false; // Invalid Unix timestamp range
                    }
                    date = timestamp < 10000000000 ? new Date(timestamp * 1000) : new Date(timestamp);
                } else {
                    return false;
                }
                
                // Reject timestamps before 2020 or after 2030 (likely corrupted)
                const year = date.getFullYear();
                return !isNaN(date.getTime()) && year >= 2020 && year <= 2030;
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
            
            try {
                statusElement.textContent = 'Loading incident data...';
                
                // Calculate time range
                const now = new Date();
                let startDate;
                if (periodFilter === 1) {
                    // Previous month
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                } else {
                    // Last 12 months
                    startDate = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
                }
                
                // Use existing incident data or fetch if needed
                let incidents = originalIncidentsData || [];
                
                if (incidents.length === 0) {
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
                
                // Filter by time range
                const cutoffTimestamp = Math.floor(startDate.getTime() / 1000);
                filteredIncidents = filteredIncidents.filter(incident => incident.startTime >= cutoffTimestamp);
                
                const periodText = periodFilter === 1 ? 'previous month' : 'last 12 months';
                statusElement.textContent = `Showing ${filteredIncidents.length} incidents from ${periodText}`;
                
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
            const indicator = document.getElementById('connectionStatus');
            const text = document.getElementById('connectionText');

            switch(status) {
                case 'connected':
                    indicator.className = 'status-indicator online';
                    text.textContent = 'Connected';
                    break;
                case 'connecting':
                    indicator.className = 'status-indicator';
                    text.textContent = 'Connecting...';
                    break;
                case 'error':
                    indicator.className = 'status-indicator';
                    text.textContent = 'Connection Error';
                    break;
            }
        }

        function showError() {
            document.getElementById('loadingSection').style.display = 'none';
            document.getElementById('dashboardContent').style.display = 'none';
            document.getElementById('errorSection').style.display = 'block';
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