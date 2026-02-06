/*
 *   Copyright (c) 2026 Laith Alkhaddam aka Iconical.
 *   All rights reserved.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "auto" | "light" | "dark";
          size?: "normal" | "compact";
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_ID = "turnstile-script";

export default function TurnstileWidget({
  siteKey,
  onVerify,
  onExpire,
  onError,
  className,
  theme = "auto",
  size = "normal",
}: {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  className?: string;
  theme?: "auto" | "light" | "dark";
  size?: "normal" | "compact";
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onVerifyRef.current = onVerify;
  }, [onVerify]);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!siteKey) return;
    let active = true;

    const ensureScript = () =>
      new Promise<void>((resolve, reject) => {
        const existing = document.getElementById(
          SCRIPT_ID,
        ) as HTMLScriptElement | null;

        const waitForTurnstile = () => {
          if (window.turnstile) {
            resolve();
            return;
          }
          const check = () => {
            if (window.turnstile) {
              resolve();
              return;
            }
            if (!active) return;
            requestAnimationFrame(check);
          };
          requestAnimationFrame(check);
        };

        if (existing) {
          if (window.turnstile) {
            resolve();
            return;
          }
          const onLoad = () => {
            existing.removeEventListener("load", onLoad);
            existing.removeEventListener("error", onError);
            waitForTurnstile();
          };
          const onError = () => {
            existing.removeEventListener("load", onLoad);
            existing.removeEventListener("error", onError);
            reject(new Error("Failed to load Turnstile"));
          };
          existing.addEventListener("load", onLoad);
          existing.addEventListener("error", onError);
          waitForTurnstile();
          return;
        }

        const script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Turnstile"));
        document.head.appendChild(script);
      });

    ensureScript()
      .then(() => {
        if (!active || !containerRef.current || !window.turnstile) return;
        if (widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current);
        }
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => onVerifyRef.current?.(token),
          "expired-callback": () => onExpireRef.current?.(),
          "error-callback": () => onErrorRef.current?.(),
          theme,
          size,
        });
      })
      .catch(() => {
        onErrorRef.current?.();
      });

    return () => {
      active = false;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [siteKey, size, theme]);

  if (!siteKey) return null;

  return <div ref={containerRef} className={className} />;
}
