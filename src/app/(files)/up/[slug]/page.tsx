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

import ExternalLayout from "@/components/Common/ExternalLayout";
import UploadRequestClient from "@/components/UploadRequests/UploadRequestClient";
import { apiV1Absolute } from "@/lib/api-path";
import { getPublicRuntimeSettings } from "@/lib/server/runtime-settings";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Params = Promise<{ slug: string }>;

async function getData(slug: string) {
  const { appUrl } = await getPublicRuntimeSettings();
  const res = await fetch(
    apiV1Absolute(appUrl, `/upload-requests/p/${encodeURIComponent(slug)}`),
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const { appName } = await getPublicRuntimeSettings();
  return {
    title: `Upload Request · ${slug}`,
    description: `Upload files to ${appName}.`,
  };
}

export default async function UploadRequestPage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const data = await getData(slug);
  if (!data) return notFound();

  return (
    <ExternalLayout>
      <UploadRequestClient slug={slug} data={data} />
    </ExternalLayout>
  );
}
