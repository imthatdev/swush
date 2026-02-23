/*
 *   Copyright (c) 2026 Laith Alkhaddam aka Iconical.
 *   All rights reserved.

 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at

 *   http://www.apache.org/licenses/LICENSE-2.0

 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

const VERSION = "swush-sw-v1";
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const PRECACHE_URLS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/images/icons/icon-192.png",
  "/images/icons/icon-512.png",
  "/images/icons/maskable-192.png",
  "/images/icons/maskable-512.png",
  "/images/logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE_URLS);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isMediaOrHlsRequest(url) {
  return (
    url.pathname.startsWith("/hls/") ||
    url.pathname.startsWith("/v/") ||
    url.pathname.startsWith("/x/") ||
    url.pathname.startsWith("/n/") ||
    url.pathname.startsWith("/b/") ||
    url.pathname.startsWith("/s/") ||
    url.pathname.startsWith("/c/") ||
    url.pathname.startsWith("/r/") ||
    url.pathname.startsWith("/l/") ||
    url.pathname.startsWith("/g/") ||
    url.pathname.startsWith("/f/") ||
    url.pathname.startsWith("/meet/") ||
    /\.(m3u8|ts|m4s|mp4|webm|mov|aac|mp3|ogg|wav)$/i.test(url.pathname)
  );
}

function isCacheableRequest(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (isMediaOrHlsRequest(url)) return false;
  return url.origin === self.location.origin;
}

function isCacheableResponse(request, response) {
  if (!response || !response.ok) return false;
  if (response.status === 206) return false;
  if (request.headers.get("range")) return false;
  return true;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!isCacheableRequest(request)) return;

  const url = new URL(request.url);

  const isNextStatic = url.pathname.startsWith("/_next/static/");
  const isImage =
    url.pathname.startsWith("/images/") ||
    /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(url.pathname);

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          if (isCacheableResponse(request, fresh)) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, fresh.clone());
          }
          return fresh;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match("/offline.html");
        }
      })(),
    );
    return;
  }

  if (isNextStatic || isImage) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        if (isCacheableResponse(request, res)) {
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, res.clone());
        }
        return res;
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const res = await fetch(request);
        const url = new URL(request.url);
        if (!isMediaOrHlsRequest(url) && isCacheableResponse(request, res)) {
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, res.clone());
        }
        return res;
      } catch {
        return caches.match(request);
      }
    })(),
  );
});

self.addEventListener("push", (event) => {
  const payload = (() => {
    try {
      return event.data ? event.data.json() : null;
    } catch {
      return null;
    }
  })();

  const title = payload?.title || "Swush";
  const sound =
    typeof payload?.sound === "string"
      ? payload.sound
      : typeof payload?.data?.sound === "string"
        ? payload.data.sound
        : null;
  const options = {
    body: payload?.body || "You have a new notification.",
    icon: "/images/icons/icon-192.png",
    badge: "/images/icons/icon-192.png",
    data: payload?.data || {},
  };
  if (sound) options.sound = sound;

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/vault";

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of windowClients) {
        if ("focus" in client) {
          await client.focus();
          client.navigate(targetUrl);
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
