
/**
 * A utility hook to help with DOM manipulation for legacy code
 * that relies on direct DOM access to trigger actions
 */
export const useDomHandler = () => {
  // Track recently clicked elements to prevent duplicate clicks
  const recentlyClicked = new Map<string, number>();
  
  /**
   * Clicks a DOM element by ID
   * @param elementId The ID of the element to click
   * @param delayOverride Optional delay override in ms (default: no delay)
   * @returns boolean indicating if the element was found and clicked
   */
  const clickElementById = (elementId: string, delayOverride?: number): boolean => {
    const element = document.getElementById(elementId);
    if (element) {
      // Check if we've recently clicked this element to avoid duplicates
      const now = Date.now();
      const lastClickTime = recentlyClicked.get(elementId);
      
      if (lastClickTime && now - lastClickTime < 1000) {
        return false;
      }
      
      // Record this click to prevent duplicates
      recentlyClicked.set(elementId, now);
      
      // Clean up old entries from the map
      setTimeout(() => {
        recentlyClicked.delete(elementId);
      }, 1000);
      
      // Create and dispatch a custom event before clicking to help avoid infinite loops
      const customEvent = new CustomEvent('pre-click', { detail: { id: elementId } });
      document.dispatchEvent(customEvent);
      
      // If delay is specified, apply it before clicking
      if (delayOverride !== undefined && delayOverride > 0) {
        setTimeout(() => {
          element.click();
        }, delayOverride);
        return true;
      }
      
      // Perform the click immediately if no delay
      element.click();
      return true;
    }
    return false;
  };

  return {
    clickElementById
  };
};
