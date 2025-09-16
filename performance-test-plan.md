# Category Filters Performance Test Plan

## Test Environment
- URL: http://localhost:5000/trips/46/map (New York Halloween trip)
- Browser: Chrome with Developer Tools open
- Test Date: 2025-09-16

## Performance Requirements to Verify

### 1. Response Time Testing (<400ms requirement)
**Test Steps:**
1. Open trip map page and wait for initial load
2. Open Chrome DevTools → Performance tab
3. Record performance while clicking each category pill:
   - Restaurants
   - Hotels  
   - Cafes
   - Bars
   - Attractions
   - Groceries
   - Clubs
4. Measure time from click to results display
5. Test switching between categories rapidly
6. Verify no search requests are abandoned or duplicated

**Expected Result:** Total response time <400ms (250ms debounce + API call + rendering)

### 2. Pagination Functionality
**Test Steps:**
1. Select a category with many results (e.g., Restaurants in NYC)
2. Scroll to bottom of results list
3. Click "More results" button
4. Verify new results append to existing list (don't replace)
5. Test multiple pagination clicks
6. Switch categories and verify pagination resets

**Expected Result:** Results properly append, no flickering or jumping

### 3. Filter Functionality Verification  
**Test Steps:**
1. **Open Now Filter:**
   - Toggle "Open now" badge on/off
   - Verify results change appropriately
   - Check a few places to confirm they're actually open
2. **Within Map Filter:**
   - Toggle "Within map" badge on/off  
   - Move map to different location
   - Verify results update when "Within map" is enabled
   - Verify broader results when disabled
3. **Keyword Search:**
   - Type various keywords (e.g., "pizza", "coffee", "museum")
   - Verify search results filter appropriately
   - Test with category + keyword combinations

### 4. Performance During Map Interactions
**Test Steps:**
1. Load category with >50 results (Restaurants)
2. Open DevTools → Performance tab → Enable "Screenshots" 
3. Record while performing:
   - Pan around map smoothly
   - Zoom in/out multiple levels
   - Quick pan movements
4. Check for:
   - Frame rate stays ~60fps
   - No jank or stuttering
   - MarkerClusterer works smoothly
5. Test with multiple categories selected

**Expected Result:** Smooth 60fps interactions, no performance degradation

### 5. Memory Leak Testing
**Test Steps:**
1. Open DevTools → Memory tab
2. Take baseline heap snapshot
3. Perform 10 iterations of:
   - Switch between different categories
   - Move map to new location  
   - Zoom in/out
   - Clear all filters
4. Force garbage collection (DevTools → Memory → Collect garbage)
5. Take final heap snapshot
6. Compare memory usage

**Expected Result:** Memory usage returns close to baseline after GC

### 6. Error Handling Testing
**Test Steps:**
1. **No Results:** Search in remote area with strict filters
2. **Network Issues:** Throttle network to slow 3G, test responsiveness
3. **API Limits:** (If testable) Monitor behavior under quota limits
4. **Rapid Interactions:** Click multiple categories rapidly

**Expected Result:** Graceful error handling, no crashes, good UX

## Performance Metrics to Track

### Chrome DevTools Metrics:
- **First Contentful Paint (FCP)**
- **Largest Contentful Paint (LCP)** 
- **Cumulative Layout Shift (CLS)**
- **Total Blocking Time (TBT)**
- **JavaScript heap size**
- **Frame rate during interactions**

### Custom Timing Measurements:
- Click to search results visible
- Search API response times
- Marker rendering time
- Filter interaction responsiveness

## Pass/Fail Criteria

### ✅ PASS Criteria:
- All category switches <400ms total response time
- Pagination appends correctly without UI issues
- All filters work as expected
- 60fps maintained during map interactions  
- Memory usage stable after extended testing
- Error states handled gracefully

### ❌ FAIL Criteria:
- Any category switch >400ms response time
- Pagination replaces instead of appending results
- Filters don't constrain results properly
- Frame drops or stuttering during map interactions
- Memory leaks detected
- Crashes or unhandled errors

## Test Results Log

| Test | Status | Time/Metric | Notes |
|------|--------|-------------|-------|
| Restaurant category | | | |
| Hotel category | | | |
| Cafe category | | | |
| Bar category | | | |
| Attraction category | | | |
| Grocery category | | | |
| Club category | | | |
| Pagination - Page 2 | | | |
| Pagination - Page 3 | | | |
| Open Now filter | | | |
| Within Map filter | | | |
| Keyword: "pizza" | | | |
| Keyword: "coffee" | | | |
| Map pan performance | | FPS: | |
| Map zoom performance | | FPS: | |
| Memory baseline | | MB: | |
| Memory after 10 cycles | | MB: | |

## Implementation Review Notes

From code analysis:
- ✅ 250ms debounce implemented
- ✅ 400ms throttle for map bounds 
- ✅ AbortController for search cancellation
- ✅ Proper error handling
- ✅ 20 results per page (good for performance)
- ✅ Efficient marker clustering

Potential optimizations identified:
- Consider reducing debounce to 200ms for snappier feel
- Implement result caching for repeated searches
- Add loading skeleton states for better perceived performance