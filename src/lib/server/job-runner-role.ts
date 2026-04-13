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

import "server-only";

export type JobRunnerRole = "all" | "api" | "worker";

function normalizeRole(value: string | undefined): JobRunnerRole {
  const normalized = (value || "all").trim().toLowerCase();
  if (normalized === "api") return "api";
  if (normalized === "worker") return "worker";
  return "all";
}

const jobRunnerRole = normalizeRole(process.env.JOB_RUNNER_ROLE);

export function getJobRunnerRole(): JobRunnerRole {
  return jobRunnerRole;
}

export function isJobExecutionEnabled() {
  return jobRunnerRole !== "api";
}

export function isWorkerOnlyRole() {
  return jobRunnerRole === "worker";
}

export function isApiOnlyRole() {
  return jobRunnerRole === "api";
}
