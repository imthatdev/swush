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

import { db } from "@/db/client";
import { files } from "@/db/schemas";
import { and, eq, gt } from "drizzle-orm";
import { deleteFileFromStorage, type StorageDriver } from "@/lib/storage";
import { sendDeleteAccountVerificationEmail } from "@/lib/email";
import { APIError } from "better-auth";

export async function sendDeleteAccountVerification(params: {
  user: { email: string };
  url: string;
}) {
  void sendDeleteAccountVerificationEmail(params.user.email, params.url);
}

export async function deleteUserFilesFromStorage(userId: string) {
  const batchSize = 200;
  let lastId: string | undefined;

  while (true) {
    const rows = await db
      .select({
        id: files.id,
        userId: files.userId,
        storedName: files.storedName,
        storageDriver: files.storageDriver,
      })
      .from(files)
      .where(
        lastId
          ? and(eq(files.userId, userId), gt(files.id, lastId))
          : eq(files.userId, userId),
      )
      .orderBy(files.id)
      .limit(batchSize);

    if (rows.length === 0) break;

    for (const row of rows) {
      try {
        await deleteFileFromStorage(
          {
            userId: row.userId,
            storedName: row.storedName,
          },
          {
            driver: row.storageDriver as StorageDriver,
          },
        );
      } catch (error) {
        throw new APIError("NOT_MODIFIED", {
          cause: error,
        });
      }
      lastId = row.id;
    }
  }
}

export async function beforeDeleteUser(user: { id: string }) {
  await deleteUserFilesFromStorage(user.id);
}
