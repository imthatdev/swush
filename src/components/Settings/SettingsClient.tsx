/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
 *   All rights reserved.

 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file in compliance with the License.
 *   You may obtain a copy of the License at

 *   http://www.apache.org/licenses/LICENSE-2.0

 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

"use client";

import { ApiTokens } from "@/components/Settings/ApiTokens";
import { Integrations } from "@/components/Settings/Integrations";
import PageLayout from "../Common/PageLayout";
import InformationChange from "./InformationChange";
import PasswordChange from "./PasswordChange";
import SocialAccountsManager from "./SocialAccountsManager";
import SessionsSection from "./SessionsSection";
import Imports from "./Imports";
import EmbedSettings from "./EmbedSettings";
import ExportData from "./ExportData";
import DeleteAccount from "./DeleteAccount";
import PwaSettings from "./PwaSettings";
import UploadSettings from "./UploadSettings";
import PreferencesSettings from "./PreferencesSettings";
import FeaturesSettings from "./FeaturesSettings";
import React from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  IconUser,
  IconLock,
  IconBrandGithub,
  IconUpload,
  IconSettings,
  IconDatabaseExport,
  IconKey,
  IconDeviceFloppy,
  IconDeviceMobile,
  IconTrash,
  IconLink,
  IconCloud,
  IconSparkles,
  IconPlug,
} from "@tabler/icons-react";

export default function SettingsClient() {
  const sections = [
    {
      name: "Information",
      icon: <IconUser size={18} className="mr-1.5" />,
      value: "information",
      element: <InformationChange key="information-change" />,
    },
    {
      name: "Security",
      icon: <IconLock size={18} className="mr-1.5" />,
      value: "password",
      element: <PasswordChange key="password-change" />,
    },
    {
      name: "Social Accounts",
      icon: <IconBrandGithub size={18} className="mr-1.5" />,
      value: "social",
      element: <SocialAccountsManager key="social-accounts" />,
    },
    {
      name: "Imports",
      icon: <IconDeviceFloppy size={18} className="mr-1.5" />,
      value: "imports",
      element: <Imports key="imports" />,
    },
    {
      name: "Embed",
      icon: <IconLink size={18} className="mr-1.5" />,
      value: "embed",
      element: <EmbedSettings key="embed-settings" />,
    },
    {
      name: "Upload",
      icon: <IconUpload size={18} className="mr-1.5" />,
      value: "upload",
      element: <UploadSettings key="upload-settings" />,
    },
    {
      name: "Features",
      icon: <IconSparkles size={18} className="mr-1.5" />,
      value: "features",
      element: <FeaturesSettings key="features-settings" />,
    },
    {
      name: "Preferences",
      icon: <IconSettings size={18} className="mr-1.5" />,
      value: "preferences",
      element: <PreferencesSettings key="preferences" />,
    },
    {
      name: "Export Data",
      icon: <IconDatabaseExport size={18} className="mr-1.5" />,
      value: "export",
      element: <ExportData key="export-data" />,
    },
    {
      name: "API Tokens",
      icon: <IconKey size={18} className="mr-1.5" />,
      value: "api",
      element: <ApiTokens key="api-tokens" />,
    },
    {
      name: "Integrations",
      icon: <IconPlug size={18} className="mr-1.5" />,
      value: "integrations",
      element: <Integrations key="integrations" />,
    },
    {
      name: "Sessions",
      icon: <IconCloud size={18} className="mr-1.5" />,
      value: "sessions",
      element: <SessionsSection key="sessions" />,
    },
    {
      name: "PWA",
      icon: <IconDeviceMobile size={18} className="mr-1.5" />,
      value: "pwa",
      element: <PwaSettings key="pwa" />,
    },
    {
      name: "Delete Account",
      icon: <IconTrash size={18} className="mr-1.5 text-red-500" />,
      value: "delete",
      element: <DeleteAccount key="delete-account" />,
    },
  ];

  const [active, setActive] = React.useState(sections[0].value);
  return (
    <PageLayout
      title="Account Settings"
      subtitle="Manage your personal details and security preferences."
      toolbar={
        <Select value={active} onValueChange={setActive}>
          <SelectTrigger className="w-65">
            <SelectValue placeholder="Select section" />
          </SelectTrigger>
          <SelectContent>
            {sections.map((section, idx) => (
              <SelectItem key={idx} value={section.value}>
                <span className="flex items-center">
                  {section.icon}
                  {section.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <div className="mt-2">
        {sections.map((section, idx) =>
          active === section.value ? (
            <div key={idx}>{section.element}</div>
          ) : null,
        )}
      </div>
    </PageLayout>
  );
}
