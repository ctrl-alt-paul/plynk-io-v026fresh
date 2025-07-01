
import { useState, useEffect } from 'react';

interface ProcessMonitorStatus {
  isRunning: boolean;
  diagnostics?: {
    activeProfile: string;
    activePID: string;
    pollingStatus: string;
  };
}

interface MemoryMetrics {
  pollsPerSecond: number;
  skippedPolls: number;
  lastPollDuration: number;
  avgPollDuration: number;
}

interface DashboardData {
  processName: string | null;
  pid: number | null;
  activeGameProfile: string | null;
  activeMemoryProfile: string | null;
  isPolling: boolean;
  activeOutputs: { enabled: number; total: number };
  targetInterval: number;
  currentPollRate: number;
  skippedPolls: number;
  isLoading: boolean;
}

export function useDashboardData(): DashboardData {
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    processName: null,
    pid: null,
    activeGameProfile: null,
    activeMemoryProfile: null,
    isPolling: false,
    activeOutputs: { enabled: 0, total: 0 },
    targetInterval: 16,
    currentPollRate: 0,
    skippedPolls: 0,
    isLoading: true
  });

  const [gameProfile, setGameProfile] = useState<any>(null);
  const [memoryMetrics, setMemoryMetrics] = useState<MemoryMetrics>({
    pollsPerSecond: 0,
    skippedPolls: 0,
    lastPollDuration: 0,
    avgPollDuration: 0
  });

  useEffect(() => {
    if (!window.electron?.ipcRenderer) {
      setDashboardData(prev => ({ ...prev, isLoading: false }));
      return;
    }

    // Listen for memory metrics updates
    const handleMemoryMetrics = (_event: any, metrics: MemoryMetrics) => {
      setMemoryMetrics(metrics);
    };

    // Set up event listeners
    window.electron.ipcRenderer.on('memory:metrics', handleMemoryMetrics);

    // Function to fetch process status
    const fetchProcessStatus = async () => {
      try {
        const status = await window.electron.ipcRenderer.invoke('process-monitor:get-status') as ProcessMonitorStatus;
        
        if (status.diagnostics) {
          const hasActiveProfile = status.diagnostics.activeProfile !== "None";
          const hasActivePID = status.diagnostics.activePID !== "None";
          
          let processName: string | null = null;
          let pid: number | null = null;
          let memoryProfileName: string | null = null;
          let outputCounts = { enabled: 0, total: 0 };
          let targetInterval = 16;

          if (hasActivePID) {
            pid = parseInt(status.diagnostics.activePID);
            
            // Try to get process list to resolve PID to process name
            try {
              const processes = await window.electron.getProcesses();
              const matchingProcess = processes.find((p: any) => p.th32ProcessID === pid);
              if (matchingProcess) {
                processName = matchingProcess.szExeFile;
              }
            } catch (error) {
              // Silent fail
            }
          }

          if (hasActiveProfile) {
            // Load game profile to get memory profile name and output counts
            try {
              const profileResult = await window.electron.getGameProfile(status.diagnostics.activeProfile);
              if (profileResult.success && profileResult.profile) {
                setGameProfile(profileResult.profile);
                memoryProfileName = profileResult.profile.memoryFile;
                targetInterval = profileResult.profile.pollInterval || 16;
                
                // Use processName from game profile if process lookup failed
                if (!processName && profileResult.profile.processName) {
                  processName = profileResult.profile.processName;
                }
                
                // Count outputs - check for isActive field instead of enabled
                const outputs = profileResult.profile.outputs || [];
                outputCounts.total = outputs.length;
                outputCounts.enabled = outputs.filter((output: any) => output.isActive !== false).length;
              }
            } catch (error) {
              // Silent fail
            }
          }

          // Determine if polling is active based on memory metrics only
          const isPolling = hasActivePID && hasActiveProfile && memoryMetrics.pollsPerSecond > 0;

          setDashboardData(prev => ({
            ...prev,
            processName,
            pid,
            activeGameProfile: hasActiveProfile ? status.diagnostics.activeProfile : null,
            activeMemoryProfile: memoryProfileName,
            activeOutputs: outputCounts,
            targetInterval,
            currentPollRate: memoryMetrics.pollsPerSecond,
            skippedPolls: memoryMetrics.skippedPolls,
            isPolling,
            isLoading: false
          }));
        } else {
          // No diagnostics means no active process
          setDashboardData(prev => ({
            ...prev,
            processName: null,
            pid: null,
            activeGameProfile: null,
            activeMemoryProfile: null,
            activeOutputs: { enabled: 0, total: 0 },
            currentPollRate: memoryMetrics.pollsPerSecond,
            skippedPolls: memoryMetrics.skippedPolls,
            isPolling: false,
            isLoading: false
          }));
        }
      } catch (error) {
        setDashboardData(prev => ({ 
          ...prev, 
          isPolling: false,
          isLoading: false 
        }));
      }
    };

    // Initial fetch
    fetchProcessStatus();

    // Set up polling interval for process status (reduced frequency)
    const intervalId = setInterval(() => {
      fetchProcessStatus();
    }, 2000); // Reduced from 1000ms to 2000ms

    // Cleanup
    return () => {
      window.electron.ipcRenderer.removeAllListeners('memory:metrics');
      clearInterval(intervalId);
    };
  }, [memoryMetrics.pollsPerSecond]);

  return dashboardData;
}
