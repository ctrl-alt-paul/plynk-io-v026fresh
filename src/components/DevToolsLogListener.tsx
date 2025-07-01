
import { useEffect } from "react";

/**
 * Component that previously listened for devtools logs from the Electron main process
 * Now disabled as part of logging cleanup
 */
export const DevToolsLogListener = () => {
  useEffect(() => {
    // DevTools logging has been disabled
    return undefined;
  }, []);
  
  // This component doesn't render anything
  return null;
};

export default DevToolsLogListener;
