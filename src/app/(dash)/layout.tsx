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

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/client/user";
import { SidebarWrapper } from "@/components/Dashboard/Sidebar";
import { getDefaultMetadata } from "@/lib/head";
import { Metadata } from "next";
import { PlayerProvider } from "@/components/Vault/Player/PlayerProvider";
import SponsorBanner from "@/components/Common/SponsorBanner";

export async function generateMetadata(): Promise<Metadata> {
  const defaultMetadata = await getDefaultMetadata();
  return {
    ...defaultMetadata,
    title: "Dashboard",
  };
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <PlayerProvider>
      <SidebarWrapper>
        <div className="flex-1 flex bg-secondary h-full min-h-0">
          <div className="flex w-full flex-1 flex-col gap-2 rounded-tl-2xl bg-background p-2 md:p-6 min-h-0">
            <div className="overflow-y-auto flex-1 rounded-lg min-h-0">
              <SponsorBanner />
              {children}
            </div>
          </div>
        </div>
      </SidebarWrapper>
    </PlayerProvider>
  );
}
