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

import React from "react";
import { requireAdmin } from "@/lib/security/roles";
import { getServerSettings } from "@/lib/settings";
import AdminSettingsClient from "@/components/Admin/AdminSettingsClient";
import { getDefaultMetadata } from "@/lib/head";
import { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const defaultMetadata = await getDefaultMetadata();
  return {
    ...defaultMetadata,
    title: "Server Settings",
  };
}

export default async function AdminSettingsServer() {
  await requireAdmin();
  const settings = await getServerSettings();
  return <AdminSettingsClient initialValues={settings} />;
}
