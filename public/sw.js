// Discipline service worker: shows push notifications and opens the app when
// one is tapped. It does not cache anything, so the app always loads fresh.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function safePath(url) {
  // Only paths inside the app ("/feed?item=..."), never another site.
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : "/feed";
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Discipline", {
      body: data.body || "",
      tag: data.tag || "discipline",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: { url: safePath(data.url) },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(safePath(event.notification.data && event.notification.data.url), self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin) {
          try {
            await w.navigate(target);
          } catch (e) {
            // Some browsers don't allow navigate(); focusing still helps.
          }
          return w.focus();
        }
      }
      return self.clients.openWindow(target);
    })()
  );
});
