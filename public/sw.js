self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text() || "Tienes un recordatorio pendiente." };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Contavid", {
      body: data.body || "Tienes un pago próximo.",
      icon: "/contavid-icon.png",
      badge: "/apple-touch-icon.png",
      tag: data.tag || "contavid-reminder",
      data: { url: data.url || "/?view=Pagos" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/?view=Pagos", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow(target);
    }),
  );
});
