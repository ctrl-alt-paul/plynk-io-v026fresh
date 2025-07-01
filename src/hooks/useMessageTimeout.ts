
import { useRef, useCallback, useEffect, useState } from 'react';

interface MessageTimeoutOptions {
  timeoutSeconds: number;
  onTimeout: () => void;
  enabled: boolean;
}

export const useMessageTimeout = ({ timeoutSeconds, onTimeout, enabled }: MessageTimeoutOptions) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [lastMessageTime, setLastMessageTime] = useState<number>(Date.now());

  // Reset the timeout timer
  const resetTimeout = useCallback(() => {
    if (!enabled) return;

    const now = Date.now();
    setLastMessageTime(now);
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      onTimeout();
    }, timeoutSeconds * 1000);
  }, [timeoutSeconds, onTimeout, enabled]);

  // Start the timeout timer
  const startTimeout = useCallback(() => {
    if (!enabled) return;
    resetTimeout();
  }, [resetTimeout, enabled]);

  // Stop the timeout timer
  const stopTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Record message activity
  const recordMessage = useCallback(() => {
    if (!enabled) return;
    resetTimeout();
  }, [resetTimeout, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimeout();
    };
  }, [stopTimeout]);

  // Update timeout when settings change
  useEffect(() => {
    if (enabled && timeoutRef.current) {
      resetTimeout();
    } else if (!enabled) {
      stopTimeout();
    }
  }, [timeoutSeconds, enabled, resetTimeout, stopTimeout]);

  return {
    startTimeout,
    stopTimeout,
    recordMessage,
    lastMessageTime // Return reactive state instead of getter function
  };
};
