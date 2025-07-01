
import { useState, useEffect, useCallback } from 'react';
import { isElectron } from '@/utils/isElectron';

export type MessageStatus = 'off' | 'listening' | 'active';

export const useDashboardMessageStatus = (
  isMessageListenerEnabled: boolean,
  detectedProfile: any,
  logEvent: (category: string, message: string) => void
) => {
  const [messageStatus, setMessageStatus] = useState<MessageStatus>('off');
  const [isListening, setIsListening] = useState(false);

  // Start/stop native listener based on enabled state
  const updateListenerState = useCallback(() => {
    if (isMessageListenerEnabled && !isListening) {
      if (window.messageAPI?.startListener) {
        window.messageAPI.startListener();
        logEvent("message-status", "Win32 message listener started");
      }
      setIsListening(true);
    } else if (!isMessageListenerEnabled && isListening) {
      if (window.messageAPI && typeof (window.messageAPI as any).stopListener === 'function') {
        (window.messageAPI as any).stopListener();
        logEvent("message-status", "Win32 message listener stopped");
      }
      setIsListening(false);
    }
  }, [isMessageListenerEnabled, isListening, logEvent]);

  // Update message status based on current state
  useEffect(() => {
    if (!isMessageListenerEnabled) {
      setMessageStatus('off');
    } else if (detectedProfile) {
      setMessageStatus('active');
    } else {
      setMessageStatus('listening');
    }
  }, [isMessageListenerEnabled, detectedProfile]);

  // Handle listener state changes
  useEffect(() => {
    updateListenerState();
  }, [updateListenerState]);

  return {
    messageStatus,
    isListening
  };
};
