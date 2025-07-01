
import { useState, useCallback, useEffect } from 'react';
import { MessageProfileOutput } from '@/types/messageProfiles';
import { useUnsavedChanges } from '@/components/UnsavedChangesProvider';

export const useMessageOutputs = (isLoadingProfile?: boolean) => {
  const { setHasUnsavedChanges } = useUnsavedChanges();
  const [outputs, setOutputs] = useState<MessageProfileOutput[]>([]);
  const [originalOutputs, setOriginalOutputs] = useState<MessageProfileOutput[]>([]);

  // Deep compare outputs to detect changes
  const outputsChanged = useCallback(() => {
    if (originalOutputs.length === 0) return false;
    
    // Compare array lengths
    if (outputs.length !== originalOutputs.length) return true;
    
    // Deep compare each output
    for (let i = 0; i < outputs.length; i++) {
      const current = outputs[i];
      const original = originalOutputs[i];
      
      // Compare relevant fields that can be edited
      if (
        current.label !== original.label ||
        current.format !== original.format ||
        current.script !== original.script
      ) {
        return true;
      }
    }
    
    return false;
  }, [outputs, originalOutputs]);

  // Check for changes and update unsaved state - with loading guard
  useEffect(() => {
    // Don't detect changes while loading a profile
    if (isLoadingProfile) return;
    
    const hasChanges = outputsChanged();
    if (hasChanges) {
      setHasUnsavedChanges(true, 'profile');
    }
  }, [outputs, outputsChanged, setHasUnsavedChanges, isLoadingProfile]);

  const handleMessageOutput = useCallback((data: any) => {
    // 1) LABEL or TEXT packets: { key, label } or { key, text }
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
          // update existing label
          const copy = [...prev];
          copy[idx].label = name;
          return copy;
        }
        // seed a new row so VALUE will merge in later
        return [...prev, { key, label: name, lastValue: 0, format: "", script: "" }];
      });

      return;
    }

    // 2) VALUE packets: { key, value }
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
          // patch only the lastValue
          const copy = [...prev];
          copy[idx].lastValue = value;
          return copy;
        }
        // first sighting: label defaults to key
        return [...prev, { key, label: key, lastValue: value, format: "", script: "" }];
      });

      return;
    }
  }, []);

  const handleLabelChange = useCallback((key: string, newLabel: string) => {
    setOutputs(prev => 
      prev.map(output => 
        output.key === key ? { ...output, label: newLabel } : output
      )
    );
  }, []);

  const handleFormatChange = useCallback((key: string, newFormat: string) => {
    setOutputs(prev => 
      prev.map(output => 
        output.key === key ? { ...output, format: newFormat } : output
      )
    );
  }, []);

  const handleScriptChange = useCallback((key: string, newScript: string) => {
    setOutputs(prev => 
      prev.map(output => 
        output.key === key ? { ...output, script: newScript } : output
      )
    );
  }, []);

  const clearOutputs = useCallback(() => {
    setOutputs([]);
    setOriginalOutputs([]);
  }, []);

  const setOutputsData = useCallback((newOutputs: MessageProfileOutput[]) => {
    // Ensure all outputs have format and script fields as empty strings if missing
    const normalizedOutputs = newOutputs.map(output => ({
      ...output,
      format: output.format ?? "",
      script: output.script ?? ""
    }));
    
    // Set original outputs first, then current outputs
    const clonedOutputs = normalizedOutputs.map(output => ({ ...output }));
    setOriginalOutputs(clonedOutputs);
    setOutputs(normalizedOutputs);
  }, []);

  return {
    outputs,
    handleMessageOutput,
    handleLabelChange,
    handleFormatChange,
    handleScriptChange,
    clearOutputs,
    setOutputsData
  };
};
