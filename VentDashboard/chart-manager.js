// Chart Manager Module
// Smart chart update detection and lifecycle management

export class ChartManager {
    constructor(dataManager) {
        this.charts = {
            temperature: null,
            pressure: null,
            incidentTrends: null
        };
        
        this.latestTimestamps = {
            temperature: null,
            pressure: null,
            incidents: null
        };
        
        this.currentTimeRanges = {
            temperature: 6,
            pressure: 6
        };
        
        this.dataManager = dataManager;
    }

    // Smart temperature chart update with timestamp detection
    async updateTemperatureChart(hours, existingChart) {
        console.log(`ChartManager: Temperature chart update request for ${hours}h`);
        
        const timeRangeChanged = this.currentTimeRanges.temperature !== hours;
        this.currentTimeRanges.temperature = hours;
        
        try {
            // Get data using DataManager instead of global function
            const apiData = await this.dataManager.getHistoryData(hours);
            const data = apiData?.data || [];
            
            if (!data || data.length === 0) {
                console.log('ChartManager: No temperature data available');
                return existingChart;
            }
            
            // Extract timestamps for comparison
            const timestamps = data.map(d => {
                let timestamp;
                if (typeof d.timestamp === 'string') {
                    timestamp = d.timestamp.includes('T') ? new Date(d.timestamp) : new Date(parseInt(d.timestamp) * 1000);
                } else {
                    timestamp = new Date(d.timestamp > 1000000000000 ? d.timestamp : d.timestamp * 1000);
                }
                return timestamp;
            }).filter(d => !isNaN(d.getTime()));
            
            const newLatestTimestamp = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null;
            
            // Update if we have new data OR time range changed
            if (!this.latestTimestamps.temperature || 
                newLatestTimestamp > this.latestTimestamps.temperature || 
                timeRangeChanged) {
                
                if (timeRangeChanged) {
                    console.log(`ChartManager: Time range changed to ${hours}h, updating chart`);
                } else {
                    console.log(`ChartManager: New data detected, updating chart (${newLatestTimestamp?.toLocaleTimeString()})`);
                }
                
                this.latestTimestamps.temperature = newLatestTimestamp;
                return await this._performTemperatureChartUpdate(data, hours, existingChart);
            } else {
                console.log('ChartManager: No new temperature data, skipping refresh');
                return existingChart;
            }
            
        } catch (error) {
            console.error('ChartManager: Error updating temperature chart:', error);
            return existingChart;
        }
    }

    // Smart pressure chart update with timestamp detection
    async updatePressureChart(hours, existingChart) {
        console.log(`ChartManager: Pressure chart update request for ${hours}h`);
        
        const timeRangeChanged = this.currentTimeRanges.pressure !== hours;
        this.currentTimeRanges.pressure = hours;
        
        try {
            // Get data using DataManager instead of global function
            const apiData = await this.dataManager.getHistoryData(hours);
            const data = apiData?.data || [];
            
            if (!data || data.length === 0) {
                console.log('ChartManager: No pressure data available');
                return existingChart;
            }
            
            const timestamps = data.map(d => new Date(d.timestamp * 1000))
                .filter(d => !isNaN(d.getTime()));
            
            const newLatestTimestamp = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null;
            
            if (!this.latestTimestamps.pressure || 
                newLatestTimestamp > this.latestTimestamps.pressure || 
                timeRangeChanged) {
                
                if (timeRangeChanged) {
                    console.log(`ChartManager: Pressure time range changed to ${hours}h, updating chart`);
                } else {
                    console.log(`ChartManager: New pressure data detected, updating chart (${newLatestTimestamp?.toLocaleTimeString()})`);
                }
                
                this.latestTimestamps.pressure = newLatestTimestamp;
                return await this._performPressureChartUpdate(data, hours, existingChart);
            } else {
                console.log('ChartManager: No new pressure data, skipping refresh');
                return existingChart;
            }
            
        } catch (error) {
            console.error('ChartManager: Error updating pressure chart:', error);
            return existingChart;
        }
    }

    async _performTemperatureChartUpdate(data, hours, existingChart) {
        // Use existing global chart creation function
        if (typeof createTemperatureChart === 'function') {
            return createTemperatureChart(data, hours, existingChart);
        } else {
            console.error('ChartManager: createTemperatureChart function not available');
            return existingChart;
        }
    }

    async _performPressureChartUpdate(data, hours, existingChart) {
        // Use existing global chart creation function
        if (typeof createPressureChart === 'function') {
            return createPressureChart(data, hours, existingChart);
        } else {
            console.error('ChartManager: createPressureChart function not available');
            return existingChart;
        }
    }
}

// Export ChartManager class and a function to create an instance
export { ChartManager };

// Function to create a chart manager instance with DataManager dependency
export function createChartManager(dataManager) {
    return new ChartManager(dataManager);
}

// Create singleton instance
export const chartManager = new ChartManager();
