import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useLogContext } from '@/contexts/LogContext';
import { consolidateLogs } from '@/lib/logConsolidator';
import { VirtualizedLogList } from '@/renderer/components/log/VirtualizedLogList';
import { useMemoryMonitor } from '@/hooks/useMemoryMonitor';
import { FileText, MemoryStick } from 'lucide-react';

interface LogCategory {
  id: string;
  name: string;
  icon: string;
  colorClass: string;
  enabled: boolean;
}

const defaultLogCategories: LogCategory[] = [
  { id: 'warning', name: 'Warnings / Debug / Errors', icon: '⚠️', colorClass: 'text-red-500', enabled: false },
  { id: 'startup', name: 'Start Up Logs', icon: '🚀', colorClass: 'text-indigo-500', enabled: false },
  { id: 'process', name: 'Process Monitor Logs', icon: '🧠', colorClass: 'text-yellow-600', enabled: false },
  { id: 'memory', name: 'Memory Scanning Logs', icon: '📈', colorClass: 'text-green-600', enabled: false },
  { id: 'device', name: 'Device Logs', icon: '🛠️', colorClass: 'text-purple-500', enabled: false },
  { id: 'dispatch', name: 'Dispatch Logs', icon: '📤', colorClass: 'text-amber-500', enabled: false },
  { id: 'testing', name: 'Device Testing Logs', icon: '🧪', colorClass: 'text-cyan-600', enabled: false },
  { id: 'output', name: 'Output Logs', icon: '🔧', colorClass: 'text-gray-600', enabled: false },
  { id: 'wled', name: 'WLED Logs', icon: '🌈', colorClass: 'text-pink-500', enabled: false },
  { id: 'wled-scripts', name: 'WLED Scripts', icon: '📋', colorClass: 'text-violet-600', enabled: false },
  { id: 'debug', name: 'Debug / Info', icon: '🐞', colorClass: 'text-blue-500', enabled: false },
  { id: 'message-scan', name: 'Messaging Scan Logs', icon: '📩', colorClass: 'text-teal-500', enabled: false },
  { id: 'message-listen', name: 'Messaging Listening Logs', icon: '🎧', colorClass: 'text-orange-500', enabled: false }
];

const Log: React.FC = () => {
  // Use the global log context instead of local state
  const { logs, clearLogs, maxLogEntries } = useLogContext();
  
  const [categories, setCategories] = useState<LogCategory[]>(defaultLogCategories);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [consolidateView, setConsolidateView] = useState(true);
  const [enableVirtualization, setEnableVirtualization] = useState(true);
  const [consolidatedLogs, setConsolidatedLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { memoryUsage, isSupported: isMemorySupported } = useMemoryMonitor();

  // Load settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      if (!window.electron?.getLogPageConfig) {
        setIsLoading(false);
        return;
      }

      try {
        const result = await window.electron.getLogPageConfig();
        
        if (result.success !== false) {
          // Update auto-scroll setting
          if (typeof result.autoScroll === 'boolean') {
            setIsAutoScroll(result.autoScroll);
          }

          // Update consolidate view setting
          const resultAny = result as any;
          if (typeof resultAny.consolidateView === 'boolean') {
            setConsolidateView(resultAny.consolidateView);
          }

          // Update virtualization setting
          if (typeof resultAny.enableVirtualization === 'boolean') {
            setEnableVirtualization(resultAny.enableVirtualization);
          }

          // Update category enabled states from saved settings
          if (result.categories) {
            setCategories(prev => 
              prev.map(cat => ({
                ...cat,
                enabled: result.categories[cat.id] || false
              }))
            );
          }
        }
      } catch (error) {
        console.error('Failed to load log page settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Process logs for consolidation when logs or view mode changes
  useEffect(() => {
    const enabledCategories = categories.filter(cat => cat.enabled).map(cat => cat.id);
    const filteredLogs = logs.filter(log => enabledCategories.includes(log.category));
    
    if (consolidateView) {
      const consolidated = consolidateLogs(filteredLogs);
      setConsolidatedLogs(consolidated);
    } else {
      setConsolidatedLogs(filteredLogs.map(log => ({ ...log, isConsolidated: false, count: 1 })));
    }
  }, [logs, categories, consolidateView]);

  // Save settings whenever they change
  const saveSettings = async (newAutoScroll?: boolean, newCategories?: LogCategory[], newConsolidateView?: boolean, newEnableVirtualization?: boolean) => {
    if (!window.electron?.updateLogPageConfig) return;

    try {
      const categoriesToSave = newCategories || categories;
      const autoScrollToSave = newAutoScroll !== undefined ? newAutoScroll : isAutoScroll;
      const consolidateToSave = newConsolidateView !== undefined ? newConsolidateView : consolidateView;
      const virtualizationToSave = newEnableVirtualization !== undefined ? newEnableVirtualization : enableVirtualization;

      const categoriesObj = categoriesToSave.reduce((acc, cat) => {
        acc[cat.id] = cat.enabled;
        return acc;
      }, {} as Record<string, boolean>);

      const configUpdate: any = {
        autoScroll: autoScrollToSave,
        consolidateView: consolidateToSave,
        enableVirtualization: virtualizationToSave,
        categories: categoriesObj
      };

      await window.electron.updateLogPageConfig(configUpdate);
    } catch (error) {
      console.error('Failed to save log page settings:', error);
    }
  };

  // Auto-scroll to bottom when new logs arrive (only for non-virtualized mode)
  useEffect(() => {
    if (isAutoScroll && !enableVirtualization && scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [consolidatedLogs, isAutoScroll, enableVirtualization]);

  const toggleCategory = (categoryId: string) => {
    const newCategories = categories.map(cat => 
      cat.id === categoryId ? { ...cat, enabled: !cat.enabled } : cat
    );
    setCategories(newCategories);
    saveSettings(undefined, newCategories);
  };

  const toggleAllCategories = () => {
    const allEnabled = categories.every(cat => cat.enabled);
    const newCategories = categories.map(cat => ({
      ...cat,
      enabled: !allEnabled
    }));
    setCategories(newCategories);
    saveSettings(undefined, newCategories);
  };

  const handleAutoScrollChange = (checked: boolean) => {
    setIsAutoScroll(checked);
    saveSettings(checked);
  };

  const handleConsolidateViewChange = (checked: boolean) => {
    setConsolidateView(checked);
    saveSettings(undefined, undefined, checked);
  };

  const handleVirtualizationChange = (checked: boolean) => {
    setEnableVirtualization(checked);
    saveSettings(undefined, undefined, undefined, checked);
  };

  const handleClearLogs = () => {
    clearLogs();
    toast({
      title: "Logs Cleared",
      description: "All log entries have been cleared from memory.",
    });
  };

  const writeToFile = async () => {
    if (!window.electron) return;

    try {
      const enabledCategories = categories.filter(cat => cat.enabled).map(cat => cat.id);
      const filteredLogs = logs.filter(log => enabledCategories.includes(log.category));

      if (filteredLogs.length === 0) {
        toast({
          title: "No Logs to Export",
          description: "No visible logs to write to file.",
          variant: "destructive"
        });
        return;
      }

      const result = await window.electron.ipcRenderer.invoke('log:writeToFile', filteredLogs);
      
      if (result.success) {
        toast({
          title: "Logs Exported",
          description: `Logs written to: ${result.filePath}`,
        });
      } else {
        toast({
          title: "Export Failed",
          description: result.error || "Failed to write logs to file.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Export Error",
        description: "An error occurred while exporting logs.",
        variant: "destructive"
      });
    }
  };

  const formatLogEntry = (log: any) => {
    const category = categories.find(cat => cat.id === log.category);
    const timestamp = new Date(log.timestamp).toLocaleTimeString();
    
    return (
      <div key={log.id} className="mb-2">
        <div className={`${category?.colorClass || 'text-gray-600'} flex items-start gap-2 p-2 rounded-sm hover:bg-gray-50 dark:hover:bg-gray-800`}>
          <span className="text-lg">{category?.icon || '📝'}</span>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-sm font-medium flex items-center gap-2">
              <span>[{timestamp}] {category?.name.toUpperCase() || log.category.toUpperCase()}</span>
              {log.isConsolidated && (
                <span className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full text-xs">
                  {log.count} entries
                </span>
              )}
            </div>
            <pre className="text-xs whitespace-pre-wrap mt-1 text-gray-700 dark:text-gray-300">
              {log.description}
              {log.data && typeof log.data === 'object' && (
                '\n' + JSON.stringify(log.data, null, 2)
              )}
            </pre>
          </div>
        </div>
      </div>
    );
  };

  const enabledCategories = categories.filter(cat => cat.enabled).map(cat => cat.id);
  const allCategoriesEnabled = categories.every(cat => cat.enabled);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">Loading log settings...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 pb-0">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-6 w-6" />
              <h1 className="text-2xl font-bold">System Logs</h1>
            </div>
            <div className="flex items-center gap-4">
              {isMemorySupported && memoryUsage && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MemoryStick className="h-4 w-4" />
                  <span>App Memory: {memoryUsage.totalMemory}MB</span>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={handleClearLogs} variant="outline">
                  Clear Logs
                </Button>
                <Button onClick={writeToFile}>
                  Write to File
                </Button>
              </div>
            </div>
          </div>
          
          <p className="text-muted-foreground mt-1 mb-0">
            Monitor system activity in real-time with categorized logging. Filter by log type, consolidate similar entries, 
            and export logs for troubleshooting and analysis. Max {maxLogEntries.toLocaleString()} entries retained in memory.
          </p>
        </div>
      </div>

      <div className="flex-1 flex gap-6 p-6 pt-0 min-h-0">
        {/* Filter Panel - Fixed width, always on the left */}
        <Card className="w-80 min-w-80 flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg">Log Categories</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="autoscroll"
                checked={isAutoScroll}
                onCheckedChange={(checked) => handleAutoScrollChange(checked === true)}
              />
              <label htmlFor="autoscroll" className="text-sm font-medium">
                Auto-scroll to bottom
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="consolidate"
                checked={consolidateView}
                onCheckedChange={(checked) => handleConsolidateViewChange(checked === true)}
              />
              <label htmlFor="consolidate" className="text-sm font-medium">
                Consolidate related logs
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="virtualization"
                checked={enableVirtualization}
                onCheckedChange={(checked) => handleVirtualizationChange(checked === true)}
              />
              <label htmlFor="virtualization" className="text-sm font-medium">
                Enable virtualization
              </label>
            </div>

            <Button
              onClick={toggleAllCategories}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {allCategoriesEnabled ? 'Deselect All' : 'Select All'}
            </Button>
            
            <Separator />
            <ScrollArea className="flex-1">
              <div className="space-y-3 pr-4">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={category.id}
                      checked={category.enabled}
                      onCheckedChange={(checked) => {
                        if (checked !== "indeterminate") {
                          toggleCategory(category.id);
                        }
                      }}
                    />
                    <label 
                      htmlFor={category.id} 
                      className="text-sm font-medium cursor-pointer flex items-center gap-2"
                    >
                      <span>{category.icon}</span>
                      <span className={category.colorClass}>{category.name}</span>
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Log Display - Takes remaining space, always on the right */}
        <Card className="flex-1 flex flex-col min-w-0">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Live Logs ({consolidatedLogs.length}/{logs.length})</span>
              <span className="text-sm font-normal text-gray-500">
                {enabledCategories.length === 0 ? 'No categories selected' : `${enabledCategories.length} categories active`}
                {consolidateView && ' • Consolidated'}
                {enableVirtualization && ' • Virtualized'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0">
            {enabledCategories.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p>No categories selected. Enable log categories to view entries.</p>
              </div>
            ) : consolidatedLogs.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p>No log entries to display. Logs will appear here in real-time.</p>
              </div>
            ) : enableVirtualization ? (
              <VirtualizedLogList
                logs={consolidatedLogs}
                categories={categories}
                isAutoScroll={isAutoScroll}
              />
            ) : (
              <ScrollArea ref={scrollAreaRef} className="flex-1 w-full">
                <div className="space-y-1">
                  {consolidatedLogs.map(formatLogEntry)}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Log;
