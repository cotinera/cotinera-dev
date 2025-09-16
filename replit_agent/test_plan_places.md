# Google Places API Integration Test Plan

## Overview
This document outlines comprehensive manual testing procedures for the Google Places API integration, including error handling, performance verification, and user experience validation.

## Prerequisites
- Application running with Google Maps API key configured
- Browser developer tools open for console monitoring
- Network throttling tools available (optional, for network error testing)

---

## Test Categories

### 1. Map Integration & Performance Tests

#### 1.1 Map Initialization
- [ ] **Test**: Page load with valid API key
  - **Expected**: Map loads without console errors
  - **Verify**: Vector map rendering (check for mapId in network requests)
  - **Check**: No deprecated API warnings in console

- [ ] **Test**: Page load with invalid API key  
  - **Expected**: Error banner shows "Invalid API Key" message
  - **Verify**: Clear user instruction with link to API documentation
  - **Check**: No map rendering

#### 1.2 Pan/Zoom Performance
- [ ] **Test**: Pan map to new location
  - **Expected**: Console shows search request with timing logs
  - **Verify**: Search results update within 2 seconds
  - **Check**: No stale results from previous location

- [ ] **Test**: Rapid pan/zoom operations
  - **Expected**: Previous requests cancelled (check console for "cancelled" logs)
  - **Verify**: Only latest search results displayed
  - **Check**: Performance metrics logged for successful requests

- [ ] **Test**: Zoom out significantly (to show large area)
  - **Expected**: Search bounds adjust correctly
  - **Verify**: Results include places across wider area
  - **Check**: No OVER_QUERY_LIMIT errors with large bounds

### 2. Search Functionality Tests

#### 2.1 Category Filtering
- [ ] **Test**: Click "Restaurants" category pill
  - **Expected**: Map shows only restaurant markers
  - **Verify**: Search request includes `includedPrimaryTypes: ["restaurant"]`
  - **Check**: Results list updates to show restaurants only

- [ ] **Test**: Toggle between different categories (Hotels, Cafes, Bars)
  - **Expected**: Markers and results update for each category
  - **Verify**: Previous category results cleared
  - **Check**: Debounced requests (not excessive API calls)

- [ ] **Test**: Clear category filter
  - **Expected**: All place types shown again
  - **Verify**: Mixed results with various place types
  - **Check**: Search parameters reset in console logs

#### 2.2 Filter Combinations
- [ ] **Test**: Enable "Open now" filter
  - **Expected**: Only currently open places shown
  - **Verify**: Results filtered client-side for opening hours
  - **Check**: Console shows filtering logic applied

- [ ] **Test**: Toggle "Within map" filter
  - **Expected**: Search bounds change from map viewport to radius-based
  - **Verify**: Different search parameters in console logs
  - **Check**: Different result set when toggled

- [ ] **Test**: Keyword search with text input
  - **Expected**: Results filtered by name/address matching keyword
  - **Verify**: Console shows keyword parameter in search request
  - **Check**: Debounced search (150ms for autocomplete, 300ms for search)

#### 2.3 Search Performance
- [ ] **Test**: Type in search box rapidly
  - **Expected**: Previous autocomplete requests cancelled
  - **Verify**: Console shows request cancellation logs
  - **Check**: Final results match last input

- [ ] **Test**: Clear search input
  - **Expected**: Autocomplete results cleared immediately
  - **Verify**: No unnecessary API requests for empty input
  - **Check**: Previous requests properly cancelled

### 3. Autocomplete Integration Tests

#### 3.1 Location Search Bar
- [ ] **Test**: Type partial location name (e.g., "Central P")
  - **Expected**: Dropdown shows relevant place predictions
  - **Verify**: Console shows autocomplete API calls with timing
  - **Check**: Session token usage for billing optimization

- [ ] **Test**: Select suggestion from dropdown
  - **Expected**: Map centers on selected location
  - **Verify**: Search results update for new location
  - **Check**: Session token consumed properly

- [ ] **Test**: Type invalid/nonsense text
  - **Expected**: No predictions shown, no error banner
  - **Verify**: ZERO_RESULTS handled gracefully
  - **Check**: Console shows appropriate status handling

#### 3.2 Place Details Integration
- [ ] **Test**: Click on place marker
  - **Expected**: Place details sheet opens with information
  - **Verify**: Place details API call with proper fields requested
  - **Check**: Loading state shown during API request

- [ ] **Test**: Click on place in results list
  - **Expected**: Same behavior as marker click
  - **Verify**: Consistent place details loading
  - **Check**: No duplicate API requests

### 4. Error Handling Tests

#### 4.1 API Key Issues
- [ ] **Test**: Configure invalid API key
  - **Setup**: Set `VITE_GOOGLE_MAPS_API_KEY` to invalid value
  - **Expected**: Error banner shows "Invalid API Key"
  - **Verify**: Link to API key documentation provided
  - **Check**: No map functionality available

- [ ] **Test**: Remove API key configuration
  - **Setup**: Unset `VITE_GOOGLE_MAPS_API_KEY`
  - **Expected**: Error banner shows "Missing API Key"
  - **Verify**: Clear setup instructions provided
  - **Check**: Graceful degradation of features

#### 4.2 Network & Quota Errors
- [ ] **Test**: Simulate network disconnection
  - **Setup**: Use browser dev tools to go offline
  - **Expected**: Error banner shows "Network Error"
  - **Verify**: Retry button functionality
  - **Check**: Automatic retry when network restored

- [ ] **Test**: Quota exceeded simulation
  - **Setup**: Make rapid successive requests (if possible)
  - **Expected**: Error banner shows "Quota Exceeded" 
  - **Verify**: User-friendly explanation of limits
  - **Check**: Link to quota management console

#### 4.3 Request-Specific Errors
- [ ] **Test**: Search in remote area with no places
  - **Expected**: "No results found" message
  - **Verify**: Suggestion to expand search area
  - **Check**: No error banner (this is normal behavior)

- [ ] **Test**: Invalid place ID for details
  - **Setup**: Manually trigger details request with invalid ID
  - **Expected**: Error message about invalid place
  - **Verify**: Graceful fallback behavior
  - **Check**: Console error logged appropriately

### 5. Feature Flag Tests

#### 5.1 Within Map Default Behavior
- [ ] **Test**: Fresh page load
  - **Expected**: "Within map" filter reflects feature flag default
  - **Verify**: Initial search uses correct bounds
  - **Check**: Feature flag setting in localStorage

- [ ] **Test**: Toggle feature flag in localStorage
  - **Setup**: Set `tripcoordinator_feature_flags` with `withinMapDefault: false`
  - **Expected**: "Within map" unchecked by default
  - **Verify**: Different default search behavior
  - **Check**: Setting persisted across page reloads

#### 5.2 URL Parameter Overrides
- [ ] **Test**: Add `?debugMode=true` to URL
  - **Expected**: More detailed console logging enabled
  - **Verify**: Performance metrics visible in console
  - **Check**: Debug information displayed

- [ ] **Test**: Add `?showPerformanceMetrics=true` to URL
  - **Expected**: Performance metrics visible in UI (if implemented)
  - **Verify**: Request timing displayed
  - **Check**: Metrics updated in real-time

### 6. Performance Verification Tests

#### 6.1 Request Timing
- [ ] **Test**: Monitor console for timing logs
  - **Expected**: Each request shows execution time
  - **Verify**: Times generally under 1 second for normal requests
  - **Check**: Slow requests (>1s) highlighted in logs

- [ ] **Test**: Performance metrics tracking
  - **Expected**: Success/failure rates tracked
  - **Verify**: Average response time calculated
  - **Check**: Quota usage counters incremented

#### 6.2 Memory & Resource Usage
- [ ] **Test**: Extended usage session (10+ minutes of interaction)
  - **Expected**: No memory leaks in dev tools
  - **Verify**: Event listeners properly cleaned up
  - **Check**: AbortController instances not accumulating

- [ ] **Test**: Rapid interactions (stress test)
  - **Expected**: Application remains responsive
  - **Verify**: Request cancellation working properly
  - **Check**: No excessive DOM manipulation

### 7. User Experience Tests

#### 7.1 Loading States
- [ ] **Test**: Search with slow network
  - **Setup**: Throttle network to slow 3G
  - **Expected**: Loading indicators shown during requests
  - **Verify**: User can cancel long-running requests
  - **Check**: Timeout handling after reasonable period

#### 7.2 Error Recovery
- [ ] **Test**: Error banner dismissal
  - **Expected**: User can manually close error banners
  - **Verify**: Auto-dismiss works for appropriate error types
  - **Check**: Multiple errors handled gracefully

- [ ] **Test**: Retry functionality
  - **Expected**: Retry button re-attempts failed requests
  - **Verify**: Success after retry clears error state
  - **Check**: Loading state shown during retry

---

## Performance Benchmarks

### Target Metrics
- **Map initialization**: < 2 seconds
- **Search requests**: < 800ms average
- **Autocomplete requests**: < 400ms average
- **Place details requests**: < 600ms average
- **Error recovery**: < 100ms to show error banner

### Success Criteria
- [ ] No deprecation warnings in console
- [ ] All error states have user-visible messaging
- [ ] Request cancellation prevents stale results
- [ ] Performance logging captures timing data
- [ ] Feature flags control default behavior
- [ ] Memory usage stable during extended use

---

## Test Environment Setup

### Required Environment Variables
```bash
VITE_GOOGLE_MAPS_API_KEY=your_valid_api_key_here
```

### Browser Testing
- Chrome (latest)
- Firefox (latest)  
- Safari (if available)
- Mobile Chrome/Safari (responsive testing)

### Console Commands for Testing
```javascript
// Check feature flags
console.log(localStorage.getItem('tripcoordinator_feature_flags'))

// Force error state
throw new Error('Test error for error banner')

// Check API wrapper state
window.placesApiWrapper?.getMetrics()
```

---

## Failure Investigation

### Common Issues & Solutions

**Issue**: Map not loading
- Check API key validity in Network tab
- Verify libraries parameter includes "places"
- Check for JavaScript errors in console

**Issue**: Search results not updating
- Check request cancellation logs
- Verify bounds/location parameters
- Check for CORS or network issues

**Issue**: Performance problems
- Monitor request frequency in Network tab
- Check for memory leaks in Memory tab
- Verify debouncing is working properly

**Issue**: Error banners not showing
- Check error boundary implementation
- Verify error types match expected values
- Test with intentionally invalid requests

---

## Test Execution Tracking

### Test Session Information
- **Tester**: _____________
- **Date**: _____________
- **Environment**: _____________
- **API Key Status**: _____________

### Results Summary
- **Passed Tests**: ___ / ___
- **Failed Tests**: ___ / ___
- **Blocked Tests**: ___ / ___
- **Performance Issues**: _____________
- **Recommended Actions**: _____________

---

## Automated Testing Considerations

While this test plan focuses on manual testing, consider implementing automated tests for:

- Unit tests for API wrapper functions
- Integration tests for error handling
- Performance regression tests
- Feature flag functionality tests

The manual testing described here should complement (not replace) automated testing for comprehensive coverage.