
interface LogEntry {
  id: string;
  timestamp: string;
  category: string;
  description: string;
  data?: any;
}

interface ConsolidatedLogEntry extends LogEntry {
  isConsolidated: boolean;
  count: number;
  individualEntries?: LogEntry[];
}

/**
 * Consolidates related log entries that occur within a short time window
 * @param logs Array of log entries to consolidate
 * @param timeWindowMs Time window in milliseconds to consider logs as related (default: 2000ms)
 * @returns Array of consolidated log entries
 */
export const consolidateLogs = (logs: LogEntry[], timeWindowMs: number = 2000): ConsolidatedLogEntry[] => {
  if (logs.length === 0) return [];

  const consolidated: ConsolidatedLogEntry[] = [];
  const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let i = 0;
  while (i < sortedLogs.length) {
    const currentLog = sortedLogs[i];
    const currentTime = new Date(currentLog.timestamp).getTime();
    
    // Find all logs in the same category within the time window
    const relatedLogs: LogEntry[] = [currentLog];
    let j = i + 1;
    
    while (j < sortedLogs.length) {
      const nextLog = sortedLogs[j];
      const nextTime = new Date(nextLog.timestamp).getTime();
      
      // Check if logs are in same category and within time window
      if (nextLog.category === currentLog.category && 
          (nextTime - currentTime) <= timeWindowMs &&
          shouldConsolidate(currentLog, nextLog)) {
        relatedLogs.push(nextLog);
        j++;
      } else {
        break;
      }
    }

    // Create consolidated entry
    if (relatedLogs.length > 1) {
      const consolidatedEntry: ConsolidatedLogEntry = {
        ...currentLog,
        id: `consolidated-${currentLog.id}`,
        description: createFlatConsolidatedDescription(relatedLogs),
        isConsolidated: true,
        count: relatedLogs.length,
        individualEntries: relatedLogs
      };
      consolidated.push(consolidatedEntry);
    } else {
      // Single log entry - not consolidated
      const singleEntry: ConsolidatedLogEntry = {
        ...currentLog,
        isConsolidated: false,
        count: 1
      };
      consolidated.push(singleEntry);
    }

    i = j;
  }

  return consolidated;
};

/**
 * Determines if two log entries should be consolidated based on their content
 */
const shouldConsolidate = (log1: LogEntry, log2: LogEntry): boolean => {
  // Same category is already checked before calling this function
  
  // Check for common patterns that should be consolidated
  const consolidationPatterns = [
    // WLED connection related logs
    /WLED.*Connection:/,
    /WLED.*Device Info:/,
    /WLED.*Effects:/,
    /WLED.*Refresh:/,
    /WLED.*Profile/,
    
    // Device testing logs
    /Device.*Test/,
    /Testing.*Device/,
    
    // Memory scanning logs
    /Memory.*Scan/,
    /Scanning.*Memory/,
    
    // Process monitoring logs
    /Process.*Monitor/,
    /Monitoring.*Process/,
    
    // Message scanning logs
    /Received Win32 message:/,
    /Received message output via IPC:/,
    /VALUE:/,
    /key=/
  ];

  // Check if both logs match any consolidation pattern
  for (const pattern of consolidationPatterns) {
    if (pattern.test(log1.description) && pattern.test(log2.description)) {
      return true;
    }
  }

  // Special handling for message-scan category logs
  if (log1.category === 'message-scan' && log2.category === 'message-scan') {
    // Consolidate all message scan logs that happen in quick succession
    return true;
  }

  // Check for similar operation keywords
  const extractOperation = (description: string) => {
    const parts = description.split(' - ');
    return parts.length > 1 ? parts[0] : description.split(':')[0];
  };

  const operation1 = extractOperation(log1.description);
  const operation2 = extractOperation(log2.description);
  
  return operation1 === operation2;
};

/**
 * Creates a flat consolidated description from multiple related log entries
 * All entries are displayed as separate lines under one heading
 */
const createFlatConsolidatedDescription = (logs: LogEntry[]): string => {
  if (logs.length <= 1) return logs[0]?.description || '';

  // Join all individual descriptions with newlines to display them flat
  return logs.map(log => log.description).join('\n');
};

/**
 * Toggles the expanded state of a consolidated log entry (kept for compatibility but not used)
 */
export const toggleLogExpansion = (
  logs: ConsolidatedLogEntry[], 
  logId: string
): ConsolidatedLogEntry[] => {
  // Return logs unchanged since we don't use expansion anymore
  return logs;
};
