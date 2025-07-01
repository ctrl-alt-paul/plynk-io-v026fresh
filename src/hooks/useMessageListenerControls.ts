
import { useState, useEffect } from 'react';
import { useMonitorControlsContext } from '@/contexts/MonitorControlsContext';

interface MessageListenerControls {
  isEnabled: boolean;
  isLoading: boolean;
  toggleMessageListener: () => Promise<void>;
}

export function useMessageListenerControls(): MessageListenerControls {
  const { isMessageListenerEnabled, setMessageListenerEnabled } = useMonitorControlsContext();
  const [isLoading, setIsLoading] = useState(false);

  const toggleMessageListener = async () => {
    if (!window.electron?.ipcRenderer) return;
    
    setIsLoading(true);
    
    try {
      const result = await window.electron.ipcRenderer.invoke('message-listener:toggle', !isMessageListenerEnabled);
      if (result.success) {
        // Update the context state immediately for UI updates
        setMessageListenerEnabled(!isMessageListenerEnabled);
      } else {
        console.error('Failed to toggle message listener:', result.error);
      }
    } catch (error) {
      console.error('Error toggling message listener:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isEnabled: isMessageListenerEnabled,
    isLoading,
    toggleMessageListener
  };
}
