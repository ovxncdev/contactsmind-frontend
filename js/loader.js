// loader.js - Load all app scripts in order

(function() {
  const scripts = [
    'config.js',
    'js/utils.js',
    'js/analytics.js',
    'js/offline.js',
    'js/network.js',
    'js/contacts.js',
    'js/parser.js',
    'js/chat.js',
    'js/notes.js',
    'js/reminders.js',
    'js/ui.js',
    'js/modals.js',
    'js/swipe.js',
    'js/app.js'
  ];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function loadAll() {
    for (const src of scripts) {
      await loadScript(src);
    }
  }

  loadAll().catch(err => console.error('Failed to load scripts:', err));
})();