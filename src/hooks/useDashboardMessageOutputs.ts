
import { useState, useCallback } from 'react';
import { MessageProfileOutput } from '@/types/messageProfiles';

export const useDashboardMessageOutputs = () => {
  const [outputs, setOutputs] = useState<MessageProfileOutput[]>([]);

  const handleMessageOutput = useCallback((data: any) => {
    // Handle LABEL or TEXT packets: { key, label } or { key, text }
    if (
      data &&
      typeof data === "object" &&
      "key" in data &&
      ("label" in data || "text" in data)
    ) {
      const key = data.key as string;
      const name = (("label" in data ? data.label : data.text) as string);

      setOutputs(prev => {
        const idx = prev.findIndex(o => o.key === key);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx].label = name;
          return copy;
        }
        return [...prev, { key, label: name, lastValue: 0, format: "", script: "" }];
      });
      return;
    }

    // Handle VALUE packets: { key, value }
    if (
      data &&
      typeof data === "object" &&
      "key" in data &&
      "value" in data
    ) {
      const key = data.key as string;
      const value = data.value as number | string;

      setOutputs(prev => {
        const idx = prev.findIndex(o => o.key === key);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx].lastValue = value;
          return copy;
        }
        return [...prev, { key, label: key, lastValue: value, format: "", script: "" }];
      });
      return;
    }
  }, []);

  const loadGameProfileOutputs = useCallback((gameProfile: any) => {
    if (gameProfile?.outputs) {
      const messageOutputs = gameProfile.outputs
        .filter((output: any) => output.type === 'Message')
        .map((output: any) => ({
          key: output.key,
          label: output.label,
          lastValue: 0,
          format: output.format || "",
          script: output.script || ""
        }));
      setOutputs(messageOutputs);
    }
  }, []);

  const clearOutputs = useCallback(() => {
    setOutputs([]);
  }, []);

  return {
    outputs,
    handleMessageOutput,
    loadGameProfileOutputs,
    clearOutputs
  };
};
