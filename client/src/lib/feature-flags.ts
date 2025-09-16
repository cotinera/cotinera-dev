/**
 * Feature Flag System
 * Provides configurable feature toggles for the application
 */

// Feature flag definitions
export interface FeatureFlags {
  // Places API features
  withinMapDefault: boolean;
  useNewPlacesApi: boolean;
  enableAutocompleteCaching: boolean;
  showPerformanceMetrics: boolean;
  
  // Search behavior
  enableSearchDebouncing: boolean;
  searchDebounceDuration: number; // milliseconds
  autocompleteDebounceDuration: number; // milliseconds
  
  // Error handling
  showDetailedErrors: boolean;
  autoHideErrors: boolean;
  errorAutoHideDelay: number; // milliseconds
  
  // Performance monitoring
  enablePerformanceLogging: boolean;
  enableRequestLogging: boolean;
  logTimingThreshold: number; // milliseconds - only log requests slower than this
  
  // User experience
  enableMapPrewarming: boolean;
  maxSearchResults: number;
  enableInfiniteScroll: boolean;
  
  // Development features
  debugMode: boolean;
  mockApiResponses: boolean;
}

// Default feature flag values
const DEFAULT_FLAGS: FeatureFlags = {
  // Places API features
  withinMapDefault: true, // Default to searching within map bounds
  useNewPlacesApi: true,
  enableAutocompleteCaching: true,
  showPerformanceMetrics: false,
  
  // Search behavior
  enableSearchDebouncing: true,
  searchDebounceDuration: 300,
  autocompleteDebounceDuration: 150,
  
  // Error handling
  showDetailedErrors: false,
  autoHideErrors: false,
  errorAutoHideDelay: 5000,
  
  // Performance monitoring
  enablePerformanceLogging: true,
  enableRequestLogging: false,
  logTimingThreshold: 1000, // Log requests over 1 second
  
  // User experience
  enableMapPrewarming: true,
  maxSearchResults: 20,
  enableInfiniteScroll: false,
  
  // Development features
  debugMode: import.meta.env.MODE === 'development',
  mockApiResponses: false,
};

// Environment-based overrides
const ENV_OVERRIDES: Partial<FeatureFlags> = {
  // Production overrides
  ...(import.meta.env.MODE === 'production' && {
    debugMode: false,
    showDetailedErrors: false,
    enableRequestLogging: false,
    mockApiResponses: false,
  }),
  
  // Development overrides
  ...(import.meta.env.MODE === 'development' && {
    debugMode: true,
    showDetailedErrors: true,
    enableRequestLogging: true,
    enablePerformanceLogging: true,
  }),
  
  // Test overrides
  ...(import.meta.env.MODE === 'test' && {
    mockApiResponses: true,
    enableSearchDebouncing: false,
    autoHideErrors: false,
  }),
};

// URL parameter overrides (for testing)
const getUrlParamOverrides = (): Partial<FeatureFlags> => {
  if (typeof window === 'undefined') return {};
  
  const params = new URLSearchParams(window.location.search);
  const overrides: Partial<FeatureFlags> = {};
  
  // Boolean flags
  const booleanFlags = [
    'withinMapDefault',
    'useNewPlacesApi', 
    'enableAutocompleteCaching',
    'showPerformanceMetrics',
    'enableSearchDebouncing',
    'showDetailedErrors',
    'autoHideErrors',
    'enablePerformanceLogging',
    'enableRequestLogging',
    'enableMapPrewarming',
    'enableInfiniteScroll',
    'debugMode',
    'mockApiResponses',
  ];
  
  booleanFlags.forEach(flag => {
    const value = params.get(flag);
    if (value !== null) {
      (overrides as any)[flag] = value === 'true' || value === '1';
    }
  });
  
  // Number flags
  const numberFlags = [
    'searchDebounceDuration',
    'autocompleteDebounceDuration', 
    'errorAutoHideDelay',
    'logTimingThreshold',
    'maxSearchResults',
  ];
  
  numberFlags.forEach(flag => {
    const value = params.get(flag);
    if (value !== null && !isNaN(Number(value))) {
      (overrides as any)[flag] = Number(value);
    }
  });
  
  return overrides;
};

// LocalStorage-based overrides (persistent user preferences)
const STORAGE_KEY = 'tripcoordinator_feature_flags';

const getStorageOverrides = (): Partial<FeatureFlags> => {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to parse stored feature flags:', error);
  }
  
  return {};
};

const setStorageOverrides = (overrides: Partial<FeatureFlags>) => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch (error) {
    console.warn('Failed to store feature flags:', error);
  }
};

// Feature flag manager class
class FeatureFlagManager {
  private flags: FeatureFlags;
  private listeners: Array<(flags: FeatureFlags) => void> = [];

  constructor() {
    this.flags = this.calculateFlags();
  }

  private calculateFlags(): FeatureFlags {
    return {
      ...DEFAULT_FLAGS,
      ...ENV_OVERRIDES,
      ...getStorageOverrides(),
      ...getUrlParamOverrides(),
    };
  }

  /**
   * Get the current value of a feature flag
   */
  isEnabled(flag: keyof FeatureFlags): boolean {
    const value = this.flags[flag];
    return typeof value === 'boolean' ? value : false;
  }

  /**
   * Get the current value of a numeric feature flag
   */
  getValue<T extends keyof FeatureFlags>(flag: T): FeatureFlags[T] {
    return this.flags[flag];
  }

  /**
   * Get all current feature flags
   */
  getAllFlags(): FeatureFlags {
    return { ...this.flags };
  }

  /**
   * Update a feature flag value (persists to localStorage)
   */
  setFlag<T extends keyof FeatureFlags>(flag: T, value: FeatureFlags[T]) {
    this.flags[flag] = value;
    
    // Update localStorage
    const currentOverrides = getStorageOverrides();
    const newOverrides = { ...currentOverrides, [flag]: value };
    setStorageOverrides(newOverrides);
    
    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Update multiple feature flags at once
   */
  setFlags(updates: Partial<FeatureFlags>) {
    Object.assign(this.flags, updates);
    
    // Update localStorage
    const currentOverrides = getStorageOverrides();
    const newOverrides = { ...currentOverrides, ...updates };
    setStorageOverrides(newOverrides);
    
    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Reset all feature flags to defaults
   */
  reset() {
    this.flags = this.calculateFlags();
    setStorageOverrides({});
    this.notifyListeners();
  }

  /**
   * Reset a specific flag to its default value
   */
  resetFlag(flag: keyof FeatureFlags) {
    (this.flags as any)[flag] = (DEFAULT_FLAGS as any)[flag];
    
    const currentOverrides = getStorageOverrides();
    delete currentOverrides[flag];
    setStorageOverrides(currentOverrides);
    
    this.notifyListeners();
  }

  /**
   * Subscribe to feature flag changes
   */
  subscribe(listener: (flags: FeatureFlags) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.flags));
  }

  /**
   * Get debug information about current flag sources
   */
  getDebugInfo() {
    return {
      defaults: DEFAULT_FLAGS,
      envOverrides: ENV_OVERRIDES,
      storageOverrides: getStorageOverrides(),
      urlOverrides: getUrlParamOverrides(),
      current: this.flags,
    };
  }
}

// Singleton instance
const featureFlagManager = new FeatureFlagManager();

// React hook for using feature flags
import { useState, useEffect } from 'react';

export function useFeatureFlags(): FeatureFlags {
  const [flags, setFlags] = useState(featureFlagManager.getAllFlags());

  useEffect(() => {
    return featureFlagManager.subscribe(setFlags);
  }, []);

  return flags;
}

export function useFeatureFlag<T extends keyof FeatureFlags>(
  flag: T
): FeatureFlags[T] {
  const [value, setValue] = useState(featureFlagManager.getValue(flag));

  useEffect(() => {
    return featureFlagManager.subscribe(flags => setValue(flags[flag]));
  }, [flag]);

  return value;
}

// Utility functions
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return featureFlagManager.isEnabled(flag);
}

export function getFeatureValue<T extends keyof FeatureFlags>(flag: T): FeatureFlags[T] {
  return featureFlagManager.getValue(flag);
}

export function setFeatureFlag<T extends keyof FeatureFlags>(
  flag: T, 
  value: FeatureFlags[T]
) {
  featureFlagManager.setFlag(flag, value);
}

export function setFeatureFlags(flags: Partial<FeatureFlags>) {
  featureFlagManager.setFlags(flags);
}

export function resetFeatureFlags() {
  featureFlagManager.reset();
}

export function getFeatureFlagDebugInfo() {
  return featureFlagManager.getDebugInfo();
}

// Feature flag presets for common scenarios
export const FEATURE_PRESETS = {
  // High performance preset
  performance: {
    enableSearchDebouncing: true,
    searchDebounceDuration: 200,
    autocompleteDebounceDuration: 100,
    enableAutocompleteCaching: true,
    enableMapPrewarming: true,
    maxSearchResults: 50,
    enablePerformanceLogging: true,
  },
  
  // Accessibility preset  
  accessibility: {
    autoHideErrors: false,
    showDetailedErrors: true,
    enableInfiniteScroll: false,
    maxSearchResults: 10,
  },
  
  // Development preset
  development: {
    debugMode: true,
    showDetailedErrors: true,
    enableRequestLogging: true,
    enablePerformanceLogging: true,
    showPerformanceMetrics: true,
  },
  
  // Conservative preset (minimal features)
  conservative: {
    useNewPlacesApi: false,
    enableAutocompleteCaching: false,
    enableSearchDebouncing: false,
    autoHideErrors: false,
    enableInfiniteScroll: false,
    maxSearchResults: 10,
  },
} as const;

export function applyFeaturePreset(preset: keyof typeof FEATURE_PRESETS) {
  featureFlagManager.setFlags(FEATURE_PRESETS[preset]);
}

// Export the manager instance for advanced usage
export { featureFlagManager };

export default featureFlagManager;