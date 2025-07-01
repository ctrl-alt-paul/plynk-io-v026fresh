
import React, { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Loader } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { isElectron } from "@/utils/isElectron";

interface ProcessInfo {
  name: string;
  pid: number;
  cmd?: string;
}

interface ModuleNameInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  onBlur?: () => void;
}

export function ModuleNameInput({ 
  value, 
  onChange, 
  className, 
  id, 
  placeholder, 
  disabled,
  readOnly,
  onBlur 
}: ModuleNameInputProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch processes when the component mounts or popover opens
  useEffect(() => {
    if (open && isElectron()) {
      fetchProcesses();
    }
  }, [open]);

  // Update internal value when prop changes
  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  const fetchProcesses = async () => {
    if (!window.electron?.getProcesses) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const processList = await window.electron.getProcesses();
      setProcesses(processList || []);
    } catch (error) {
      setError("Failed to load processes");
    } finally {
      setIsLoading(false);
    }
  };

  const formatProcessLabel = (process: ProcessInfo) => {
    const cmd = process.cmd || '';
    const truncatedCmd = cmd.length > 60 ? `...${cmd.slice(-60)}` : cmd;
    return cmd 
      ? `${process.name} (PID ${process.pid}) — ${truncatedCmd}` 
      : `${process.name} (PID ${process.pid})`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
  };

  const handleInputBlur = () => {
    if (onBlur) {
      onBlur();
    }
  };

  const handleSelect = (processName: string) => {
    setInputValue(processName);
    onChange(processName);
    setOpen(false);
  };

  return (
    <div className="flex w-full gap-2">
      <Input
        id={id}
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        className={cn("flex-1", className)}
        placeholder={placeholder || "Enter process name"}
        disabled={disabled}
        readOnly={readOnly}
      />
      {isElectron() && !disabled && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              role="combobox" 
              aria-expanded={open}
              className="px-2 flex-shrink-0"
              type="button"
              disabled={disabled}
            >
              <ChevronsUpDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="end">
            <Command>
              <CommandInput placeholder="Search processes..." />
              <CommandList>
                {isLoading && (
                  <div className="flex items-center justify-center p-4">
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    <span>Loading processes...</span>
                  </div>
                )}
                
                {error && (
                  <div className="text-center p-4 text-red-500">
                    {error}
                  </div>
                )}
                
                <CommandEmpty>No processes found.</CommandEmpty>
                
                <CommandGroup heading="Running Processes">
                  {processes.map((process) => (
                    <CommandItem
                      key={`${process.name}-${process.pid}`}
                      value={process.name}
                      onSelect={() => handleSelect(process.name)}
                      className="flex items-center justify-between"
                    >
                      <div className="truncate">
                        {formatProcessLabel(process)}
                      </div>
                      {process.name === inputValue && (
                        <Check className="h-4 w-4 flex-shrink-0" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
