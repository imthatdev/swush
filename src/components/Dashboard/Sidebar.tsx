/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
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
import KeyboardShortcuts from "@/components/Common/KeyboardShortcuts";
import {
  IconBell,
  IconChartBar,
  IconLogout,
  IconFolder,
  IconLogs,
  IconInfoSquareRounded,
  IconLayoutDashboardFilled,
  IconLinkPlus,
  IconListCheck,
  IconListSearch,
  IconMailSpark,
  IconPalette,
  IconSettings2,
  IconShieldLock,
  IconTags,
  IconUser,
  IconLibrary,
} from "@tabler/icons-react";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { Sidebar, SidebarBody, SidebarLink } from "../ui/sidebar";
import { cn } from "@/lib/utils";
import { Logo } from "../Common/Logo";
import { useTheme } from "next-themes";
import { useUser } from "@/hooks/use-user";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { useColorScheme } from "@/hooks/use-scheme";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "../ui/label";
import { authClient } from "@/lib/auth-client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "../ui/separator";
import NotificationBell from "@/components/Notifications/NotificationBell";
import { apiV1 } from "@/lib/api-path";
import { toast } from "sonner";

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [accordionValue, setAccordionValue] = useState<string>("");
  const { user } = useUser();
  const { scheme, setScheme, SCHEMES } = useColorScheme();
  const userRole = user?.role ?? "user";
  const isAdmin = userRole === "admin" || userRole === "owner";
  const isOwner = userRole === "owner";
  const { prefs } = useUserPreferences();

  const buildVaultHref = () => {
    const sp = new URLSearchParams();
    if (prefs.lastFolder && prefs.rememberLastFolder === true)
      sp.set("folder", prefs.lastFolder);
    if (prefs.vaultView === "grid") sp.set("gallery", "1");
    if (prefs.vaultSort) sp.set("sort", prefs.vaultSort);
    return `/vault${sp.toString() ? `?${sp.toString()}` : ""}`;
  };

  const [schemeDialogOpen, setSchemeDialogOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pendingScheme, setPendingScheme] = useState(scheme);
  const [pendingMode, setPendingMode] = useState<string>(theme || "system");

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => {
      root.style.setProperty(
        "--sidebar-width",
        mq.matches ? (open ? "300px" : "60px") : "0px",
      );
    };
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      root.style.removeProperty("--sidebar-width");
    };
  }, [open]);

  useEffect(() => {
    let active = true;
    const loadUnread = async () => {
      try {
        const res = await fetch(apiV1("/notifications?limit=1"), {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;
        setUnreadNotifications(Number(json.unread || 0));
      } catch {
        toast.error("Failed to load notifications");
      }
    };

    void loadUnread();
    const timer = window.setInterval(loadUnread, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const effectiveAccordionValue = open ? accordionValue : "";

  const handleLogout = async () => {
    await authClient.signOut();
    router.refresh();
  };

  const mainUpperLinks = [
    {
      label: "Search",
      href: "",
      icon: <IconListSearch className="h-5 w-5 shrink-0" />,
      onClick: () =>
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "k", metaKey: true }),
        ),
    },
    {
      label: "Vault",
      href: buildVaultHref(),
      icon: <IconLayoutDashboardFilled className="h-5 w-5 shrink-0" />,
    },
    {
      label: "Folders",
      href: "/folders",
      icon: <IconFolder className="h-5 w-5 shrink-0" />,
    },
    {
      label: "Tags",
      href: "/tags",
      icon: <IconTags className="h-5 w-5 shrink-0" />,
    },
    {
      label: "Settings",
      href: "/settings",
      icon: <IconSettings2 className="h-5 w-5 shrink-0" />,
    },
  ];

  const contentLinks = [
    {
      label: "Shorten",
      href: "/shortener",
      icon: <IconLinkPlus className="h-4 w-4 shrink-0" />,
    },
    {
      label: "Watchlist",
      href: "/watch",
      icon: <IconListCheck className="h-4 w-4 shrink-0" />,
    },
  ];

  const adminLinks = [
    {
      label: "Metrics",
      href: "/admin/metrics",
      icon: <IconChartBar className="h-4 w-4 shrink-0" />,
    },
    {
      label: "Server Settings",
      href: "/admin/settings",
      icon: <IconShieldLock className="h-4 w-4 shrink-0" />,
    },
    {
      label: "Invite Links",
      href: "/admin/invites",
      icon: <IconMailSpark className="h-4 w-4 shrink-0" />,
    },
    {
      label: "Manage Users",
      href: "/admin/users",
      icon: <IconUser className="h-4 w-4 shrink-0" />,
    },
  ];

  const lowerLinks = [
    {
      label: "Notifications",
      icon: (
        <span className="relative">
          <IconBell className="h-5 w-5 shrink-0" />
          {unreadNotifications > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive" />
          )}
        </span>
      ),
      onClick: () => setNotificationsOpen(true),
    },
    {
      label: "Metrics",
      href: "/metrics",
      icon: <IconChartBar className="h-5 w-5 shrink-0" />,
    },
    {
      label: "Info",
      href: "/about",
      icon: <IconInfoSquareRounded className="h-5 w-5 shrink-0" />,
    },
    {
      label: "Theme",
      icon: <IconPalette className="h-5 w-5 shrink-0" />,
      onClick: () => {
        setSchemeDialogOpen(true);
      },
    },
    {
      label: "Logout",
      icon: <IconLogout className="h-5 w-5 shrink-0 ml-0.5" />,
      onClick: handleLogout,
    },
  ];

  return (
    <>
      <KeyboardShortcuts />
      <div
        className={cn(
          "mx-auto flex w-full max-w-full flex-1 flex-col bg-secondary border-0 md:border border-border md:flex-row",
          "h-svh overflow-hidden ",
        )}
      >
        <Sidebar open={open} setOpen={setOpen} animate={true}>
          <SidebarBody className="group justify-between bg-secondary max-w-64 md:max-w-52 z-40">
            <div className="flex flex-col space-y-4 overflow-x-hidden min-h-0">
              <Logo />
              <div className="flex flex-col">
                <div className="flex flex-col gap-2 overflow-y-auto  flex-1 min-h-0">
                  {mainUpperLinks.map((link, idx) => {
                    const isActive = pathname === link.href;
                    return (
                      <SidebarLink
                        key={idx}
                        link={link}
                        className={cn(
                          isActive
                            ? "bg-primary text-primary-foreground rounded-md px-1"
                            : "hover:bg-muted hover:rounded-md ml-1 text-muted-foreground",
                          link.label === "Search" &&
                            "bg-card rounded-md ml-0 px-1",
                        )}
                        onClick={() => {
                          if (link.onClick) link.onClick();
                        }}
                      />
                    );
                  })}

                  <Accordion
                    type="single"
                    collapsible
                    className="mt-2"
                    value={effectiveAccordionValue}
                    onValueChange={(value) => setAccordionValue(value || "")}
                  >
                    <AccordionItem value="content">
                      <AccordionTrigger className="px-1 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <IconLibrary className="h-5 w-5 shrink-0" />
                          <span>Content</span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 ml-7">
                        {contentLinks.map((link, idx) => {
                          const isActive = pathname === link.href;
                          return (
                            <SidebarLink
                              key={idx}
                              link={link}
                              className={cn(
                                isActive
                                  ? "bg-primary text-primary-foreground rounded-md px-1"
                                  : "hover:bg-muted hover:rounded-md text-muted-foreground",
                              )}
                            />
                          );
                        })}
                      </AccordionContent>
                    </AccordionItem>

                    {isAdmin && (
                      <AccordionItem value="admin">
                        <AccordionTrigger className="px-1 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                          <span className="flex items-center gap-2">
                            <IconShieldLock className="h-5 w-5 shrink-0" />
                            <span>Admin</span>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-2 ml-7">
                          {adminLinks.map((link, idx) => {
                            const isActive = pathname === link.href;
                            return (
                              <SidebarLink
                                key={idx}
                                link={link}
                                className={cn(
                                  isActive
                                    ? "bg-primary text-primary-foreground rounded-md px-1"
                                    : "hover:bg-muted hover:rounded-md text-muted-foreground",
                                )}
                              />
                            );
                          })}
                          {isOwner && (
                            <SidebarLink
                              link={{
                                label: "Audit Logs",
                                href: "/admin/audit",
                                icon: (
                                  <IconLogs className="h-4.5 w-4.5 shrink-0" />
                                ),
                              }}
                              className={cn(
                                pathname === "/admin/audit"
                                  ? "bg-primary text-primary-foreground rounded-md px-1"
                                  : "hover:bg-muted hover:rounded-md text-muted-foreground",
                              )}
                            />
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    )}
                  </Accordion>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Separator />
              {lowerLinks.map((link, idx) => {
                const isActive = pathname === link.href;
                return (
                  <SidebarLink
                    key={idx}
                    link={{
                      label: link.label,
                      href: link.href as string | undefined,
                      icon: link.icon,
                    }}
                    onClick={(evt) => {
                      if (!link.href && link.onClick) {
                        evt?.preventDefault?.();
                        link.onClick();
                      }
                    }}
                    className={cn(
                      isActive
                        ? "bg-primary text-primary-foreground rounded-md px-1"
                        : "hover:bg-muted hover:rounded-md ml-1 text-muted-foreground",
                    )}
                  />
                );
              })}
            </div>
          </SidebarBody>
        </Sidebar>

        <Dialog open={schemeDialogOpen} onOpenChange={setSchemeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Appearance</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Color scheme
                </Label>
                <Select
                  value={pendingScheme}
                  onValueChange={(v: string) => {
                    const next = v as (typeof SCHEMES)[number];
                    setPendingScheme(next);
                    setScheme(next);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a scheme" />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEMES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Appearance
                </Label>
                <Select
                  value={pendingMode}
                  onValueChange={(v) => {
                    setPendingMode(v);
                    setTheme(v);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="System / Light / Dark" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <p className="text-xs text-muted-foreground">
                Schemes change the app colors; appearance controls light/dark.
                Both are saved.
              </p>
            </div>
          </DialogContent>
        </Dialog>
        <NotificationBell
          open={notificationsOpen}
          onOpenChange={setNotificationsOpen}
          onUnreadChange={setUnreadNotifications}
        />
        <div className="flex-1 flex flex-col min-h-0">{children}</div>
      </div>
    </>
  );
}
