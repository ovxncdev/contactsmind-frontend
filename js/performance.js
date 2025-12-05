// performance.js - Performance Optimizations

const Performance = {
  init() {
    this.lazyLoadImages();
    this.prefetchLinks();
    this.measureMetrics();
  },
  
  // Lazy load images
  lazyLoadImages() {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
            }
            observer.unobserve(img);
          }
        });
      }, {
        rootMargin: '50px 0px'
      });
      
      document.querySelectorAll('img[data-src]').forEach((img) => {
        imageObserver.observe(img);
      });
    } else {
      // Fallback for older browsers
      document.querySelectorAll('img[data-src]').forEach((img) => {
        img.src = img.dataset.src;
      });
    }
  },
  
  // Prefetch important links
  prefetchLinks() {
    const links = ['/app.html', '/auth.html'];
    
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        links.forEach((href) => {
          const link = document.createElement('link');
          link.rel = 'prefetch';
          link.href = href;
          document.head.appendChild(link);
        });
      });
    }
  },
  
  // Measure and report performance metrics
  measureMetrics() {
    if ('performance' in window && 'PerformanceObserver' in window) {
      // First Contentful Paint
      try {
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              Analytics.track('performance_fcp', { value: Math.round(entry.startTime) });
            }
          }
        });
        paintObserver.observe({ entryTypes: ['paint'] });
      } catch (e) {}
      
      // Largest Contentful Paint
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          Analytics.track('performance_lcp', { value: Math.round(lastEntry.startTime) });
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {}
      
      // Time to Interactive (approximate)
      window.addEventListener('load', () => {
        setTimeout(() => {
          const timing = performance.timing;
          const tti = timing.domInteractive - timing.navigationStart;
          Analytics.track('performance_tti', { value: tti });
        }, 0);
      });
    }
  },
  
  // Debounce function for scroll/resize handlers
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
  
  // Throttle function for frequent events
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
};