// Dashboard Event System
// Event-driven architecture for loose coupling between modules

class DashboardEventSystem {
    constructor() {
        this.listeners = new Map();
    }

    // Emit dashboard events
    emit(eventName, data = null) {
        const customEvent = new CustomEvent(`dashboard:${eventName}`, { 
            detail: data,
            bubbles: true,
            cancelable: true
        });
        
        console.log(`DashboardEvents: Emitting ${eventName}`, data);
        document.dispatchEvent(customEvent);
        
        return customEvent;
    }

    // Subscribe to dashboard events
    on(eventName, handler, options = {}) {
        const eventKey = `dashboard:${eventName}`;
        
        if (!this.listeners.has(eventKey)) {
            this.listeners.set(eventKey, new Set());
        }
        
        this.listeners.get(eventKey).add(handler);
        document.addEventListener(eventKey, handler, options);
        
        console.log(`DashboardEvents: Subscribed to ${eventName}`);
    }

    // Unsubscribe from dashboard events
    off(eventName, handler) {
        const eventKey = `dashboard:${eventName}`;
        
        if (this.listeners.has(eventKey)) {
            this.listeners.get(eventKey).delete(handler);
        }
        
        document.removeEventListener(eventKey, handler);
        console.log(`DashboardEvents: Unsubscribed from ${eventName}`);
    }

    // One-time event listener
    once(eventName, handler) {
        const onceHandler = (event) => {
            handler(event);
            this.off(eventName, onceHandler);
        };
        
        this.on(eventName, onceHandler);
    }

    // Clear all listeners (cleanup)
    clearAll() {
        this.listeners.forEach((handlers, eventKey) => {
            handlers.forEach(handler => {
                document.removeEventListener(eventKey, handler);
            });
        });
        
        this.listeners.clear();
        console.log('DashboardEvents: All listeners cleared');
    }

    // Get listener count for debugging
    getListenerCount(eventName = null) {
        if (eventName) {
            const eventKey = `dashboard:${eventName}`;
            return this.listeners.get(eventKey)?.size || 0;
        }
        
        let total = 0;
        this.listeners.forEach(handlers => {
            total += handlers.size;
        });
        return total;
    }
}

// Create singleton instance
export const DashboardEvents = new DashboardEventSystem();

// Common event names for consistency
export const EVENT_NAMES = {
    // Data events
    DATA_UPDATED: 'data:updated',
    DATA_ERROR: 'data:error',
    DATA_LOADING: 'data:loading',
    
    // Chart events
    CHART_UPDATED: 'chart:updated',
    CHART_ERROR: 'chart:error',
    CHART_DESTROYED: 'chart:destroyed',
    
    // UI events
    UI_READY: 'ui:ready',
    UI_ERROR: 'ui:error',
    UI_NOTIFICATION: 'ui:notification',
    
    // Widget events
    WIDGET_LOADED: 'widget:loaded',
    WIDGET_ERROR: 'widget:error',
    WIDGET_UPDATED: 'widget:updated'
};
