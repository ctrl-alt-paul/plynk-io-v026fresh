
import React, { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface LogEntry {
  id: string;
  timestamp: string;
  category: string;
  description: string;
  data?: any;
  isConsolidated?: boolean;
  count?: number;
}

interface LogCategory {
  id: string;
  name: string;
  icon: string;
  colorClass: string;
  enabled: boolean;
}

interface VirtualizedLogListProps {
  logs: LogEntry[];
  categories: LogCategory[];
  isAutoScroll: boolean;
  onScrollToBottom?: () => void;
}

export const VirtualizedLogList: React.FC<VirtualizedLogListProps> = ({
  logs,
  categories,
  isAutoScroll,
  onScrollToBottom
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated height per log entry
    overscan: 10, // Render extra items outside viewport
  });

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (isAutoScroll && logs.length > 0 && parentRef.current) {
      const lastIndex = logs.length - 1;
      virtualizer.scrollToIndex(lastIndex, { align: 'end' });
    }
  }, [logs.length, isAutoScroll, virtualizer]);

  const formatLogEntry = (log: LogEntry, index: number) => {
    const category = categories.find(cat => cat.id === log.category);
    const timestamp = new Date(log.timestamp).toLocaleTimeString();
    
    return (
      <div
        key={log.id}
        data-index={index}
        ref={virtualizer.measureElement}
        className="mb-2"
      >
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

  return (
    <div
      ref={parentRef}
      className="flex-1 w-full overflow-auto"
      style={{ contain: 'strict' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {formatLogEntry(logs[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
};
