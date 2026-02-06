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

import { useEffect, useMemo, useState } from "react";
import { apiV1 } from "@/lib/api-path";
import { DEFAULT_AVATAR_PATH } from "@/lib/avatar";

type Props = {
  src?: string | null;
  userId?: string | null;
  alt?: string;
  className?: string;
  fallbackMode?: "default" | "none";
  cacheKey?: string | number | null;
  onError?: React.ReactEventHandler<HTMLImageElement>;
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
  loading?: "lazy" | "eager";
  decoding?: "async" | "auto" | "sync";
};

function appendCacheKey(url: string, cacheKey?: string | number | null) {
  if (!cacheKey) return url;
  if (url.startsWith("blob:")) return url;
  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}v=${encodeURIComponent(String(cacheKey))}`;
}

export default function UserAvatar({
  src,
  userId,
  alt = "",
  className,
  fallbackMode = "default",
  cacheKey,
  onError,
  onLoad,
  loading = "lazy",
  decoding = "async",
}: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setFailed(false);
    }, 0);
    return () => clearTimeout(id);
  }, [src, userId, cacheKey]);

  const baseSrc = useMemo(() => {
    if (src && src.trim()) return src;
    if (userId) return apiV1(`/avatar/${encodeURIComponent(userId)}`);
    return DEFAULT_AVATAR_PATH;
  }, [src, userId]);

  const resolved = appendCacheKey(
    failed && fallbackMode === "default" ? DEFAULT_AVATAR_PATH : baseSrc,
    cacheKey,
  );

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt}
      className={className}
      loading={loading}
      decoding={decoding}
      onLoad={onLoad}
      onError={(e) => {
        if (fallbackMode === "default") setFailed(true);
        onError?.(e);
      }}
    />
  );
}
