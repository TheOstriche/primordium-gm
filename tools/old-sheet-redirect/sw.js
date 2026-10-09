// Replaces the old app's offline worker: it removes itself so phones stop opening the cached old copy.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.registration.unregister().then(() => self.clients.matchAll())
  .then(cs => cs.forEach(c => c.navigate('/primordium-tools/sheet/')))));
