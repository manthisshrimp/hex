import { useEffect, useRef, useCallback } from 'react';

export function useInfiniteScroll(callback, options = {}) {
  const observerTarget = useRef(null);
  
  useEffect(() => {
    if (!callback || typeof callback !== 'function') {
      return;
    }
    
    const target = observerTarget.current;
    if (!target) return;
    
    const observerOptions = {
      root: options.root || null,
      rootMargin: options.rootMargin || '0px',
      threshold: options.threshold || 0.1,
    };
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          callback();
        }
      });
    }, observerOptions);
    
    observer.observe(target, observerOptions);
    
    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [callback, options]);
  
  return useCallback(node => {
    observerTarget.current = node;
  }, []);
}

// Re-export as useScroll for convenience
export { useInfiniteScroll as useScroll };
