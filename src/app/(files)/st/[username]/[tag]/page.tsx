/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
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
import SharedShortlinksTagClient from "@/components/Shortener/SharedShortlinksTagClient";
import { getDefaultMetadata } from "@/lib/head";
import { getPublicRuntimeSettings } from "@/lib/server/runtime-settings";
import type { Metadata } from "next";

type Params = Promise<{ username: string; tag: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { username, tag } = await params;
  const { appName } = await getPublicRuntimeSettings();
  const decodedTag = decodeURIComponent(tag);
  const defaultMetadata = await getDefaultMetadata();

  const title = `${decodeURIComponent(username)}’s ${decodedTag} shortlinks`;
  const description = `Public shortlinks tagged "${decodedTag}" on ${appName}.`;

  return {
    ...defaultMetadata,
    title,
    description,
    openGraph: {
      ...defaultMetadata.openGraph,
      title,
      description,
      siteName: `${decodeURIComponent(username)} on ${appName}`,
    },
  };
}

export default async function PublicShortlinksByTagPage({
  params,
}: {
  params: Params;
}) {
  const { username, tag } = await params;

  return (
    <ExternalLayout>
      <SharedShortlinksTagClient
        username={decodeURIComponent(username)}
        tag={decodeURIComponent(tag)}
      />
    </ExternalLayout>
  );
}
