
export const isElectron = () => {
  // Check if window.electron exists (exposed by our preload script)
  return typeof window !== 'undefined' && !!window.electron;
};
