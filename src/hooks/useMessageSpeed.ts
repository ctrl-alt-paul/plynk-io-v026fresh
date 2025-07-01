import { useState, useRef, useCallback, useEffect } from 'react';

interface MessageSpeedTracker {
  messageSpeed: number;
  recordMessage: () => void;
  resetSpeed: () => void;
}

export const useMessageSpeed = (): MessageSpeedTracker => {
  const [messageSpeed, setMessageSpeed] = useState(0);
  const messageTimestamps = useRef<number[]>([]);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Record a new message timestamp
  const recordMessage = useCallback(() => {
    const now = Date.now();
    messageTimestamps.current.push(now);
    
    // Keep only timestamps from the last 10 seconds
    const tenSecondsAgo = now - 10000;
    messageTimestamps.current = messageTimestamps.current.filter(
      timestamp => timestamp > tenSecondsAgo
    );
  }, []);

  // Calculate and update message speed
  const calculateSpeed = useCallback(() => {
    const now = Date.now();
    const fiveSecondsAgo = now - 5000;
    
    // Count messages in the last 5 seconds for a more responsive metric
    const recentMessages = messageTimestamps.current.filter(
      timestamp => timestamp > fiveSecondsAgo
    );
    
    // Calculate messages per second
    const speed = recentMessages.length / 5;
    setMessageSpeed(speed);
  }, []);

  // Reset speed counter
  const resetSpeed = useCallback(() => {
    messageTimestamps.current = [];
    setMessageSpeed(0);
  }, []);

  // Set up periodic speed calculation
  useEffect(() => {
    updateIntervalRef.current = setInterval(calculateSpeed, 500);
    
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [calculateSpeed]);

  return {
    messageSpeed,
    recordMessage,
    resetSpeed
  };
};
