
import React from "react";
import { useUnsavedChanges } from "./UnsavedChangesProvider";

export const UnsavedChangesWarning: React.FC = () => {
  const { hasUnsavedChanges } = useUnsavedChanges();

  if (!hasUnsavedChanges) return null;

  return (
    <div className="bg-amber-50 border-l-4 border-amber-400 px-4 py-1.5 text-sm text-amber-800 mb-2">
      <p className="font-medium">
        You have unsaved changes. Click 'Update Profile' or 'Save Settings' to save your changes.
      </p>
    </div>
  );
};
