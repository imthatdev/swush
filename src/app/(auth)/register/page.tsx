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

import RegisterClient from "@/components/Auth/RegisterClient";
import { getDefaultMetadata } from "@/lib/head";
import { getSetupStatus } from "@/lib/server/setup";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import React from "react";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const defaultMetadata = await getDefaultMetadata();
  return {
    ...defaultMetadata,
    title: "Register",
  };
}

export default async function RegisterServer() {
  const setup = await getSetupStatus();
  if (setup.needsSetup) {
    redirect("/setup");
  }
  return <RegisterClient />;
}
