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

import { apiV1Absolute } from "@/lib/api-path";
import { NameConvention, SlugConvention } from "@/lib/upload-conventions";
import { toast } from "sonner";

export type ShareXDestination = "upload" | "shortener";

export const buildShortenerShareXConfig = ({
  key,
  name,
  isPublic,
  maxViews,
  base,
}: {
  key: string;
  name?: string | null;
  isPublic: boolean;
  maxViews: string;
  base: string;
}) => {
  const resolvedName = name?.trim() || "Swush";
  const data: Record<string, string> = {
    originalUrl: "{input}",
    url: "{input}",
    isPublic: isPublic ? "true" : "false",
  };

  if (maxViews.trim()) data.maxClicks = maxViews.trim();

  return {
    Version: "17.0.0",
    Name: `${resolvedName} (Shortener)`,
    DestinationType: "URLShortener, URLSharingService",
    RequestMethod: "POST",
    RequestURL: apiV1Absolute(base, "/shorten"),
    Parameters: {},
    Headers: {
      "x-api-key": key,
    },
    Body: "JSON",
    Data: JSON.stringify(data, null, 2),
    URL: "{json:url}",
    ThumbnailURL: "",
    DeletionURL: "",
    ErrorMessage: "{json:error}{json:message}",
  };
};

export const buildUploadShareXConfig = ({
  key,
  name,
  isPublic,
  folderName,
  nameConvention,
  slugConvention,
  xshareCompat,
  base,
}: {
  key: string;
  name?: string | null;
  isPublic: boolean;
  folderName: string;
  nameConvention: NameConvention;
  slugConvention: SlugConvention;
  xshareCompat: boolean;
  base: string;
}) => {
  const resolvedName = name?.trim() || "Swush";
  const args: Record<string, string> = {
    nameConvention,
    slugConvention,
    isPublic: isPublic ? "true" : "false",
  };
  if (folderName.trim()) args.folderName = folderName.trim();

  return {
    Version: "17.0.0",
    Name: xshareCompat ? `${resolvedName} (Xshare)` : `${resolvedName} Upload`,
    DestinationType: "ImageUploader, TextUploader, FileUploader",
    RequestMethod: "POST",
    RequestURL: apiV1Absolute(base, "/upload"),
    Parameters: {},
    Headers: {
      "x-api-key": key,
    },
    Body: "MultipartFormData",
    Arguments: args,
    FileFormName: "file",
    URL: "{json:url}",
    ThumbnailURL: "",
    DeletionURL: "",
    ErrorMessage: "{json:error}{json:message}",
  };
};

export const handleExportShareX = ({
  key,
  name,
  destination,
  isPublic,
  maxViews,
  folderName,
  nameConvention,
  slugConvention,
  xshareCompat,
  appUrl,
}: {
  key: string;
  name?: string | null;
  destination: ShareXDestination;
  isPublic: boolean;
  maxViews: string;
  folderName: string;
  nameConvention: NameConvention;
  slugConvention: SlugConvention;
  xshareCompat: boolean;
  appUrl?: string | null;
}) => {
  const origin =
    typeof window !== "undefined" ? window.location.origin : appUrl || "";
  const base = origin.replace(/\/+$/, "");
  const resolvedName = name?.trim() || "Swush";
  const safeName = resolvedName.replace(/\s+/g, "_");

  const sxcu =
    destination === "shortener"
      ? buildShortenerShareXConfig({
          key,
          name,
          isPublic,
          maxViews,
          base,
        })
      : buildUploadShareXConfig({
          key,
          name,
          isPublic,
          folderName,
          nameConvention,
          slugConvention,
          xshareCompat,
          base,
        });

  const blob = new Blob([JSON.stringify(sxcu, null, 2)], {
    type: "application/json",
  });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = `${safeName}-${destination}.sxcu`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
  toast.success("ShareX config exported");
};

export const handleExportIShare = ({
  key,
  name,
  destination,
  isPublic,
  folderName,
  nameConvention,
  slugConvention,
  appUrl,
}: {
  key: string;
  name?: string | null;
  destination: ShareXDestination;
  isPublic: boolean;
  folderName: string;
  nameConvention: NameConvention;
  slugConvention: SlugConvention;
  appUrl?: string | null;
}) => {
  if (destination !== "upload") {
    toast.error("iShare config supports uploads only.");
    return;
  }

  const origin =
    typeof window !== "undefined" ? window.location.origin : appUrl || "";
  const base = origin.replace(/\/+$/, "");
  const resolvedName = name?.trim() || "Swush";
  const safeName = resolvedName.replace(/\s+/g, "_");

  const formData: Record<string, string> = {
    nameConvention,
    slugConvention,
    isPublic: isPublic ? "true" : "false",
  };
  if (folderName.trim()) {
    formData.folderName = folderName.trim();
  }

  const iscu = {
    name: `${resolvedName} Upload`,
    requestURL: apiV1Absolute(base, "/upload"),
    headers: {
      "x-api-key": key,
    },
    formData,
    fileFormName: "file",
    requestBodyType: "multipartFormData",
    responseURL: "{json:url}",
    deletionURL: apiV1Absolute(base, "/files/{json:slug}"),
    deleteRequestType: "DELETE",
  };

  const blob = new Blob([JSON.stringify(iscu, null, 2)], {
    type: "application/json",
  });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = `${safeName}-upload.iscu`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
  toast.success("iShare config exported");
};
