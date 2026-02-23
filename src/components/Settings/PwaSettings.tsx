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

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAppConfig } from "@/components/Providers/AppConfigProvider";
import { apiV1 } from "@/lib/api-path";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function getDisplayMode() {
  if (typeof window === "undefined") return "browser";
  if (window.matchMedia?.("(display-mode: standalone)").matches)
    return "standalone";
  if ((window.navigator as unknown as { standalone?: boolean }).standalone)
    return "standalone";
  return "browser";
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
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState("");
  const [pushSound, setPushSound] = useState("");
  const [swStatus, setSwStatus] = useState<
    "unsupported" | "ready" | "registering" | "error"
  >("registering");
  const [swError, setSwError] = useState<string | null>(null);
  const { vapidPublicKey } = useAppConfig();
  const hasPublicKey = Boolean(vapidPublicKey);

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
    ensureServiceWorkerReady()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setPushSubscription(sub ?? null))
      .catch(() => {});
  }, []);

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
      toast.message("Install prompt not available yet");
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
      toast.success("Push notifications disabled");
    } catch (e) {
      toast.error("Failed to disable push", {
        description: (e as Error).message,
      });
    } finally {
      setPushBusy(false);
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
    <section>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Badge variant="secondary">Mode: {displayMode}</Badge>
        <Badge variant="secondary">
          Notifications:{" "}
          {permission === "unsupported" ? "unsupported" : permission}
        </Badge>
        <Badge variant="secondary">
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
      </div>
      {swStatus === "error" && swError && (
        <p className="text-xs text-destructive mb-2">
          Service worker error: {swError}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          size="sm"
          onClick={install}
          disabled={installed || !deferredPrompt}
        >
          {installed ? "Installed" : "Install app"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={requestNotifications}
          disabled={permission === "unsupported" || permission === "granted"}
        >
          Enable notifications
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={testNotification}
          disabled={permission !== "granted"}
        >
          Send test notification
        </Button>
      </div>

      {pushSupported && (
        <div className="mt-4 space-y-2">
          {pushSubscription ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={unsubscribeFromPush}
                disabled={pushBusy}
              >
                Disable push
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
              <Button size="sm" onClick={sendPushTest} disabled={pushBusy}>
                Send push test
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={subscribeToPush} disabled={pushBusy}>
              Enable push notifications
            </Button>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-3">
        Install prompt only appears on supported browsers after visiting the
        site a bit (and only on HTTPS or localhost).
      </p>
    </section>
  );
}
