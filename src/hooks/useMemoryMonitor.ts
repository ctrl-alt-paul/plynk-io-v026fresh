
import { useState, useEffect } from 'react';

interface MemoryUsage {
  rss: number; // Resident Set Size in MB (main process)
  heapUsed: number; // Heap used in MB (main process)
  heapTotal: number; // Total heap in MB (main process)
  external: number; // External memory in MB (main process)
  rendererHeap: number; // Renderer JS heap in MB
  totalMemory: number; // Combined total memory usage
}

export const useMemoryMonitor = (intervalMs: number = 3000) => {
  const [memoryUsage, setMemoryUsage] = useState<MemoryUsage | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if we're in Electron environment
    if (!window.electron) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const getMemoryUsage = async () => {
      try {
        if (window.electron.ipcRenderer) {
          // Get main process memory
          const mainMemory = await window.electron.ipcRenderer.invoke('system:get-memory-usage');
          
          // Get renderer process memory
          const rendererMemory = await window.electron.ipcRenderer.invoke('system:get-renderer-memory-usage');
          
          if (mainMemory) {
            const rss = Math.round((mainMemory.rss || 0) / 1024 / 1024);
            const heapUsed = Math.round((mainMemory.heapUsed || 0) / 1024 / 1024);
            const heapTotal = Math.round((mainMemory.heapTotal || 0) / 1024 / 1024);
            const external = Math.round((mainMemory.external || 0) / 1024 / 1024);
            
            // Convert renderer memory from bytes to MB
            const rendererHeap = rendererMemory 
              ? Math.round((rendererMemory.usedJSHeapSize || 0) / 1024 / 1024)
              : 0;
            
            // Calculate total memory (RSS from main process + renderer heap)
            const totalMemory = rss + rendererHeap;
            
            setMemoryUsage({
              rss,
              heapUsed,
              heapTotal,
              external,
              rendererHeap,
              totalMemory
            });
          }
        }
      } catch (error) {
        console.error('Failed to get memory usage:', error);
      }
    };

    // Get initial memory usage
    getMemoryUsage();

    // Set up interval to update memory usage
    const interval = setInterval(getMemoryUsage, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs]);

  return { memoryUsage, isSupported };
};
