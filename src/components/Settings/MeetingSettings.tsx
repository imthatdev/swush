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

"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { apiV1 } from "@/lib/api-path";
import CopyButton from "@/components/Common/CopyButton";
import { useUser } from "@/hooks/use-user";
import { IconCopy, IconHelpCircle, IconTrash } from "@tabler/icons-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type MeetingDay = {
  day: number;
  enabled: boolean;
  start: string;
  end: string;
};

type MeetingSettingsForm = {
  isEnabled: boolean;
  timezone: string;
  availability: { days: MeetingDay[] };
  defaultDurationMinutes: number;
  bufferMinutes: number;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  acceptanceMode: "manual" | "auto" | "auto_paid";
  paymentRequired: boolean;
  paypalLink: string;
  paypalMinAmount: number;
  paypalMerchantId: string;
  meetingLocation: string;
  reminders: number[];
};

type MeetingContact = {
  id: string;
  name: string;
  email: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DEFAULT_FORM: MeetingSettingsForm = {
  isEnabled: false,
  timezone: "UTC",
  availability: {
    days: [
      { day: 0, enabled: false, start: "09:00", end: "17:00" },
      { day: 1, enabled: true, start: "09:00", end: "17:00" },
      { day: 2, enabled: true, start: "09:00", end: "17:00" },
      { day: 3, enabled: true, start: "09:00", end: "17:00" },
      { day: 4, enabled: true, start: "09:00", end: "17:00" },
      { day: 5, enabled: true, start: "09:00", end: "17:00" },
      { day: 6, enabled: false, start: "09:00", end: "17:00" },
    ],
  },
  defaultDurationMinutes: 30,
  bufferMinutes: 0,
  minNoticeMinutes: 60,
  maxAdvanceDays: 60,
  acceptanceMode: "manual",
  paymentRequired: false,
  paypalLink: "",
  paypalMinAmount: 0,
  paypalMerchantId: "",
  meetingLocation: "",
  reminders: [30],
};

const REMINDER_OPTIONS = [15, 30, 60];

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Help"
            className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            <IconHelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-snug">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function MeetingSettings() {
  const { user } = useUser();
  const [form, setForm] = useState<MeetingSettingsForm>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEnable, setCanEnable] = useState(true);
  const [contacts, setContacts] = useState<MeetingContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactForm, setContactForm] = useState({ name: "", email: "" });

  const bookingUrl = useMemo(() => {
    if (!user?.username) return "";
    return `${typeof window !== "undefined" ? window.location.origin : ""}/meet/${user.username}`;
  }, [user?.username]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(apiV1("/profile/meeting-settings"), {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load meeting settings");
        const data = (await res.json()) as {
          settings?: Partial<MeetingSettingsForm>;
          canEnable?: boolean;
        };
        if (!active) return;
        const next = {
          ...DEFAULT_FORM,
          ...(data?.settings ?? {}),
        } as MeetingSettingsForm;
        next.availability =
          data?.settings?.availability ?? DEFAULT_FORM.availability;
        next.reminders =
          Array.isArray(data?.settings?.reminders) &&
          data.settings.reminders.length > 0
            ? (data.settings.reminders as number[])
            : DEFAULT_FORM.reminders;
        if (data?.canEnable === false) {
          next.isEnabled = false;
          setCanEnable(false);
        } else {
          setCanEnable(true);
        }
        setForm(next);
      } catch (err) {
        if (!active) return;
        toast.error("Could not load meeting settings", {
          description: (err as Error).message,
        });
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadContacts = async () => {
      setContactsLoading(true);
      try {
        const res = await fetch(apiV1("/meetings/contacts"), {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load contacts");
        const data = (await res.json()) as { data?: MeetingContact[] };
        if (!active) return;
        setContacts(data?.data ?? []);
      } catch (err) {
        if (!active) return;
        toast.error("Could not load meeting contacts", {
          description: (err as Error).message,
        });
      } finally {
        if (active) setContactsLoading(false);
      }
    };
    void loadContacts();
    return () => {
      active = false;
    };
  }, []);

  const updateDay = (index: number, patch: Partial<MeetingDay>) => {
    setForm((prev) => {
      const days = prev.availability.days.map((day, idx) =>
        idx === index ? { ...day, ...patch } : day,
      );
      return { ...prev, availability: { days } };
    });
  };

  const toggleReminder = (value: number) => {
    setForm((prev) => {
      const exists = prev.reminders.includes(value);
      const next = exists
        ? prev.reminders.filter((reminder) => reminder !== value)
        : [...prev.reminders, value];
      return { ...prev, reminders: next.sort((a, b) => a - b) };
    });
  };

  const save = async (next: MeetingSettingsForm) => {
    setSaving(true);
    try {
      const res = await fetch(apiV1("/profile/meeting-settings"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || body?.message || "Save failed");
      }
      toast.success("Meeting settings saved");
      setForm(next);
    } catch (err) {
      toast.error("Failed to save meeting settings", {
        description: (err as Error).message,
      });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiV1("/profile/meeting-settings"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || body?.message || "Reset failed");
      }
      toast.success("Meeting settings reset");
      setForm({ ...DEFAULT_FORM });
    } catch (err) {
      toast.error("Failed to reset meeting settings", {
        description: (err as Error).message,
      });
    } finally {
      setSaving(false);
    }
  };

  const addContact = async () => {
    if (!contactForm.name.trim() || !contactForm.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    try {
      const res = await fetch(apiV1("/meetings/contacts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactForm.name.trim(),
          email: contactForm.email.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.error || body?.message || "Failed to add contact",
        );
      }
      const data = (await res.json()) as { data?: MeetingContact };
      if (data?.data) {
        if (data?.data) {
          setContacts((prev: MeetingContact[]) => {
            const next = prev.filter((item) => item.id !== data.data!.id);
            return [...next, data.data!].sort((a, b) =>
              a.name.localeCompare(b.name),
            );
          });
        }
      }
      setContactForm({ name: "", email: "" });
      toast.success("Contact saved");
    } catch (err) {
      toast.error("Failed to add contact", {
        description: (err as Error).message,
      });
    }
  };

  const removeContact = async (id: string) => {
    try {
      const res = await fetch(apiV1(`/meetings/contacts/${id}`), {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || body?.message || "Failed to delete");
      }
      setContacts((prev) => prev.filter((item) => item.id !== id));
      toast.success("Contact removed");
    } catch (err) {
      toast.error("Failed to delete contact", {
        description: (err as Error).message,
      });
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-md border px-4 py-4 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Enable bookings</div>
            <div className="text-xs text-muted-foreground">
              Allow guests to book a meeting with you.
            </div>
          </div>
          <Switch
            checked={form.isEnabled}
            onCheckedChange={(checked) =>
              setForm((prev) => ({ ...prev, isEnabled: checked }))
            }
            disabled={loading || saving || !canEnable}
          />
        </div>
        {!canEnable ? (
          <div className="text-xs text-muted-foreground">
            Meetings are disabled for your account by an admin.
          </div>
        ) : null}

        {user?.username ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
            <div className="text-xs text-muted-foreground">Booking link</div>
            <div className="text-xs font-medium text-foreground break-all">
              /meet/{user.username}
            </div>
            <CopyButton
              size="sm"
              variant="ghost"
              text={bookingUrl}
              disabled={!bookingUrl}
            >
              <IconCopy className="h-4 w-4" />
            </CopyButton>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Timezone</Label>
          <Input
            value={form.timezone}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, timezone: e.target.value }))
            }
            placeholder="UTC or America/New_York"
            disabled={loading || saving}
          />
          <p className="text-xs text-muted-foreground">
            Bookings are validated against your timezone.
          </p>
        </div>

        <div className="grid gap-2">
          <Label>Meeting duration (minutes)</Label>
          <Input
            type="number"
            min={10}
            max={240}
            value={form.defaultDurationMinutes}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                defaultDurationMinutes: Number(e.target.value || 0),
              }))
            }
            disabled={loading || saving}
          />
        </div>

        <div className="grid gap-2">
          <Label>Buffer between meetings (minutes)</Label>
          <Input
            type="number"
            min={0}
            max={120}
            value={form.bufferMinutes}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                bufferMinutes: Number(e.target.value || 0),
              }))
            }
            disabled={loading || saving}
          />
        </div>

        <div className="grid gap-2">
          <Label>Minimum notice (minutes)</Label>
          <Input
            type="number"
            min={0}
            max={1440}
            value={form.minNoticeMinutes}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                minNoticeMinutes: Number(e.target.value || 0),
              }))
            }
            disabled={loading || saving}
          />
        </div>

        <div className="grid gap-2">
          <Label>Max advance (days)</Label>
          <Input
            type="number"
            min={1}
            max={365}
            value={form.maxAdvanceDays}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                maxAdvanceDays: Number(e.target.value || 0),
              }))
            }
            disabled={loading || saving}
          />
        </div>

        <div className="grid gap-2">
          <Label>Acceptance mode</Label>
          <Select
            value={form.acceptanceMode}
            onValueChange={(value) =>
              setForm((prev) => ({
                ...prev,
                acceptanceMode: value as MeetingSettingsForm["acceptanceMode"],
              }))
            }
          >
            <SelectTrigger disabled={loading || saving}>
              <SelectValue placeholder="Choose mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual approval</SelectItem>
              <SelectItem value="auto">Auto-accept</SelectItem>
              <SelectItem value="auto_paid">Auto-accept when paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border px-4 py-4 space-y-3">
        <div className="text-sm font-medium">Weekly availability</div>
        <div className="grid gap-3">
          {form.availability.days.map((day, idx) => (
            <div
              key={day.day}
              className="grid grid-cols-[64px_1fr_1fr_auto] items-center gap-3"
            >
              <div className="text-xs font-medium">{WEEKDAYS[day.day]}</div>
              <Input
                type="time"
                value={day.start}
                onChange={(e) => updateDay(idx, { start: e.target.value })}
                disabled={loading || saving || !day.enabled}
              />
              <Input
                type="time"
                value={day.end}
                onChange={(e) => updateDay(idx, { end: e.target.value })}
                disabled={loading || saving || !day.enabled}
              />
              <Switch
                checked={day.enabled}
                onCheckedChange={(checked) =>
                  updateDay(idx, { enabled: checked })
                }
                disabled={loading || saving}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border px-4 py-4 space-y-4">
        <div className="grid gap-2">
          <Label>Meeting location</Label>
          <Input
            value={form.meetingLocation}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, meetingLocation: e.target.value }))
            }
            placeholder="Google Meet, Zoom, or custom URL"
            disabled={loading || saving}
          />
        </div>

        <div className="grid gap-2">
          <Label>Reminders</Label>
          <div className="flex flex-wrap gap-3">
            {REMINDER_OPTIONS.map((option) => (
              <label
                key={option}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <Checkbox
                  checked={form.reminders.includes(option)}
                  onCheckedChange={() => toggleReminder(option)}
                />
                {option} min
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <Label className="inline-flex items-center">
            Payment required
            <HelpTip text="Requires guests to pay before the booking is auto-accepted. Provide a PayPal link below. Guests should include the booking reference in the PayPal note so you can verify payment." />
          </Label>
          <div className="flex items-center justify-between gap-4">
            <div className="text-xs text-muted-foreground">
              Require PayPal payment before auto-accepting.
            </div>
            <Switch
              checked={form.paymentRequired}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, paymentRequired: checked }))
              }
              disabled={loading || saving}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label className="inline-flex items-center">
            PayPal link
            <HelpTip text="Paste a PayPal.me link or a PayPal checkout link. If payment is required, guests will be sent here to pay and must include the booking reference in the PayPal note." />
          </Label>
          <Input
            value={form.paypalLink}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, paypalLink: e.target.value }))
            }
            placeholder="https://www.paypal.me/yourname"
            disabled={loading || saving}
          />
        </div>

        <div className="grid gap-2">
          <Label className="inline-flex items-center">
            Minimum PayPal amount
            <HelpTip text="Set a minimum payment amount for booking requests. Use 0 to allow any amount." />
          </Label>
          <Input
            type="number"
            min={0}
            max={100000}
            step={0.01}
            value={form.paypalMinAmount}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                paypalMinAmount: Number(e.target.value || 0),
              }))
            }
            disabled={loading || saving}
          />
        </div>

        <div className="grid gap-2">
          <Label className="inline-flex items-center">
            PayPal merchant ID
            <HelpTip text="Used to verify that payments were sent to your PayPal account. You can find this in your PayPal profile or business settings." />
          </Label>
          <Input
            value={form.paypalMerchantId}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                paypalMerchantId: e.target.value,
              }))
            }
            placeholder="Your PayPal merchant ID"
            disabled={loading || saving}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => save(form)} disabled={loading || saving}>
          {saving ? "Saving..." : "Save settings"}
        </Button>
        <Button variant="outline" onClick={reset} disabled={loading || saving}>
          Reset to default
        </Button>
      </div>

      <div className="rounded-md border px-4 py-4 space-y-4">
        <div>
          <div className="text-sm font-medium">Meeting contacts</div>
          <div className="text-xs text-muted-foreground">
            Save attendee contacts for quick autocomplete.
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Input
            placeholder="Name"
            value={contactForm.name}
            onChange={(e) =>
              setContactForm((prev) => ({ ...prev, name: e.target.value }))
            }
          />
          <Input
            placeholder="Email"
            value={contactForm.email}
            onChange={(e) =>
              setContactForm((prev) => ({ ...prev, email: e.target.value }))
            }
          />
          <Button onClick={addContact}>Add</Button>
        </div>
        {contactsLoading ? (
          <div className="text-xs text-muted-foreground">
            Loading contacts...
          </div>
        ) : contacts.length ? (
          <div className="space-y-2">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2"
              >
                <div className="text-xs">
                  <div className="font-medium text-foreground">
                    {contact.name}
                  </div>
                  <div className="text-muted-foreground">{contact.email}</div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeContact(contact.id)}
                >
                  <IconTrash className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No contacts yet.</div>
        )}
      </div>
    </section>
  );
}
