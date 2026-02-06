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

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  IconBrandGithub,
  IconBrandInstagram,
  IconBrandX,
  IconRosetteDiscountCheck,
  IconLink,
  IconWorld,
} from "@tabler/icons-react";
import UserAvatar from "@/components/Common/UserAvatar";
import { cn } from "@/lib/utils";
import { apiV1 } from "@/lib/api-path";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SocialLinks = {
  instagram?: string | null;
  x?: string | null;
  github?: string | null;
  website?: string | null;
  other?: string | null;
};

type Props = {
  name?: string | null;
  username?: string | null;
  image?: string | null;
  bio?: string | null;
  userId?: string | null;
  verified?: boolean | null;
  anonymous?: boolean;
  anonymousWarning?: string;
  label?: string;
  className?: string;
  avatarClassName?: string;
  placement?: "start" | "center" | "end";
};

export default function PublicOwnerHeader({
  name,
  username,
  image,
  bio,
  userId,
  verified,
  anonymous,
  anonymousWarning,
  label,
  className,
  avatarClassName,
  placement = "center",
}: Props) {
  const isAnonymous = Boolean(anonymous);
  const displayName = isAnonymous ? "Anonymous" : name?.trim() || null;
  const handle = isAnonymous ? null : username?.trim() || null;
  const primaryLabel = displayName ? displayName : handle ? `@${handle}` : null;
  const hasAnyContent = isAnonymous
    ? true
    : Boolean(primaryLabel || bio || image || userId);

  const showHandle = Boolean(
    displayName && handle && displayName.toLowerCase() !== handle.toLowerCase(),
  );

  const [open, setOpen] = useState(false);
  const [socials, setSocials] = useState<SocialLinks | null>(null);
  const [showSocials, setShowSocials] = useState(false);
  const loadingRef = useRef(false);
  const loadedRef = useRef(false);

  const fetchSocials = useCallback(async () => {
    if (!handle || loadingRef.current || loadedRef.current) return;
    loadingRef.current = true;
    try {
      const res = await fetch(
        apiV1(`/profile/public/socials/${encodeURIComponent(handle)}`),
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load socials");
      const nextSocials = (data?.socials ?? {}) as SocialLinks;
      const hasAny = Object.values(nextSocials).some(Boolean);
      const enabled = Boolean(data?.showSocials && hasAny);
      setShowSocials(enabled);
      setSocials(enabled ? nextSocials : null);
      if (!enabled) {
        setOpen(false);
      }
      loadedRef.current = true;
    } catch {
      setShowSocials(false);
      setSocials(null);
      loadedRef.current = true;
      setOpen(false);
    } finally {
      loadingRef.current = false;
    }
  }, [handle]);

  const socialItems = useMemo(() => {
    const links = socials ?? {};
    const cleanHandle = (value: string) => value.replace(/^@/, "").trim();
    const toUrl = (value: string, base?: string) => {
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return trimmed;
      }
      if (base) return `${base}${cleanHandle(trimmed)}`;
      return `https://${trimmed}`;
    };
    const toLabel = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return trimmed.replace(/^https?:\/\//, "");
      }
      return `@${cleanHandle(trimmed)}`;
    };
    const items = [
      {
        key: "instagram",
        label: "Instagram",
        icon: IconBrandInstagram,
        value: links.instagram,
        url: links.instagram
          ? toUrl(links.instagram, "https://instagram.com/")
          : null,
      },
      {
        key: "x",
        label: "X",
        icon: IconBrandX,
        value: links.x,
        url: links.x ? toUrl(links.x, "https://x.com/") : null,
      },
      {
        key: "github",
        label: "GitHub",
        icon: IconBrandGithub,
        value: links.github,
        url: links.github ? toUrl(links.github, "https://github.com/") : null,
      },
      {
        key: "website",
        label: "Website",
        icon: IconWorld,
        value: links.website,
        url: links.website ? toUrl(links.website) : null,
      },
      {
        key: "other",
        label: "Other",
        icon: IconLink,
        value: links.other,
        url: links.other ? toUrl(links.other) : null,
      },
    ];
    return items
      .map((item) => ({
        ...item,
        display: item.value ? toLabel(item.value) : "",
      }))
      .filter((item) => item.url);
  }, [socials]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setOpen(false);
        return;
      }
      if (!handle) return;
      setOpen(true);
      fetchSocials();
    },
    [fetchSocials, handle],
  );

  const content = (
    <div className={cn("flex items-center gap-3", className)}>
      <UserAvatar
        src={image}
        userId={userId}
        alt=""
        className={cn(
          "h-10 w-10 rounded-full border object-cover",
          avatarClassName,
        )}
        loading="lazy"
        decoding="async"
      />
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-1">
          {label && <p className="text-xs text-muted-foreground">{label}</p>}
          <div
            onClick={() => {
              handleOpenChange(true);
            }}
            role="button"
            className="flex flex-wrap items-center gap-1"
          >
            {primaryLabel && (
              <span className="text-sm font-medium text-foreground">
                {primaryLabel}
              </span>
            )}
            {verified && <IconRosetteDiscountCheck className="h-3.5 w-3.5" />}

            {showHandle && (
              <span className="text-sm text-muted-foreground">@{handle}</span>
            )}
          </div>
        </div>
        {bio && !isAnonymous && (
          <p className="text-xs text-muted-foreground line-clamp-2">{bio}</p>
        )}
        {isAnonymous && (
          <p className="text-xs text-muted-foreground">
            {anonymousWarning ||
              "Anonymous share hides the owner profile, but the content may still reveal identity."}
          </p>
        )}
      </div>
    </div>
  );

  if (!hasAnyContent) return null;
  if (!handle || isAnonymous) return content;

  return (
    <Tooltip open={open && showSocials} onOpenChange={handleOpenChange}>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      {showSocials ? (
        <TooltipContent
          side="top"
          align={placement}
          className="max-w-xs text-xs bg-secondary p-3"
        >
          <p className="text-xs text-muted-foreground">
            You can also find them on:
          </p>
          <div className="mt-2 grid gap-2">
            {socialItems.map((item) => (
              <Link
                key={item.key}
                href={item.url ?? "#"}
                target="_blank"
                className="flex items-center gap-2 text-xs text-foreground hover:text-primary"
              >
                <item.icon className="h-4 w-4" />
                <span className="font-medium">{item.label}</span>
                <span className="text-muted-foreground">{item.display}</span>
              </Link>
            ))}
          </div>
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
}
