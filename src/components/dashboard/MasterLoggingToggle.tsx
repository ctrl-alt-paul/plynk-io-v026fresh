
import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useLogContext } from '@/contexts/LogContext';

export const MasterLoggingToggle: React.FC = () => {
  const { isLoggingEnabled, setLoggingEnabled } = useLogContext();

  const handleToggle = (checked: boolean) => {
    setLoggingEnabled(checked);
  };

  return (
    <div className="flex items-center space-x-2">
      <Switch
        id="master-logging-standalone"
        checked={isLoggingEnabled}
        onCheckedChange={handleToggle}
      />
      <Label htmlFor="master-logging-standalone" className="text-sm font-medium">
        System Logging
      </Label>
    </div>
  );
};
