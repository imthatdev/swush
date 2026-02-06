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

type DocEntry = {
  key: string;
  title?: string;
  hint?: string;
  md?: string;
};

const registry: Record<string, DocEntry> = {
  "uploads.maxSize": {
    key: "uploads.maxSize",
    title: "Max File Size",
    hint: "The largest single file size allowed for uploads.",
    md: [
      "### Max File Size",
      "",
      "- **What it is**: The maximum size (per file) users can upload.",
      "- **Units**: Specify in MB or GB. e.g., `512MB`, `2GB`.",
      "- **Advice**: If you use reverse proxies (Cloudflare, nginx) or S3, ensure *all* layers allow at least this size.",
      "",
      "**Example**:",
      "```",
      "Max File Size: 512MB",
      "Nginx client_max_body_size: 512m",
      "S3 PutObject limit: >= 512MB",
      "```",
    ].join("\n"),
  },
  "uploads.dailyQuota": {
    key: "uploads.dailyQuota",
    title: "Daily Upload Quota",
    hint: "Total bytes a user can upload in 24h.",
    md: [
      "### Daily Upload Quota",
      "",
      "- **What it is**: The total bytes a user can upload per 24-hour rolling window.",
      "- **Reset**: Rolling, not midnight-based, unless you changed it.",
      "- **Tip**: Show users their remaining quota to reduce support pings.",
    ].join("\n"),
  },
  "security.twoFactor": {
    key: "security.twoFactor",
    title: "Two-Factor Authentication",
    hint: "Require TOTP for admin actions.",
    md: [
      "### Two-Factor Authentication",
      "",
      "- **What**: Enforces TOTP for admins when performing sensitive actions (deleting users, changing global settings).",
      "- **Why**: Prevents compromised sessions from wrecking your instance.",
      "- **Note**: Pair with IP allowlisting for extra safety.",
    ].join("\n"),
  },
  "sharing.publicLinks": {
    key: "sharing.publicLinks",
    title: "Public Links",
    hint: "Allow files to be shared via public URL.",
    md: [
      "### Public Links",
      "",
      "- **If enabled**: Users can generate public, unauthenticated links.",
      "- **Expiration**: Set default expiry to reduce stale links.",
      "- **Revocation**: Admins can revoke links globally; users can revoke per file.",
    ].join("\n"),
  },
};

export function getDocSnippet(key: string): DocEntry | undefined {
  return registry[key];
}
