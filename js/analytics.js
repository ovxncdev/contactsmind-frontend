// analytics.js - PostHog Analytics

const Analytics = {
  ready: false,
  
  init() {
    try {
      if (CONFIG.POSTHOG_KEY && 
          CONFIG.POSTHOG_KEY.length > 10 && 
          CONFIG.POSTHOG_KEY.startsWith('phc_')) {
        
        const initPostHog = () => {
          if (typeof posthog !== 'undefined' && posthog.init) {
            posthog.init(CONFIG.POSTHOG_KEY, {
              api_host: CONFIG.POSTHOG_HOST || 'https://us.i.posthog.com',
              loaded: () => {
                this.ready = true;
                console.log('✅ Analytics ready');
              }
            });
          } else {
            setTimeout(initPostHog, 100);
          }
        };
        initPostHog();
      }
    } catch (e) {
      console.log('Analytics disabled:', e);
    }
  },
  
  track(event, properties = {}) {
    try {
      if (this.ready && typeof posthog !== 'undefined') {
        posthog.capture(event, properties);
      }
    } catch (e) {}
  },
  
  identify(user) {
    try {
      if (this.ready && typeof posthog !== 'undefined' && user) {
        posthog.identify(user._id || user.id, {
          email: user.email,
          name: user.name
        });
      }
    } catch (e) {}
  },
  
  reset() {
    try {
      if (this.ready && typeof posthog !== 'undefined') {
        posthog.reset();
      }
    } catch (e) {}
  }
};