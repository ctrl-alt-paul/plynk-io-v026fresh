
import { useState, useCallback } from 'react';
import { MessageProfile, MessageProfileOutput } from '@/types/messageProfiles';

export const useMessageManager = () => {
  const [messageOutputs, setMessageOutputs] = useState<MessageProfileOutput[]>([]);

  const handleLabelChange = useCallback((key: string, newLabel: string) => {
    setMessageOutputs(prev => prev.map(output => 
      output.key === key ? { ...output, label: newLabel } : output
    ));
  }, []);

  const handleFormatChange = useCallback((key: string, newFormat: string) => {
    setMessageOutputs(prev => prev.map(output => 
      output.key === key ? { ...output, format: newFormat } : output
    ));
  }, []);

  const handleScriptChange = useCallback((key: string, newScript: string) => {
    setMessageOutputs(prev => prev.map(output => 
      output.key === key ? { ...output, script: newScript } : output
    ));
  }, []);

  const updateMessageOutput = useCallback((data: any) => {
    if (data && typeof data === "object" && "key" in data) {
      const key = data.key as string;

      if ("label" in data || "text" in data) {
        const label = (("label" in data ? data.label : data.text) as string);
        setMessageOutputs(prev => {
          const idx = prev.findIndex(o => o.key === key);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], label };
            return copy;
          }
          return [...prev, { key, label, lastValue: 0, format: "", script: "" }];
        });
      }

      if ("value" in data) {
        const value = data.value as number | string;
        setMessageOutputs(prev => {
          const idx = prev.findIndex(o => o.key === key);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], lastValue: value };
            return copy;
          }
          return [...prev, { key, label: key, lastValue: value, format: "", script: "" }];
        });
      }
    }
  }, []);

  const clearOutputs = useCallback(() => {
    setMessageOutputs([]);
  }, []);

  const loadProfile = useCallback((profile: MessageProfile) => {
    setMessageOutputs(profile.outputs || []);
  }, []);

  return {
    messageOutputs,
    setMessageOutputs,
    handleLabelChange,
    handleFormatChange,
    handleScriptChange,
    updateMessageOutput,
    clearOutputs,
    loadProfile
  };
};
