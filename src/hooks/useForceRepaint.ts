
import React, { useEffect } from 'react';
import { isElectron } from '@/utils/isElectron';

export const useForceRepaint = () => {
  useEffect(() => {
    if (!isElectron()) return;

    const forcePaint = () => {
      const body = document.body;
      body.style.display = 'none';
      // Force reflow
      void body.offsetHeight;
      body.style.display = '';
    };

    // Run on mount
    forcePaint();

    // Also run whenever window regains focus (in case of nav)
    window.addEventListener('focus', forcePaint);

    return () => {
      window.removeEventListener('focus', forcePaint);
    };
  }, []);
};
