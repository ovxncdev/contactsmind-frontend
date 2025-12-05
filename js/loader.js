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

  let loadedCount = 0;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        loadedCount++;
        console.log(`✅ Loaded (${loadedCount}/${scripts.length}): ${src}`);
        resolve();
      };
      script.onerror = (e) => {
        console.error(`❌ Failed to load: ${src}`, e);
        reject(e);
      };
      document.head.appendChild(script);
    });
  }

  async function loadAll() {
    console.log('🚀 Starting to load scripts...');
    for (const src of scripts) {
      try {
        await loadScript(src);
      } catch (e) {
        console.error('Stopped loading due to error');
        return;
      }
    }
    console.log('✅ All scripts loaded!');
  }

  loadAll();
})();