
/**
 * BatchMemoryReader.js
 * 
 * This module provides optimized batched memory reading operations by:
 * 1. Grouping memory reads by process and module
 * 2. Caching module base addresses
 * 3. Minimizing IPC communication overhead
 * 4. Handling memory read failures gracefully
 * 5. Optimizing polling performance with fast mode
 * 6. Using worker threads for parallel memory reads
 * 7. Caching resolved pointer addresses for faster subsequent reads
 */

const { readRealMemory, findModuleBaseAddress } = require('./memoryReaderReal');
const { logToFile, logToFileAsync, isHighPerformanceMode } = require('./logger');
const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');

// Cache for module base addresses to avoid redundant lookups
const moduleBaseCache = new Map();

// Memory read result cache to avoid redundant reads (address -> result)
const memoryReadCache = new Map();

// Cache for resolved addresses (including full pointer chain resolution)
const resolvedAddressCache = new Map();

// Performance metrics tracking
let lastBatchReadDuration = 0;
let totalReadsProcessed = 0;
let batchSizeHistory = [];
let batchDurationHistory = [];

// Dynamic cache TTL based on polling interval
let CACHE_TTL = 100; // Default 100ms cache TTL
const MIN_CACHE_TTL = 5; // Minimum 5ms
const MODULE_CACHE_TTL = 5000; // Module cache TTL (5 seconds)
const RESOLVED_ADDRESS_CACHE_TTL = 1000; // Resolved address cache TTL (1 second)

// Track last cleanup time
let lastCacheCleanup = Date.now();

// Determine how many worker threads to use
const MAX_WORKERS = Math.max(1, Math.min(os.cpus().length - 1, 6)); // Max 6 threads, min 1
const MIN_ADDRESSES_PER_WORKER = 0; // Set to 0 to force the worker rather than legacy version due to legacy moduleName issues

// Worker pool management
let workerPool = [];
let isUsingWorkers = false;

/**
 * Set the cache TTL based on polling interval
 * @param {number} pollInterval - Polling interval in milliseconds
 */
function setCacheTTL(pollInterval) {
  if (!pollInterval || pollInterval < 0) return;
  
  // Set cache TTL to be slightly less than polling interval
  // For very fast polling, use minimal caching
  if (pollInterval <= 20) {
    CACHE_TTL = MIN_CACHE_TTL;
  } else {
    CACHE_TTL = Math.max(MIN_CACHE_TTL, Math.floor(pollInterval * 0.8));
  }
  
  // Use async logging to not block when logging TTL changes
  if (!isHighPerformanceMode()) {
    logToFileAsync(`Memory cache TTL set to ${CACHE_TTL}ms (poll interval: ${pollInterval}ms)`);
  }
}

/**
 * Get a cached module base address or fetch a new one
 * @param {string} processName - Process name
 * @param {string} moduleName - Module name
 * @returns {Promise<object>} Module base address result
 */
async function getCachedModuleBase(processName, moduleName) {
  const cacheKey = `${processName}:${moduleName}`.toLowerCase();
  
  // Return from cache if available
  if (moduleBaseCache.has(cacheKey)) {
    const cached = moduleBaseCache.get(cacheKey);
    // Only use cache if not expired
    if (Date.now() - cached.timestamp < MODULE_CACHE_TTL) {
      return cached.data;
    }
    // Remove expired cache entry
    moduleBaseCache.delete(cacheKey);
  }
  
  // Fetch new module base
  try {
    const result = await findModuleBaseAddress(processName, moduleName);
    
    if (result.success) {
      moduleBaseCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
    }
    
    return result;
  } catch (error) {
    // Skip logging in high performance mode
    if (!isHighPerformanceMode()) {
      logToFileAsync(`Failed to get module base for ${moduleName} in ${processName}: ${error.message}`);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Clear expired cache entries
 */
function cleanupCache() {
  const now = Date.now();
  
  // Only run cleanup every second
  if (now - lastCacheCleanup < 1000) {
    return;
  }
  
  lastCacheCleanup = now;
  
  // Clean up memory read cache
  for (const [key, entry] of memoryReadCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      memoryReadCache.delete(key);
    }
  }
  
  // Clean up resolved address cache
  for (const [key, entry] of resolvedAddressCache.entries()) {
    if (now - entry.timestamp > RESOLVED_ADDRESS_CACHE_TTL) {
      resolvedAddressCache.delete(key);
    }
  }
  
  // Trim performance metrics history to prevent memory growth
  if (batchSizeHistory.length > 50) {
    batchSizeHistory = batchSizeHistory.slice(-50);
  }
  
  if (batchDurationHistory.length > 50) {
    batchDurationHistory = batchDurationHistory.slice(-50);
  }
}

/**
 * Create a new worker thread
 * @returns {Promise<Worker>} Worker instance
 */
function createWorker() {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(path.join(__dirname, 'workers/memoryReadWorker.js'));
      
      worker.on('error', (error) => {
        if (!isHighPerformanceMode()) {
          logToFileAsync(`Worker error: ${error.message}`);
        }
        
        // Remove worker from pool if it errors
        workerPool = workerPool.filter(w => w !== worker);
      });
      
      worker.on('exit', (code) => {
        if (code !== 0 && !isHighPerformanceMode()) {
          logToFileAsync(`Worker exited with code ${code}`);
        }
        
        // Remove worker from pool when it exits
        workerPool = workerPool.filter(w => w !== worker);
      });
      
      // Wait for the worker to be ready
      worker.once('message', (message) => {
        if (message.type === 'ready') {
          resolve(worker);
        } else {
          reject(new Error('Worker failed to initialize'));
        }
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Make sure we have enough workers in the pool
 * @param {number} count - Number of workers needed
 * @returns {Promise<void>}
 */
async function ensureWorkerPool(count) {
  // Don't create more than MAX_WORKERS
  const targetCount = Math.min(count, MAX_WORKERS);
  
  // Filter out any workers that aren't alive
  workerPool = workerPool.filter(worker => {
    try {
      return worker && !worker.exitCode;
    } catch (e) {
      return false;
    }
  });
  
  // Create new workers if needed
  while (workerPool.length < targetCount) {
    try {
      const worker = await createWorker();
      workerPool.push(worker);
      
      if (!isHighPerformanceMode()) {
        logToFileAsync(`Created worker thread (${workerPool.length}/${targetCount})`);
      }
    } catch (error) {
      if (!isHighPerformanceMode()) {
        logToFileAsync(`Failed to create worker: ${error.message}`);
      }
      // If we can't create workers, break out of the loop
      break;
    }
  }
  
  return workerPool.length;
}

/**
 * Terminate all worker threads
 */
async function terminateWorkers() {
  try {
    for (const worker of workerPool) {
      try {
        worker.postMessage({ type: 'terminate' });
        // Grace period for workers to shut down
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Force terminate if still running
        if (!worker.exitCode) {
          worker.terminate();
        }
      } catch (e) {
        // Ignore errors when terminating workers
      }
    }
    workerPool = [];
    isUsingWorkers = false;
  } catch (e) {
    if (!isHighPerformanceMode()) {
      logToFileAsync(`Error terminating workers: ${e.message}`);
    }
  }
}

/**
 * Process a batch of memory reads using worker threads
 * @param {string} processName - Process name
 * @param {Array} addresses - Array of address objects
 * @returns {Promise<Array>} Array of results
 */
async function readMemoryWithWorkers(processName, addresses) {
  // Determine how many workers to use - FORCE workers if fast mode is enabled
  const hasFastMode = addresses.some(addr => addr.fastModeEnabled === true);
  const workerCount = Math.min(
    MAX_WORKERS,
    Math.max(1, hasFastMode ? Math.max(2, Math.ceil(addresses.length / 5)) : Math.ceil(addresses.length / MIN_ADDRESSES_PER_WORKER))
  );
  
  // Make sure we have enough workers
  const availableWorkers = await ensureWorkerPool(workerCount);
  
  if (availableWorkers === 0) {
    // Fall back to legacy method if we can't create workers
    if (!isHighPerformanceMode()) {
      logToFileAsync('No workers available, falling back to legacy memory reading');
    }
    return await readMemoryLegacy(processName, addresses);
  }
  
  // Log worker usage for performance debugging
  if (!isHighPerformanceMode() && hasFastMode) {
    logToFileAsync(`Using ${availableWorkers} workers for ${addresses.length} addresses (fast mode enabled)`);
  }
  
  // Divide addresses among workers
  const chunks = [];
  const chunkSize = Math.ceil(addresses.length / availableWorkers);
  
  for (let i = 0; i < addresses.length; i += chunkSize) {
    chunks.push(addresses.slice(i, i + chunkSize));
  }
  
  // Process each chunk in parallel
  const workerPromises = chunks.map((chunk, index) => {
    return new Promise((resolve) => {
      if (index >= workerPool.length) {
        // This shouldn't happen if ensureWorkerPool worked correctly
        resolve([]);
        return;
      }
      
      const worker = workerPool[index];
      
      // Create a timeout for worker response
      const timeoutId = setTimeout(() => {
        if (!isHighPerformanceMode()) {
          logToFileAsync(`Worker ${index} timed out, restarting...`);
        }
        
        try {
          worker.terminate();
        } catch (e) {
          // Ignore errors when terminating workers
        }
        
        // Remove from pool
        workerPool = workerPool.filter(w => w !== worker);
        
        // Resolve with empty results to prevent hanging
        resolve([]);
      }, 5000); // 5 second timeout
      
      // Handle worker response
      const messageHandler = (message) => {
        if (message.type === 'result' && message.workerId === index) {
          // Clear timeout
          clearTimeout(timeoutId);
          
          // Remove this specific message listener
          worker.removeListener('message', messageHandler);
          
          // Process metrics
          if (message.metrics) {
            totalReadsProcessed += message.metrics.readsProcessed;
          }
          
          // Return results
          resolve(message.results || []);
        }
      };
      
      // Listen for worker messages
      worker.on('message', messageHandler);
      
      // Send the work to the worker
      worker.postMessage({
        type: 'read_batch',
        processName,
        addresses: chunk,
        workerId: index
      });
    });
  });
  
  // Wait for all workers to complete
  const chunkResults = await Promise.all(workerPromises);
  
  // Flatten the results
  return chunkResults.flat();
}

/**
 * Legacy memory reading method (using readRealMemory directly)
 * @param {string} processName - Process name
 * @param {Array} addresses - Array of address objects
 * @returns {Promise<Array>} Array of results
 */
async function readMemoryLegacy(processName, addresses) {
  if (!processName || !addresses || !Array.isArray(addresses) || addresses.length === 0) {
    return [];
  }
  
  // Check if any address has disableCaching flag
  const disableCaching = addresses.some(addr => addr.disableCaching === true);
  
  // Only clean up cache if we're using it
  if (!disableCaching) {
    cleanupCache();
  }
  
  // Group addresses by module to minimize module base lookups
  const moduleGroups = {};
  
  // Sort addresses into groups
  for (const addr of addresses) {
    const useModuleOffset = addr.useModuleOffset;
    const moduleName = useModuleOffset ? (addr.moduleName || processName) : null;
    
    // Create a group key based on address type
    const groupKey = moduleName ? moduleName.toLowerCase() : 'direct';
    
    if (!moduleGroups[groupKey]) {
      moduleGroups[groupKey] = [];
    }
    
    moduleGroups[groupKey].push(addr);
  }
  
  // Process all groups in parallel and gather results
  const groupPromises = Object.entries(moduleGroups).map(async ([groupKey, groupAddresses]) => {
    // If this is a module group, get the module base address first
    let moduleBase = null;
    
    if (groupKey !== 'direct') {
      moduleBase = await getCachedModuleBase(processName, groupKey);
      if (!moduleBase.success) {
        // If module not found, mark all addresses in this group as failed
        return groupAddresses.map(addr => ({
          id: addr.id,
          index: addr.index,
          success: false,
          value: null,
          error: `Module ${groupKey} not found: ${moduleBase.error}`
        }));
      }
    }
    
    // For each address, create a promise for memory reading without awaiting it
    const readPromises = groupAddresses.map(addr => {
      // Create a unique identifier for this particular address
      const addrId = addr.id || addr.index;
      
      // Skip cache if disableCaching is true for this address or globally
      const skipCache = disableCaching || addr.disableCaching;
      
      // Check if this address has a cached resolved address from previous reads
      const hasResolvedCache = !skipCache && 
                              resolvedAddressCache.has(addrId) && 
                              addr.fastModeEnabled && 
                              addr.offsets && 
                              addr.offsets.length > 0;
                              
      // Create cache key for memory value if not skipping cache
      let cacheKey = null;
      if (!skipCache) {
        cacheKey = JSON.stringify({
          process: processName,
          address: addr.address,
          moduleName: addr.moduleName,
          offset: addr.offset,
          offsetFormat: addr.offsetFormat,
          type: addr.type,
          offsets: addr.offsets || [],
          bitmask: addr.bitmask,
          bitwiseOp: addr.bitwiseOp
        });
        
        // Check memory value cache first
        if (memoryReadCache.has(cacheKey)) {
          const cached = memoryReadCache.get(cacheKey);
          // Return cached result if not expired
          if (Date.now() - cached.timestamp < CACHE_TTL) {
            return Promise.resolve({
              id: addr.id,
              index: addr.index,
              ...cached.data
            });
          }
          // Remove expired cache entry
          memoryReadCache.delete(cacheKey);
        }
      }
      
      // Create a promise to read the memory address (not awaited yet)
      return new Promise(resolve => {
        try {
          // OPTIMIZATION: Use cached resolved address if available in fast mode
          let addressToUse = { ...addr };
          
          if (hasResolvedCache) {
            const resolvedCache = resolvedAddressCache.get(addrId);
            // Use the previously resolved absolute address directly
            addressToUse = {
              ...addr,
              address: resolvedCache.address,
              useModuleOffset: false,  // Force direct address mode
              resolvedFromCache: true  // Mark as resolved from cache
            };
          }
          else if (addr.useModuleOffset && moduleBase && moduleBase.success) {
            // For performance, calculate absolute address instead of using module+offset
            if (!addr.offsets || addr.offsets.length === 0) {
              // Only optimize non-pointer chains
              const offsetValue = addr.offsetFormat === 'hex'
                ? parseInt(addr.offset.replace(/^0x/i, ""), 16)
                : parseInt(addr.offset, 10);
              
              // Use pre-calculated absolute address
              addressToUse = {
                ...addr,
                address: moduleBase.baseAddress + offsetValue,
                useModuleOffset: false  // Mark as direct address
              };
            }
          }
          
          // Actually read memory (wrapped in Promise.resolve to ensure we return a Promise)
          Promise.resolve(readRealMemory(processName, addressToUse, addr.type))
            .then(result => {
              // Cache the successful result if caching is enabled
              if (!skipCache && result.success) {
                if (cacheKey) {
                  memoryReadCache.set(cacheKey, {
                    data: result,
                    timestamp: Date.now()
                  });
                }
                
                // If this is a pointer chain that was successfully resolved, cache the final address
                if (addr.offsets && addr.offsets.length > 0 && result.resolvedAddress) {
                  resolvedAddressCache.set(addrId, {
                    address: result.resolvedAddress,
                    timestamp: Date.now()
                  });
                  
                  if (!isHighPerformanceMode() && !hasResolvedCache) {
                    logToFileAsync(`Cached resolved address for ID ${addrId}: 0x${result.resolvedAddress.toString(16)}`);
                  }
                }
              }
              
              resolve({
                id: addr.id,
                index: addr.index,
                ...result
              });
            })
            .catch(error => {
              resolve({
                id: addr.id,
                index: addr.index,
                success: false,
                value: null,
                error: `Memory read failed: ${error.message}`
              });
            });
            
        } catch (error) {
          resolve({
            id: addr.id,
            index: addr.index,
            success: false,
            value: null,
            error: `Memory read failed: ${error.message}`
          });
        }
      });
    });
    
    // Use Promise.allSettled instead of Promise.all to make sure we handle all addresses
    // even if some of them fail - a critical improvement for stability
    const settledResults = await Promise.allSettled(readPromises);
    
    // Process the settled promises and handle any rejections (which shouldn't happen with our approach)
    return settledResults.map((result, idx) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // This is a fallback that should rarely if ever be hit due to our internal error handling
        return {
          id: groupAddresses[idx].id,
          index: groupAddresses[idx].index, 
          success: false,
          value: null,
          error: `Promise rejected: ${result.reason}`
        };
      }
    });
  });
  
  // Wait for all groups to complete in parallel and flatten results
  const groupResultsSettled = await Promise.allSettled(groupPromises);
  
  // Handle results from all groups, even if some groups failed completely
  const finalResults = groupResultsSettled.reduce((all, result) => {
    if (result.status === 'fulfilled') {
      return all.concat(result.value);
    }
    // If an entire group failed (unlikely), log the error but don't crash
    if (!isHighPerformanceMode()) {
      logToFileAsync(`Group memory read failed: ${result.reason}`);
    }
    return all;
  }, []);
  
  return finalResults;
}

/**
 * Read memory for a batch of addresses using true concurrency with worker threads
 * @param {string} processName - Process name
 * @param {Array} addresses - Array of address objects
 * @returns {Promise<Array>} Results for each address
 */
async function readMemoryBatch(processName, addresses) {
  if (!processName || !addresses || !Array.isArray(addresses) || addresses.length === 0) {
    return [];
  }
  
  const batchStartTime = Date.now();
  
  // Check if any address has fastModeEnabled flag 
  const fastModeEnabled = addresses.some(addr => addr.fastModeEnabled === true);
  
  // PERFORMANCE FIX: Always use workers if fast mode is enabled OR we have multiple addresses
  const shouldUseWorkers = fastModeEnabled || addresses.length > 1;
  
  try {
    // Use either worker-based or legacy reading
    const results = shouldUseWorkers
      ? await readMemoryWithWorkers(processName, addresses)
      : await readMemoryLegacy(processName, addresses);
    
    // Track performance metrics
    lastBatchReadDuration = Date.now() - batchStartTime;
    totalReadsProcessed += addresses.length;
    
    // Only track metrics in normal mode to avoid performance impact
    if (!isHighPerformanceMode()) {
      batchSizeHistory.push(addresses.length);
      batchDurationHistory.push(lastBatchReadDuration);
      
      // Log when worker mode changes
      if (shouldUseWorkers !== isUsingWorkers) {
        isUsingWorkers = shouldUseWorkers;
        logToFileAsync(`Memory reading mode: ${isUsingWorkers ? 'Workers' : 'Legacy'} (fast mode: ${fastModeEnabled})`);
      }
    }
    
    // Update our tracking
    isUsingWorkers = shouldUseWorkers;
    
    return results;
  } catch (error) {
    // If worker-based reading fails, fall back to legacy mode
    if (shouldUseWorkers && !isHighPerformanceMode()) {
      logToFileAsync(`Worker-based reading failed: ${error.message}, falling back to legacy mode`);
    }
    
    try {
      // Fall back to legacy mode
      return await readMemoryLegacy(processName, addresses);
    } catch (fallbackError) {
      if (!isHighPerformanceMode()) {
        logToFileAsync(`Legacy reading also failed: ${fallbackError.message}`);
      }
      
      // Return error results for all addresses
      return addresses.map(addr => ({
        id: addr.id,
        index: addr.index,
        success: false,
        value: null,
        error: `Memory read failed: ${fallbackError.message}`
      }));
    }
  }
}

/**
 * Get performance metrics
 * @returns {Object} Performance metrics
 */
function getBatchPerformanceMetrics() {
  let avgBatchSize = 0;
  let avgBatchDuration = 0;
  
  if (batchSizeHistory.length > 0) {
    avgBatchSize = batchSizeHistory.reduce((sum, size) => sum + size, 0) / batchSizeHistory.length;
  }
  
  if (batchDurationHistory.length > 0) {
    avgBatchDuration = batchDurationHistory.reduce((sum, dur) => sum + dur, 0) / batchDurationHistory.length;
  }
  
  return {
    lastBatchReadDuration,
    avgBatchSize,
    avgBatchDuration,
    totalReadsProcessed,
    cacheSize: memoryReadCache.size,
    moduleCacheSize: moduleBaseCache.size,
    resolvedAddressCacheSize: resolvedAddressCache.size,
    workerCount: workerPool.length,
    usingWorkers: isUsingWorkers
  };
}

/**
 * Clear all caches
 */
function clearAllCaches() {
  moduleBaseCache.clear();
  memoryReadCache.clear();
  resolvedAddressCache.clear();
  
  // Reset performance metrics
  batchSizeHistory = [];
  batchDurationHistory = [];
  
  // Skip logging in high performance mode
  if (!isHighPerformanceMode()) {
    logToFileAsync('Memory caches cleared');
  }
  
  return true;
}

// Make sure workers are terminated when the process exits
process.on('exit', () => {
  terminateWorkers();
});

module.exports = {
  readMemoryBatch,
  getCachedModuleBase,
  clearAllCaches,
  setCacheTTL,
  getBatchPerformanceMetrics,
  terminateWorkers  // Export this so the main process can clean up
};
