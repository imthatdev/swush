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
import { IconPlayerPlay, IconRefresh, IconX } from "@tabler/icons-react";
import * as React from "react";
import { z } from "zod";
import { useForm, type SubmitHandler, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { ServerSettings } from "@/lib/settings";
import { toast } from "sonner";
import Field from "../Shared/CustomField";
import Grid from "../Shared/CustomGrid";
import ToggleRow from "../Shared/CustomToggle";
import Card from "../Shared/CustomCard";
import PageLayout from "../Common/PageLayout";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  adminListJobRuns,
  adminClearJobRuns,
  adminRunJob,
  adminUpdateSettings,
  adminListImportRuns,
  adminClearImportRuns,
} from "@/lib/client/admin";
import type { AdminJobName, AdminJobRun } from "@/types/admin-jobs";
import { PaginationFooter } from "../Shared/PaginationFooter";
import { HelpTip } from "./Docs/HelpTip";

const SettingsSchema = z.object({
  maxUploadMb: z.coerce.number().int().min(1).max(102400),
  maxFilesPerUpload: z.coerce.number().int().min(1).max(1000),
  allowPublicRegistration: z.boolean(),
  passwordPolicyMinLength: z.coerce.number().int().min(6).max(128),

  userDailyQuotaMb: z.coerce
    .number()
    .int()
    .min(0)
    .max(1024 * 1024),
  adminDailyQuotaMb: z.coerce
    .number()
    .int()
    .min(0)
    .max(1024 * 1024),

  userMaxStorageMb: z.coerce
    .number()
    .int()
    .min(0)
    .max(1024 * 1024),
  adminMaxStorageMb: z.coerce
    .number()
    .int()
    .min(0)
    .max(1024 * 1024),

  filesLimitUser: z.coerce.number().int().min(1).max(10000).nullable(),
  filesLimitAdmin: z.coerce.number().int().min(1).max(10000).nullable(),
  shortLinksLimitUser: z.coerce.number().int().min(1).max(10000).nullable(),
  shortLinksLimitAdmin: z.coerce.number().int().min(1).max(10000).nullable(),

  allowRemoteUpload: z.boolean(),
  sponsorBannerEnabled: z.boolean(),
  disableApiTokens: z.boolean(),

  allowedMimePrefixes: z.string().optional(),
  disallowedExtensions: z.string().optional(),
  preservedUsernames: z.string().optional(),
});

type FormValues = z.infer<typeof SettingsSchema>;

const JOBS: Array<{
  id: AdminJobName;
  label: string;
  description: string;
  supportsLimit?: boolean;
}> = [
  {
    id: "media-optimization",
    label: "Media optimization",
    description: "Compress and transcode queued media files.",
    supportsLimit: true,
  },
  {
    id: "preview-generation",
    label: "Preview generation",
    description: "Generate preview thumbnails for videos and GIFs.",
    supportsLimit: true,
  },
  {
    id: "stream-generation",
    label: "Stream generation",
    description: "Generate HLS streams for audio and video files.",
    supportsLimit: true,
  },
  {
    id: "storage-cleanup",
    label: "Storage cleanup",
    description: "Retry cleanup for failed storage deletions.",
    supportsLimit: true,
  },
  {
    id: "steam-playtime",
    label: "Steam playtime sync",
    description: "Refresh playtime stats from Steam.",
  },
  {
    id: "anilist-watching",
    label: "AniList watching sync",
    description: "Update active AniList watching progress.",
  },
];

const JOB_LABELS = JOBS.reduce(
  (acc, job) => ({ ...acc, [job.id]: job.label }),
  {} as Record<AdminJobName, string>,
);

const strArrParser = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export default function AdminSettingsClient({
  initialValues,
}: {
  initialValues: ServerSettings;
}) {
  const [activeTab, setActiveTab] = React.useState("general");
  const initialPreserved = React.useMemo(
    () =>
      (initialValues.preservedUsernames ?? [])
        .map((name: string) => name.trim())
        .filter(Boolean),
    [initialValues.preservedUsernames],
  );
  const form = useForm<FormValues>({
    resolver: zodResolver(SettingsSchema) as unknown as Resolver<FormValues>,
    defaultValues: {
      maxUploadMb: initialValues.maxUploadMb,
      maxFilesPerUpload: initialValues.maxFilesPerUpload,
      allowPublicRegistration: initialValues.allowPublicRegistration,
      sponsorBannerEnabled: initialValues.sponsorBannerEnabled ?? true,
      disableApiTokens: initialValues.disableApiTokens ?? false,

      userDailyQuotaMb: initialValues.userDailyQuotaMb,
      adminDailyQuotaMb: initialValues.adminDailyQuotaMb,
      userMaxStorageMb: initialValues.userMaxStorageMb,
      adminMaxStorageMb: initialValues.adminMaxStorageMb,
      filesLimitUser: initialValues.filesLimitUser,
      filesLimitAdmin: initialValues.filesLimitAdmin,
      shortLinksLimitUser: initialValues.shortLinksLimitUser,
      shortLinksLimitAdmin: initialValues.shortLinksLimitAdmin,

      allowedMimePrefixes: (initialValues.allowedMimePrefixes ?? []).join(", "),
      disallowedExtensions: (initialValues.disallowedExtensions ?? []).join(
        ", ",
      ),
      preservedUsernames: (initialValues.preservedUsernames ?? []).join(", "),
      allowRemoteUpload: initialValues.allowRemoteUpload,

      passwordPolicyMinLength: initialValues.passwordPolicyMinLength,
    },
  });

  const [saving, setSaving] = React.useState(false);
  const [preservedUsernames, setPreservedUsernames] =
    React.useState<string[]>(initialPreserved);
  const [preservedInput, setPreservedInput] = React.useState("");
  const [jobRuns, setJobRuns] = React.useState<AdminJobRun[]>([]);
  const [jobTotal, setJobTotal] = React.useState(0);
  const [jobsLoading, setJobsLoading] = React.useState(false);
  const [jobsRefreshing, setJobsRefreshing] = React.useState(false);
  const [jobRunning, setJobRunning] = React.useState<AdminJobName | null>(null);
  const [mediaLimit, setMediaLimit] = React.useState(10);
  const [jobsPage, setJobsPage] = React.useState(1);
  const [jobsPageSize] = React.useState(10);
  const [jobsClearing, setJobsClearing] = React.useState(false);
  const v = form.watch();

  const [importRuns, setImportRuns] = React.useState<
    {
      id: string;
      provider: string;
      userId: string | null;
      itemsTotal: number;
      itemsOk: number;
      itemsFail: number;
      createdAt: string;
      updatedAt?: string | null;
    }[]
  >([]);
  const [importTotal, setImportTotal] = React.useState(0);
  const [importsLoading, setImportsLoading] = React.useState(false);
  const [importsPage, setImportsPage] = React.useState(1);
  const [importsPageSize] = React.useState(10);
  const [importsClearing, setImportsClearing] = React.useState(false);
  const [showImportsModal, setShowImportsModal] = React.useState(false);

  const [selectedRun, setSelectedRun] = React.useState<AdminJobRun | null>(
    null,
  );

  React.useEffect(() => {
    setPreservedUsernames(initialPreserved);
  }, [initialPreserved]);

  const syncPreservedUsernames = (next: string[]) => {
    setPreservedUsernames(next);
    form.setValue("preservedUsernames", next.join(", "), {
      shouldDirty: true,
    });
  };

  const addPreservedTokens = (raw: string) => {
    const tokens = raw
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean);
    if (tokens.length === 0) return;

    const existing = new Set(
      preservedUsernames.map((token) => token.toLowerCase()),
    );
    const next = [...preservedUsernames];
    tokens.forEach((token) => {
      const key = token.toLowerCase();
      if (!existing.has(key)) {
        existing.add(key);
        next.push(token);
      }
    });
    syncPreservedUsernames(next);
    setPreservedInput("");
  };

  const removePreservedToken = (token: string) => {
    const next = preservedUsernames.filter((item) => item !== token);
    syncPreservedUsernames(next);
  };

  const loadJobRuns = React.useCallback(
    async (silent = false) => {
      if (!silent) setJobsLoading(true);
      if (silent) setJobsRefreshing(true);
      try {
        const data = await adminListJobRuns({
          limit: jobsPageSize,
          offset: (jobsPage - 1) * jobsPageSize,
        });
        setJobRuns(data.items);
        setJobTotal(data.total ?? data.items.length);
      } catch (error) {
        toast.error("Failed to load job runs", {
          description: (error as Error).message,
        });
      } finally {
        if (!silent) setJobsLoading(false);
        if (silent) setJobsRefreshing(false);
      }
    },
    [jobsPage, jobsPageSize],
  );

  const loadImportRuns = React.useCallback(
    async (silent = false) => {
      if (!silent) setImportsLoading(true);
      try {
        const data = await adminListImportRuns({
          limit: importsPageSize,
          offset: (importsPage - 1) * importsPageSize,
        });
        setImportRuns(data.items);
        setImportTotal(data.total ?? data.items.length);
      } catch (error) {
        toast.error("Failed to load import runs", {
          description: (error as Error).message,
        });
      } finally {
        if (!silent) setImportsLoading(false);
      }
    },
    [importsPage, importsPageSize],
  );

  React.useEffect(() => {
    if (activeTab !== "jobs") return;
    void loadJobRuns();
  }, [activeTab, loadJobRuns, jobsPage]);

  React.useEffect(() => {
    if (activeTab !== "jobs") return;
    void loadImportRuns();
  }, [activeTab, loadImportRuns, importsPage]);

  const runJob = async (job: AdminJobName) => {
    if (jobRunning) return;
    setJobRunning(job);
    try {
      const limitValue = Number(mediaLimit);
      const limit =
        job === "media-optimization" && Number.isFinite(limitValue)
          ? limitValue
          : undefined;
      const result = await adminRunJob({ job, limit });
      if (!result.ok) {
        throw new Error(result.error);
      }
      toast.success("Job started", {
        description: `${job.replace(/-/g, " ")} queued successfully.`,
      });
      await loadJobRuns(true);
    } catch (error) {
      toast.error("Job failed", {
        description: (error as Error).message,
      });
    } finally {
      setJobRunning(null);
    }
  };

  const clearJobRuns = async () => {
    if (jobsClearing) return;
    setJobsClearing(true);
    try {
      const result = await adminClearJobRuns();
      if (!result.ok) {
        throw new Error(result.error);
      }
      setJobsPage(1);
      setJobRuns([]);
      setJobTotal(0);
      toast.success("Job log cleared");
    } catch (error) {
      toast.error("Failed to clear job log", {
        description: (error as Error).message,
      });
    } finally {
      setJobsClearing(false);
    }
  };

  const clearImportRuns = async () => {
    if (importsClearing) return;
    setImportsClearing(true);
    try {
      const result = await adminClearImportRuns();
      if (!result.ok) throw new Error(result.error);
      setImportsPage(1);
      setImportRuns([]);
      setImportTotal(0);
      toast.success("Import log cleared");
    } catch (error) {
      toast.error("Failed to clear import log", {
        description: (error as Error).message,
      });
    } finally {
      setImportsClearing(false);
    }
  };

  const formatJobDate = (value: string | null | undefined) => {
    if (!value) return "ꕀ";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "ꕀ";
    return date.toLocaleString();
  };

  const formatJobResult = (result: AdminJobRun["result"]) => {
    if (!result || typeof result !== "object") return "ꕀ";
    const entries = Object.entries(result).filter(
      ([, value]) => value !== null && value !== undefined,
    );
    if (entries.length === 0) return "ꕀ";

    const parts: string[] = [];
    for (const [key, value] of entries) {
      if (key === "perUser" && Array.isArray(value)) {
        parts.push(`per user: ${value.length} user(s)`);
        continue;
      }

      if (Array.isArray(value)) {
        parts.push(`${key.replace(/_/g, " ")}: ${value.length} item(s)`);
        continue;
      }
      if (typeof value === "object") {
        parts.push(`${key.replace(/_/g, " ")}: object`);
        continue;
      }
      parts.push(`${key.replace(/_/g, " ")}: ${String(value)}`);
    }

    return parts.join(", ");
  };

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    setSaving(true);
    try {
      type Payload = Omit<
        FormValues,
        "allowedMimePrefixes" | "disallowedExtensions" | "preservedUsernames"
      > & {
        allowedMimePrefixes: string[] | null;
        disallowedExtensions: string[] | null;
        preservedUsernames: string[] | null;
      };

      const {
        allowedMimePrefixes: amp,
        disallowedExtensions: dex,
        preservedUsernames: pun,
        ...rest
      } = values;

      const payload: Payload = {
        ...rest,
        allowedMimePrefixes: amp ? strArrParser(amp) : null,
        disallowedExtensions: dex ? strArrParser(dex) : null,
        preservedUsernames: pun ? strArrParser(pun) : null,
      };

      const result = await adminUpdateSettings(payload);
      if (!result.ok) {
        const msg =
          typeof result.error === "string"
            ? result.error
            : "Failed to save settings";
        throw new Error(msg);
      }

      toast.success("Settings saved", {
        description: "Server settings updated successfully.",
      });
    } catch (e) {
      toast.error("Save failed", {
        description: (e as Error).message ?? "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout
      title="Server Settings"
      subtitle="Configure global settings for your application"
    >
      <div className="grid gap-6 w-full min-w-0">
        <Tabs
          defaultValue="general"
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="upload">Uploads</TabsTrigger>
            <TabsTrigger value="limits">Limits</TabsTrigger>
            <TabsTrigger value="safety">Safety</TabsTrigger>
            <TabsTrigger value="jobs">Jobs</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <Card title="Registration">
              <ToggleRow
                label={
                  <span className="inline-flex items-center">
                    Allow public registration
                    <HelpTip text="If on, anyone can sign up. If off, only invited accounts or admin-created users can access." />
                  </span>
                }
                checked={v.allowPublicRegistration}
                onCheckedChange={(c) =>
                  form.setValue("allowPublicRegistration", c, {
                    shouldDirty: true,
                  })
                }
              />
            </Card>

            <Card title="Sponsorship">
              <ToggleRow
                label={
                  <span className="inline-flex items-center">
                    Show sponsor banner
                    <HelpTip text="Show a small sponsor banner every so often to support development." />
                  </span>
                }
                checked={v.sponsorBannerEnabled}
                onCheckedChange={(c) =>
                  form.setValue("sponsorBannerEnabled", c, {
                    shouldDirty: true,
                  })
                }
              />
            </Card>

            <Card title="Security Defaults">
              <Grid cols={1}>
                <Field
                  label={
                    <span className="inline-flex items-center">
                      Password min length
                      <HelpTip text="Minimum required length for new passwords. Pair with 2FA for stronger security." />
                    </span>
                  }
                >
                  <Input
                    type="number"
                    {...form.register("passwordPolicyMinLength")}
                  />
                </Field>
                <div className="text-xs text-muted-foreground self-end">
                  Use a higher value if you rely on passwords over passkeys.
                </div>
              </Grid>
              <Field
                label={
                  <span className="inline-flex items-center">
                    Preserved usernames
                    <HelpTip text="Reserved names that cannot be registered by users (e.g., admin, root). Supports wildcards: *word (suffix), word* (prefix), or, word^ (contains)." />
                  </span>
                }
              >
                <input type="hidden" {...form.register("preservedUsernames")} />
                <div className="grid gap-2">
                  <div className="flex flex-wrap gap-2">
                    {preservedUsernames.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        No preserved usernames set.
                      </span>
                    ) : (
                      preservedUsernames.map((token) => (
                        <Badge
                          key={token}
                          variant="secondary"
                          className="flex items-center gap-1 pr-1"
                        >
                          {token}
                          <button
                            type="button"
                            onClick={() => removePreservedToken(token)}
                            className="rounded-sm p-0.5 hover:bg-muted"
                            aria-label={`Remove ${token}`}
                          >
                            <IconX className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>
                  <Input
                    placeholder="Type a name and press Enter"
                    value={preservedInput}
                    onChange={(event) => setPreservedInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === ",") {
                        event.preventDefault();
                        addPreservedTokens(preservedInput);
                      }
                    }}
                    onBlur={() => addPreservedTokens(preservedInput)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Commas add multiple names. Patterns: *bad, bad*, bad^
                  </p>
                </div>
              </Field>
            </Card>
          </TabsContent>

          <TabsContent value="upload" className="space-y-6">
            <Card title="Upload Limits">
              <p className="text-xs text-muted-foreground mb-3">
                Control per-request payloads. Set 0 to allow unlimited.
              </p>
              <Grid cols={2}>
                <Field
                  label={
                    <span className="inline-flex items-center">
                      Max file size (MB)
                      <HelpTip text="Largest single-file size allowed per upload. Ensure proxy (nginx/Cloudflare) and storage (S3/local) allow at least this size." />
                    </span>
                  }
                  error={form.formState.errors.maxUploadMb?.message}
                >
                  <Input type="number" {...form.register("maxUploadMb")} />
                </Field>
                <Field
                  label={
                    <span className="inline-flex items-center">
                      Max files per upload
                      <HelpTip text="How many files a user can include in a single upload request." />
                    </span>
                  }
                  error={form.formState.errors.maxFilesPerUpload?.message}
                >
                  <Input
                    type="number"
                    {...form.register("maxFilesPerUpload")}
                  />
                </Field>
                <Field label="Remote Uploads">
                  <ToggleRow
                    label={
                      <span className="inline-flex items-center">
                        Allow remote URL uploads
                        <HelpTip text="Allow users to upload files via remote URLs." />
                      </span>
                    }
                    checked={v.allowRemoteUpload}
                    onCheckedChange={(c) =>
                      form.setValue("allowRemoteUpload", c, {
                        shouldDirty: true,
                      })
                    }
                  />
                </Field>
              </Grid>
            </Card>

            <Card title="Storage & Quotas">
              <p className="text-xs text-muted-foreground mb-3">
                Cap total storage and rolling 24-hour upload quotas by role.
              </p>
              <Grid cols={2}>
                <Field
                  label={
                    <span className="inline-flex items-center">
                      User daily quota (MB)
                      <HelpTip text="Total bytes a user may upload in a rolling 24-hour window. Set 0 for unlimited. Show remaining quota to users for clarity." />
                    </span>
                  }
                  error={form.formState.errors.userDailyQuotaMb?.message}
                >
                  <Input type="number" {...form.register("userDailyQuotaMb")} />
                </Field>
                <Field
                  label={
                    <span className="inline-flex items-center">
                      Admin daily quota (MB)
                      <HelpTip text="Daily upload cap for admins. Set 0 for unlimited." />
                    </span>
                  }
                  error={form.formState.errors.adminDailyQuotaMb?.message}
                >
                  <Input
                    type="number"
                    {...form.register("adminDailyQuotaMb")}
                  />
                </Field>
                <Field
                  label={
                    <span className="inline-flex items-center">
                      User total storage cap (MB)
                      <HelpTip text="Maximum total storage per user account. When reached, uploads are blocked until files are deleted." />
                    </span>
                  }
                  error={form.formState.errors.userMaxStorageMb?.message}
                >
                  <Input type="number" {...form.register("userMaxStorageMb")} />
                </Field>
                <Field
                  label={
                    <span className="inline-flex items-center">
                      Admin total storage cap (MB)
                      <HelpTip text="Maximum total storage for admin accounts. Set 0 for unlimited." />
                    </span>
                  }
                  error={form.formState.errors.adminMaxStorageMb?.message}
                >
                  <Input
                    type="number"
                    {...form.register("adminMaxStorageMb")}
                  />
                </Field>
              </Grid>
            </Card>
          </TabsContent>

          <TabsContent value="limits" className="space-y-6">
            <Card
              title={
                <span className="inline-flex items-center">
                  Vault Limits (per role)
                  <HelpTip text="Per-type item caps per role. Leave empty to keep current value; use a very large number or a dedicated '0 means unlimited' policy if you prefer no cap." />
                </span>
              }
            >
              <div className="grid gap-4">
                <div className="grid gap-3 rounded-md border p-3">
                  <div className="text-sm font-medium">Files</div>
                  <Grid cols={2}>
                    <Field label="User limit">
                      <Input
                        type="number"
                        placeholder="1>"
                        {...form.register("filesLimitUser")}
                      />
                    </Field>
                    <Field label="Admin limit">
                      <Input
                        type="number"
                        placeholder="1>"
                        {...form.register("filesLimitAdmin")}
                      />
                    </Field>
                  </Grid>
                </div>

                <div className="grid gap-3 rounded-md border p-3">
                  <div className="text-sm font-medium">Short links</div>
                  <Grid cols={2}>
                    <Field label="User limit">
                      <Input
                        type="number"
                        placeholder="1>"
                        {...form.register("shortLinksLimitUser")}
                      />
                    </Field>
                    <Field label="Admin limit">
                      <Input
                        type="number"
                        placeholder="1>"
                        {...form.register("shortLinksLimitAdmin")}
                      />
                    </Field>
                  </Grid>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="safety" className="space-y-6">
            <Card title="API Access">
              <ToggleRow
                label={
                  <span className="inline-flex items-center">
                    Disable API tokens
                    <HelpTip text="Blocks API key authentication and disables token issuance. Use this to fully lock down API token access." />
                  </span>
                }
                checked={v.disableApiTokens}
                onCheckedChange={(c) =>
                  form.setValue("disableApiTokens", c, { shouldDirty: true })
                }
              />
            </Card>
            <Card title="Processing & Safety">
              <Grid cols={2}>
                <Field
                  label={
                    <span className="inline-flex items-center">
                      Allowed MIME prefixes (comma-separated)
                      <HelpTip text="Whitelist by prefix, e.g., image/, video/, audio/, application/pdf. Requests outside this list are rejected." />
                    </span>
                  }
                >
                  <Input
                    placeholder="image/, video/, audio/, application/pdf"
                    {...form.register("allowedMimePrefixes")}
                  />
                </Field>

                <Field
                  label={
                    <span className="inline-flex items-center">
                      Disallowed extensions (comma-separated)
                      <HelpTip text="Explicit denylist at filename level, e.g., .exe, .dll, .bat. This runs after MIME checks as a final safety net." />
                    </span>
                  }
                >
                  <Input
                    placeholder=".exe, .dll, .bat"
                    {...form.register("disallowedExtensions")}
                  />
                </Field>
              </Grid>
            </Card>
          </TabsContent>

          <TabsContent value="jobs" className="space-y-6">
            <Card title="Run maintenance jobs">
              <div className="grid gap-3">
                {JOBS.map((job) => (
                  <div
                    key={job.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-55">
                      <div className="text-sm font-medium">{job.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {job.description}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.supportsLimit ? (
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          className="w-20"
                          value={mediaLimit}
                          onChange={(event) =>
                            setMediaLimit(Number(event.target.value))
                          }
                          disabled={jobRunning !== null}
                        />
                      ) : null}
                      <Button
                        type="button"
                        onClick={() => runJob(job.id)}
                        disabled={jobRunning !== null}
                      >
                        <IconPlayerPlay className="h-4 w-4" />
                        {jobRunning === job.id ? "Running..." : "Run"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Recent runs">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Latest job runs and outcomes.
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => loadJobRuns(true)}
                    disabled={jobsRefreshing}
                  >
                    <IconRefresh className="h-4 w-4" />
                    {jobsRefreshing ? "Refreshing..." : "Refresh"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearJobRuns}
                    disabled={jobsClearing || jobRuns.length === 0}
                  >
                    {jobsClearing ? "Clearing..." : "Clear log"}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowImportsModal(true);
                      void loadImportRuns(true);
                    }}
                    disabled={importsLoading}
                  >
                    View imports
                  </Button>
                </div>
              </div>
              {jobsLoading ? (
                <div className="text-sm text-muted-foreground">
                  Loading job history...
                </div>
              ) : jobRuns.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No job runs yet.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Finished</TableHead>
                        <TableHead>Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobRuns.map((run) => {
                        const status = String(run.status || "running");
                        const statusTone =
                          status === "success"
                            ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
                            : status === "failed"
                              ? "border-destructive/30 text-destructive bg-destructive/10"
                              : "border-amber-500/30 text-amber-600 bg-amber-500/10";
                        return (
                          <TableRow key={run.id}>
                            <TableCell className="font-medium">
                              {JOB_LABELS[run.job as AdminJobName] ?? run.job}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusTone}>
                                {status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {formatJobDate(run.startedAt)}
                            </TableCell>
                            <TableCell>
                              {formatJobDate(run.finishedAt)}
                            </TableCell>
                            <TableCell>
                              <div className="text-xs text-muted-foreground">
                                {formatJobResult(run.result)}
                              </div>
                              {run.error ? (
                                <div className="text-xs text-destructive">
                                  {run.error}
                                </div>
                              ) : null}

                              <div className="mt-1">
                                <Button
                                  size="sm"
                                  variant="link"
                                  onClick={() => setSelectedRun(run)}
                                >
                                  View details
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              <PaginationFooter
                page={jobsPage}
                totalPages={Math.max(1, Math.ceil(jobTotal / jobsPageSize))}
                onPageChange={setJobsPage}
              />
            </Card>

            <Dialog open={showImportsModal} onOpenChange={setShowImportsModal}>
              <DialogContent className="max-w-5xl">
                <DialogHeader>
                  <DialogTitle>Import runs</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Recent import runs (steam)
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => loadImportRuns(true)}
                        disabled={importsLoading}
                      >
                        Refresh
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={clearImportRuns}
                        disabled={importsClearing || importRuns.length === 0}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  {importsLoading ? (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Provider</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Counts</TableHead>
                            <TableHead>When</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Array.from({ length: importsPageSize }).map(
                            (_, i) => (
                              <TableRow key={`s-${i}`}>
                                <TableCell className="font-medium">
                                  <Skeleton className="h-4 w-8" />
                                </TableCell>
                                <TableCell>
                                  <Skeleton className="h-4 w-16" />
                                </TableCell>
                                <TableCell>
                                  <Skeleton className="h-4 w-24" />
                                </TableCell>
                                <TableCell>
                                  <Skeleton className="h-4 w-20" />
                                </TableCell>
                                <TableCell>
                                  <Skeleton className="h-4 w-28" />
                                </TableCell>
                              </TableRow>
                            ),
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  ) : importRuns.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No import runs yet.
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Provider</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Counts</TableHead>
                            <TableHead>When</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importRuns.map((r) => (
                            <TableRow key={r.id}>
                              <TableCell className="font-medium">
                                {r.id}
                              </TableCell>
                              <TableCell>{r.provider}</TableCell>
                              <TableCell
                                title={r.userId ?? "system"}
                                className="max-w-10 truncate"
                              >
                                {r.userId ?? "system"}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {r.itemsOk ?? 0} ok, {r.itemsFail ?? 0} fail (
                                {r.itemsTotal ?? 0})
                              </TableCell>
                              <TableCell>
                                {r.createdAt
                                  ? Number.isNaN(
                                      new Date(r.createdAt).getTime(),
                                    )
                                    ? "ꕀ"
                                    : new Date(r.createdAt).toLocaleString()
                                  : "ꕀ"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  <div className="flex items-center justify-center">
                    <PaginationFooter
                      page={importsPage}
                      totalPages={Math.max(
                        1,
                        Math.ceil(importTotal / importsPageSize),
                      )}
                      onPageChange={setImportsPage}
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog
              open={!!selectedRun}
              onOpenChange={(open: boolean) => {
                if (!open) setSelectedRun(null);
              }}
            >
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Job run details</DialogTitle>
                </DialogHeader>
                {selectedRun && (
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      <strong>Job</strong>: {selectedRun.job}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <strong>Status</strong>: {selectedRun.status}
                    </div>
                    <div className="text-sm">
                      <strong>Started</strong>:{" "}
                      {formatJobDate(selectedRun.startedAt)}
                    </div>
                    <div className="text-sm">
                      <strong>Finished</strong>:{" "}
                      {formatJobDate(selectedRun.finishedAt)}
                    </div>

                    {Array.isArray(selectedRun.result?.perUser) ? (
                      <div>
                        <h4 className="font-medium">Per-user breakdown</h4>
                        <div className="overflow-auto rounded-md border mt-2">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>User ID</TableHead>
                                <TableHead>Added</TableHead>
                                <TableHead>Updated</TableHead>
                                <TableHead>Episodes</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedRun.result.perUser.map((p) => (
                                <TableRow key={p.userId}>
                                  <TableCell className="font-medium">
                                    {p.userId}
                                  </TableCell>
                                  <TableCell>{p.added ?? 0}</TableCell>
                                  <TableCell>{p.updated ?? 0}</TableCell>
                                  <TableCell>{p.episodesAdded ?? 0}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ) : null}

                    <div>
                      <h4 className="font-medium">Raw result</h4>
                      <pre className="max-h-80 overflow-auto bg-muted p-3 rounded-md text-xs whitespace-pre-wrap">
                        {JSON.stringify(selectedRun.result ?? {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-end gap-3 sticky -bottom-2 bg-background/60 backdrop-blur supports-backdrop-filter:bg-background/80 py-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              form.reset();
              setPreservedInput("");
              setPreservedUsernames(initialPreserved);
            }}
            disabled={saving}
          >
            Reset
          </Button>
          <Button
            type="button"
            onClick={() => form.handleSubmit(onSubmit)()}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
