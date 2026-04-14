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

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAppConfig } from "@/components/Providers/AppConfigProvider";
import { apiV1 } from "@/lib/api-path";
import { IconBrandChrome, IconBrandFirefox } from "@tabler/icons-react";
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
  CardHeader,
} from "../ui/card";
import Link from "next/link";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PushSubscriptionRecord = {
  id: string;
  endpoint: string;
  endpointHost: string;
  createdAt: string;
  updatedAt: string;
};

const STALE_PUSH_DAYS = 30;
const STALE_PUSH_MS = STALE_PUSH_DAYS * 24 * 60 * 60 * 1000;
const FIREFOX_EXTENSION_URL =
  "https://addons.mozilla.org/en-US/firefox/addon/swush-companion/";
const CHROME_EXTENSION_URL =
  "https://chromewebstore.google.com/detail/swush-companion/jgipkeccibhgdfhoknfggljdmdodkjop";

function formatRelativeTime(iso: string) {
  const value = new Date(iso).getTime();
  if (!Number.isFinite(value)) return "unknown";

  const diffMs = Date.now() - value;
  if (diffMs <= 0) return "just now";

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;

  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears}y ago`;
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "unknown";
  return date.toLocaleString();
}

function getDisplayMode() {
  if (typeof window === "undefined") return "browser";
  if (window.matchMedia?.("(display-mode: standalone)").matches)
    return "standalone";
  if ((window.navigator as unknown as { standalone?: boolean }).standalone)
    return "standalone";
  return "browser";
}

function isIosSafariBrowser() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const platform = window.navigator.platform || "";
  const maxTouchPoints = window.navigator.maxTouchPoints || 0;
  const isIpadOsDesktop = platform === "MacIntel" && maxTouchPoints > 1;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || isIpadOsDesktop;
  const isWebKit = /WebKit/.test(ua);
  const hasOtherBrowserToken = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIOS && isWebKit && !hasOtherBrowserToken;
}

function isMacSafariBrowser() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const platform = window.navigator.platform || "";
  const maxTouchPoints = window.navigator.maxTouchPoints || 0;
  const isMacDesktop = /Mac/.test(platform) && maxTouchPoints <= 1;
  const isSafari = /Safari/.test(ua);
  const hasOtherBrowserToken =
    /Chrome|Chromium|CriOS|FxiOS|EdgiOS|OPiOS|OPR|Opera/.test(ua);
  return isMacDesktop && isSafari && !hasOtherBrowserToken;
}

export default function PwaSettings() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscription, setPushSubscription] =
    useState<PushSubscription | null>(null);
  const [pushDevices, setPushDevices] = useState<PushSubscriptionRecord[]>([]);
  const [pushDevicesLoading, setPushDevicesLoading] = useState(false);
  const [removeDeviceId, setRemoveDeviceId] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState("");
  const [pushSound, setPushSound] = useState("");
  const [swStatus, setSwStatus] = useState<
    "unsupported" | "ready" | "registering" | "error"
  >("registering");
  const [swError, setSwError] = useState<string | null>(null);
  const { vapidPublicKey } = useAppConfig();
  const hasPublicKey = Boolean(vapidPublicKey);
  const isIosSafari = useMemo(() => isIosSafariBrowser(), []);
  const isMacSafari = useMemo(() => isMacSafariBrowser(), []);

  const loadPushDevices = useCallback(async () => {
    setPushDevicesLoading(true);
    try {
      const res = await fetch(apiV1("/profile/push"), { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as {
        subscriptions?: PushSubscriptionRecord[];
      };
      if (!res.ok) {
        throw new Error("Failed to load push devices");
      }
      setPushDevices(
        Array.isArray(body.subscriptions) ? body.subscriptions : [],
      );
    } catch (e) {
      toast.error("Failed to load push devices", {
        description: (e as Error).message,
      });
    } finally {
      setPushDevicesLoading(false);
    }
  }, []);

  const displayMode = useMemo(() => getDisplayMode(), []);

  useEffect(() => {
    setInstalled(displayMode === "standalone");
  }, [displayMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setInstalled(true);
      toast.success("Swush installed");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  const ensureServiceWorkerReady = async () => {
    if (!("serviceWorker" in navigator)) {
      setSwStatus("unsupported");
      return null;
    }
    setSwStatus("registering");
    setSwError(null);
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
      } catch (err) {
        setSwStatus("error");
        setSwError((err as Error).message);
        return null;
      }
    }
    try {
      const ready = await navigator.serviceWorker.ready;
      setSwStatus("ready");
      return ready;
    } catch (err) {
      setSwStatus("error");
      setSwError((err as Error).message);
      return null;
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canPush =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      window.isSecureContext;
    if (!canPush) {
      setPushSupported(false);
      setSwStatus("unsupported");
      return;
    }
    setPushSupported(true);
    void ensureServiceWorkerReady()
      .then(async (reg) => {
        const sub = await reg?.pushManager.getSubscription();
        setPushSubscription(sub ?? null);
        await loadPushDevices();
      })
      .catch(() => {});
  }, [loadPushDevices]);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i += 1) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const install = async () => {
    if (!deferredPrompt) {
      if (isIosSafari) {
        toast.message("Use Safari install menu", {
          description: "Tap Share, then Add to Home Screen.",
        });
        return;
      }
      if (isMacSafari) {
        toast.message("Use Safari install menu", {
          description: "From Safari menu bar, choose File, then Add to Dock.",
        });
        return;
      }
      toast.message("Install prompt not available yet", {
        description:
          "Use your browser menu to install, or keep browsing until the prompt becomes available.",
      });
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        toast.success("Install started");
      } else {
        toast.message("Install dismissed");
      }
    } catch (e) {
      toast.error("Install failed", { description: (e as Error).message });
    } finally {
      setDeferredPrompt(null);
    }
  };

  const requestNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Notifications not supported in this browser");
      return;
    }
    if (!window.isSecureContext) {
      toast.error("Notifications require HTTPS or localhost");
      return;
    }

    try {
      const p = await Notification.requestPermission();
      setPermission(p);
      if (p === "granted") toast.success("Notifications enabled");
      else toast.message(`Notifications: ${p}`);
    } catch (e) {
      toast.error("Could not enable notifications", {
        description: (e as Error).message,
      });
    }
  };

  const testNotification = async () => {
    if (permission !== "granted") {
      toast.message("Enable notifications first");
      return;
    }
    if (!("serviceWorker" in navigator)) {
      toast.error("Service worker not available");
      return;
    }

    try {
      const reg = await ensureServiceWorkerReady();
      if (reg) {
        const options: NotificationOptions & { sound?: string } = {
          body: "Notifications are working.",
          icon: "/images/icons/icon-192.png",
          badge: "/images/icons/icon-192.png",
          data: { url: "/vault" },
        };
        if (pushSound) options.sound = pushSound;
        await reg.showNotification("Swush", options);
      } else if ("Notification" in window) {
        const options: NotificationOptions & { sound?: string } = {
          body: "Notifications are working.",
          icon: "/images/icons/icon-192.png",
        };
        if (pushSound) options.sound = pushSound;
        new Notification("Swush", options);
      } else {
        toast.error("Service worker not ready");
        return;
      }
      toast.success("Test notification sent");
    } catch (e) {
      toast.error("Failed to send notification", {
        description: (e as Error).message,
      });
    }
  };

  const subscribeToPush = async () => {
    if (!pushSupported) return;
    if (permission !== "granted") {
      const p = await Notification.requestPermission();
      setPermission(p);
      if (p !== "granted") {
        toast.message("Enable notifications first");
        return;
      }
    }
    if (!hasPublicKey) {
      toast.error("Missing VAPID public key");
      return;
    }
    setPushBusy(true);
    try {
      const reg = await ensureServiceWorkerReady();
      if (!reg) {
        throw new Error("Service worker not ready");
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      setPushSubscription(sub);
      const res = await fetch(apiV1("/profile/push"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to save subscription");
      }
      await loadPushDevices();
      toast.success("Push notifications enabled");
    } catch (e) {
      toast.error("Failed to enable push", {
        description: (e as Error).message,
      });
    } finally {
      setPushBusy(false);
    }
  };

  const unsubscribeFromPush = async () => {
    if (!pushSubscription) return;
    setPushBusy(true);
    try {
      const endpoint = pushSubscription.endpoint;
      await pushSubscription.unsubscribe();
      setPushSubscription(null);
      await fetch(apiV1("/profile/push"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      await loadPushDevices();
      toast.success("Push notifications disabled");
    } catch (e) {
      toast.error("Failed to disable push", {
        description: (e as Error).message,
      });
    } finally {
      setPushBusy(false);
    }
  };

  const removePushDevice = async (device: PushSubscriptionRecord) => {
    setRemoveDeviceId(device.id);
    const isCurrent = pushSubscription?.endpoint === device.endpoint;

    try {
      if (isCurrent && pushSubscription) {
        await pushSubscription.unsubscribe().catch(() => {});
        setPushSubscription(null);
      }

      const res = await fetch(apiV1("/profile/push"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: device.id,
          endpoint: device.endpoint,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to remove device");
      }

      setPushDevices((prev) => prev.filter((item) => item.id !== device.id));
      toast.success("Push device removed");
    } catch (e) {
      toast.error("Failed to remove push device", {
        description: (e as Error).message,
      });
    } finally {
      setRemoveDeviceId(null);
    }
  };

  const sendPushTest = async () => {
    if (!pushSubscription) {
      toast.message("Subscribe to push first");
      return;
    }
    setPushBusy(true);
    try {
      const res = await fetch(apiV1("/profile/push"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: pushMessage || "Test notification",
          sound: pushSound || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to send push");
      }
      setPushMessage("");
      await loadPushDevices();
      toast.success("Push notification sent");
    } catch (e) {
      toast.error("Failed to send push", {
        description: (e as Error).message,
      });
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Badge variant="secondary">Mode: {displayMode}</Badge>
        <Badge variant={permission === "unsupported" ? "secondary" : "default"}>
          Notifications:{" "}
          {permission === "unsupported" ? "unsupported" : permission}
        </Badge>
        <Badge
          variant={
            pushSupported
              ? "secondary"
              : pushSubscription
                ? "default"
                : "destructive"
          }
        >
          Push:{" "}
          {pushSupported
            ? pushSubscription
              ? "enabled"
              : "off"
            : "unsupported"}
        </Badge>
        <Badge variant="secondary">Service worker: {swStatus}</Badge>
        {!hasPublicKey && (
          <Badge variant="destructive">Missing VAPID public key</Badge>
        )}
        {swStatus === "error" && swError && (
          <Badge variant="destructive">Service worker error: {swError}</Badge>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle>Progressive Web App</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Install Swush as an app and enable notifications for quicker
              access.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button size="sm" onClick={install} disabled={installed}>
                {installed
                  ? "Installed"
                  : isIosSafari || isMacSafari
                    ? "How to install"
                    : "Install app"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={requestNotifications}
                disabled={
                  permission === "unsupported" || permission === "granted"
                }
              >
                Allow notifications
              </Button>
              {permission === "unsupported" ||
                (permission === "granted" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={testNotification}
                    disabled={permission !== "granted"}
                  >
                    Send test notification
                  </Button>
                ))}
            </div>

            {(isIosSafari || isMacSafari) && !installed && !deferredPrompt && (
              <p className="text-xs text-muted-foreground">
                {isIosSafari
                  ? "iPhone/iPad Safari does not expose an in-app install prompt. Tap Share, then Add to Home Screen."
                  : "Safari on macOS installs this app through the menu bar. Choose File, then Add to Dock."}
              </p>
            )}

            {pushSupported && (
              <div>
                {pushSubscription ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={unsubscribeFromPush}
                      disabled={pushBusy}
                    >
                      Disable push notifications
                    </Button>
                    <Button
                      size="sm"
                      onClick={sendPushTest}
                      disabled={pushBusy}
                    >
                      Send push test
                    </Button>
                    <Input
                      placeholder="Test message"
                      value={pushMessage}
                      onChange={(e) => setPushMessage(e.target.value)}
                    />
                    <Input
                      placeholder="Sound URL (optional)"
                      value={pushSound}
                      onChange={(e) => setPushSound(e.target.value)}
                    />
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={subscribeToPush}
                    disabled={pushBusy}
                  >
                    Enable push notifications
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle>Browser Extensions</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Install Swush Companion for quick uploads and browser integration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link
                  href={CHROME_EXTENSION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IconBrandChrome size={16} />
                  Chrome Extension
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link
                  href={FIREFOX_EXTENSION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IconBrandFirefox size={16} />
                  Firefox Add-on
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {pushSupported && (
        <Card>
          <CardHeader>
            <CardTitle>Registered devices</CardTitle>
            <CardDescription>
              Devices that are registered to receive push notifications.
            </CardDescription>
            <Button
              variant="outline"
              onClick={() => void loadPushDevices()}
              disabled={pushDevicesLoading}
            >
              {pushDevicesLoading ? "Refreshing..." : "Refresh devices"}
            </Button>
          </CardHeader>

          <CardContent>
            {pushDevicesLoading ? (
              <p className="text-xs text-muted-foreground">
                Loading devices...
              </p>
            ) : pushDevices.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No push devices registered yet.
              </p>
            ) : (
              <div className="space-y-3">
                {pushDevices.map((device) => {
                  const lastSeenMs = new Date(device.updatedAt).getTime();
                  const stale =
                    Number.isFinite(lastSeenMs) &&
                    Date.now() - lastSeenMs >= STALE_PUSH_MS;
                  const isCurrent =
                    pushSubscription?.endpoint === device.endpoint;

                  return (
                    <div
                      key={device.id}
                      className="rounded-md border bg-card/50 p-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 min-w-0">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="block max-w-full text-sm font-medium break-all">
                              {device.endpointHost || "Push endpoint"}
                            </span>
                            {isCurrent ? (
                              <Badge variant="default">This device</Badge>
                            ) : null}
                            {stale ? (
                              <Badge variant="outline">
                                Stale ({STALE_PUSH_DAYS}+ days)
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground break-all line-clamp-1">
                            {device.endpoint}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Last active {formatRelativeTime(device.updatedAt)} ·
                            Added {formatDateTime(device.createdAt)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => void removePushDevice(device)}
                          disabled={removeDeviceId === device.id}
                        >
                          {removeDeviceId === device.id
                            ? "Removing..."
                            : "Remove"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
