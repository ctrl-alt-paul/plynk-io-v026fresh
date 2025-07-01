import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageProfileOutput } from "@/types/messageProfiles";
import { FormatStringHelpDialog } from "@/renderer/components/FormatStringHelpDialog";
import { TransformScriptHelpDialog } from "@/renderer/components/TransformScriptHelpDialog";
import { Info } from "lucide-react";

interface MessageOutputsTableProps {
  outputs: MessageProfileOutput[];
  onLabelChange: (key: string, newLabel: string) => void;
  onFormatChange: (key: string, newFormat: string) => void;
  onScriptChange: (key: string, newScript: string) => void;
}

// Helper function that matches the backend evaluateFormat logic
function evaluateFormat(format: string, value: any): string {
  // Handle null/undefined values before formatting
  if (value === null || value === undefined) {
    value = 0;
  }
  
  if (!format || format === '') return value.toString();
  
  try {
    // Check for decimal formatting patterns first (e.g., "0", "0.00", "0.0000")
    const decimalPattern = /^0(\.0+)?$/;
    if (decimalPattern.test(format.trim())) {
      const numericValue = Number(value);
      if (!isNaN(numericValue)) {
        // Count decimal places in the format string
        const decimalMatch = format.match(/\.0+/);
        if (decimalMatch) {
          const decimalPlaces = decimalMatch[0].length - 1; // Subtract 1 for the dot
          return numericValue.toFixed(decimalPlaces);
        } else {
          // Format is just "0", so return whole number
          return Math.round(numericValue).toString();
        }
      }
      return value.toString();
    }
    
    // Simple string replacement for {value}
    if (format.includes('{value}')) {
      const result = format.replace('{value}', value.toString());
      return result;
    }
    
    // More complex expression evaluation
    if (format.includes('{') && format.includes('}')) {
      const expressionMatch = format.match(/{([^}]+)}/);
      if (expressionMatch && expressionMatch[1]) {
        const expression = expressionMatch[1].trim();
        const evalFn = new Function('value', `return ${expression}`);
        const result = evalFn(value);
        
        const finalResult = format.replace(/{([^}]+)}/, result);
        return finalResult;
      }
    }
    
    return format;
  } catch (err) {
    return value.toString();
  }
}

const MessageOutputsTable: React.FC<MessageOutputsTableProps> = ({
  outputs,
  onLabelChange,
  onFormatChange,
  onScriptChange
}) => {
  // Calculate final value after applying script and format
  const calculateFinalValue = (output: MessageProfileOutput): string => {
    let value = output.lastValue;
    
    // Apply script transformation first
    if (output.script && value !== undefined && value !== null) {
      try {
        const numericValue = Number(value);
        if (!isNaN(numericValue)) {
          const scriptFn = new Function('value', `return ${output.script}`);
          value = scriptFn(numericValue);
        }
      } catch (error) {
        // Keep original value if script fails
      }
    }
    
    // Apply format string second using the same logic as backend
    if (output.format && value !== undefined && value !== null) {
      try {
        return evaluateFormat(output.format, value);
      } catch (error) {
        // Keep value as-is if format fails
      }
    }
    
    return String(value ?? 'N/A');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Captured Outputs ({outputs.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {outputs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No message outputs captured yet. Start listening to see outputs from your emulator.
          </div>
        ) : (
          <div className="relative w-full overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="h-6">
                  <TableHead className="py-1 text-xs font-medium w-20">Key</TableHead>
                  <TableHead className="py-1 text-xs font-medium w-32">Label</TableHead>
                  <TableHead className="py-1 text-xs font-medium w-24">Last RAW Value</TableHead>
                  <TableHead className="py-1 text-xs font-medium w-32">
                    <div className="flex items-center gap-1">
                      Format String
                      <FormatStringHelpDialog 
                        trigger={
                          <Button variant="ghost" size="sm" className="h-4 w-4 p-0">
                            <Info className="h-3 w-3" />
                          </Button>
                        } 
                      />
                    </div>
                  </TableHead>
                  <TableHead className="py-1 text-xs font-medium w-32">
                    <div className="flex items-center gap-1">
                      Transform Script
                      <TransformScriptHelpDialog 
                        trigger={
                          <Button variant="ghost" size="sm" className="h-4 w-4 p-0">
                            <Info className="h-3 w-3" />
                          </Button>
                        } 
                      />
                    </div>
                  </TableHead>
                  <TableHead className="py-1 text-xs font-medium w-24">Final Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outputs.map((output) => (
                  <TableRow key={output.key} className="h-6">
                    <TableCell className="font-mono text-xs py-0.5">{output.key}</TableCell>
                    <TableCell className="py-0.5">
                      <Input
                        value={output.label}
                        onChange={(e) => onLabelChange(output.key, e.target.value)}
                        placeholder="Enter label..."
                        className="h-5 text-xs px-1"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs py-0.5">{output.lastValue}</TableCell>
                    <TableCell className="py-0.5">
                      <Input
                        value={output.format || ''}
                        onChange={(e) => onFormatChange(output.key, e.target.value)}
                        placeholder="{value}"
                        className="h-5 text-xs px-1"
                      />
                    </TableCell>
                    <TableCell className="py-0.5">
                      <Input
                        value={output.script || ''}
                        onChange={(e) => onScriptChange(output.key, e.target.value)}
                        placeholder="value * 100"
                        className="h-5 text-xs px-1"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs py-0.5">{calculateFinalValue(output)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MessageOutputsTable;
