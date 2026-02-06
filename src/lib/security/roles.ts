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

import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../client/user";

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isAdmin = user.role === "admin" || user.role === "owner";

  if (!isAdmin) redirect("/vault");

  return user;
}

export async function requireOwner() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isOwner = user.role === "owner";

  if (!isOwner) redirect("/vault");

  return user;
}
