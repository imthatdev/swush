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

"use client";
import {  IconPlus, IconSparkles } from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CreateUserForm = {
  email: string;
  username: string;
  password: string;
  role: "admin" | "user" | undefined;
};

export function CreateUserDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  onCreate,
  onGeneratePassword,
  creating,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: CreateUserForm;
  onFormChange: (form: CreateUserForm) => void;
  onCreate: () => void;
  onGeneratePassword: () => void;
  creating?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="default" className="gap-2">
          <IconPlus className="h-4 w-4" /> Create user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new user</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div>
            <label htmlFor="create-user-email" className="text-xs text-muted-foreground">
              Email
            </label>
            <Input
              id="create-user-email"
              type="email"
              value={form.email}
              onChange={(e) => onFormChange({ ...form, email: e.target.value })}
              placeholder="name@example.com"
              disabled={creating}
            />
          </div>

          <div>
            <label htmlFor="create-user-username" className="text-xs text-muted-foreground">
              Username
            </label>
            <Input
              id="create-user-username"
              value={form.username}
              onChange={(e) =>
                onFormChange({ ...form, username: e.target.value })
              }
              placeholder="username"
              disabled={creating}
            />
          </div>

          <div>
            <label htmlFor="create-user-password" className="text-xs text-muted-foreground">
              Password
            </label>
            <div className="flex gap-1">
              <Input
                id="create-user-password"
                type="password"
                value={form.password}
                onChange={(e) =>
                  onFormChange({ ...form, password: e.target.value })
                }
                placeholder="temporary password"
                disabled={creating}
              />
              <Button
                type="button"
                variant="secondary"
                className="gap-1"
                onClick={onGeneratePassword}
                disabled={creating}
              >
                <IconSparkles className="h-4 w-4" /> Generate
              </Button>
            </div>
          </div>

          <div>
            <label htmlFor="create-user-role" className="text-xs text-muted-foreground">
              Role
            </label>
            <Select
              value={form.role}
              onValueChange={(val) =>
                onFormChange({
                  ...form,
                  role: val as "admin" | "user",
                })
              }
              disabled={creating}
            >
              <SelectTrigger id="create-user-role" className="h-8 w-40">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">user</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={onCreate} disabled={creating}>
            {creating ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
