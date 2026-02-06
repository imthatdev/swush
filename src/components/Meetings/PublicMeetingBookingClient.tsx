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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { apiV1 } from "@/lib/api-path";
import { toast } from "sonner";

type MeetingAvailabilityDay = {
  day: number;
  enabled: boolean;
  start: string;
  end: string;
};

type MeetingSettings = {
  isEnabled: boolean;
  timezone: string;
  availability: { days: MeetingAvailabilityDay[] };
  defaultDurationMinutes: number;
  bufferMinutes: number;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  acceptanceMode: "manual" | "auto" | "auto_paid";
  paymentRequired: boolean;
  paypalLink?: string | null;
  paypalMinAmount?: number;
  meetingLocation?: string | null;
  reminders?: number[];
};

type HostInfo = {
  username: string;
  displayName: string;
};

type ExtraAttendee = {
  name: string;
  email: string;
};

type MeetingContact = {
  id: string;
  name: string;
  email: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function getDayIndexInTimezone(date: Date, timezone: string) {
  let dayLabel = "Sun";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
    }).formatToParts(date);
    dayLabel = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  } catch {
    dayLabel = WEEKDAYS[date.getDay()] ?? "Sun";
  }
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return dayMap[dayLabel] ?? 0;
}

function parseTimeToMinutes(value: string) {
  const [hh, mm] = value.split(":").map(Number);
  return hh * 60 + (mm || 0);
}

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

function makeDateInTimeZone(date: Date, time: string, timezone: string) {
  const [hour, minute] = time.split(":").map((val) => Number(val));
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const utcGuess = new Date(Date.UTC(year, month, day, hour, minute || 0));
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(utcGuess);
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const asUtc = new Date(
      Date.UTC(
        Number(map.year),
        Number(map.month) - 1,
        Number(map.day),
        Number(map.hour),
        Number(map.minute),
      ),
    );
    const offset = asUtc.getTime() - utcGuess.getTime();
    return new Date(utcGuess.getTime() - offset);
  } catch {
    return new Date(Date.UTC(year, month, day, hour, minute || 0));
  }
}

export default function PublicMeetingBookingClient({
  host,
  settings,
}: {
  host: HostInfo;
  settings: MeetingSettings;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    startsAt: "",
    guestName: "",
    guestEmail: "",
    guestNotes: "",
    guestTimezone:
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
        : "UTC",
    paymentReference: "",
  });
  const [extraAttendees, setExtraAttendees] = useState<ExtraAttendee[]>([]);
  const [result, setResult] = useState<{ status: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [busySlots, setBusySlots] = useState<
    Array<{ startsAt: string; endsAt: string }>
  >([]);
  const [contacts, setContacts] = useState<MeetingContact[]>([]);

  const contactMap = useMemo(() => {
    return new Map(
      contacts.map((contact) => [contact.email.toLowerCase(), contact]),
    );
  }, [contacts]);

  const availabilityLabel = useMemo(() => {
    const enabled = settings.availability.days.filter((day) => day.enabled);
    if (!enabled.length) return "No availability configured";

    const groups: Array<{
      startDay: number;
      endDay: number;
      start: string;
      end: string;
    }> = [];

    const sorted = [...enabled].sort((a, b) => a.day - b.day);
    for (const day of sorted) {
      const last = groups[groups.length - 1];
      if (
        last &&
        last.endDay + 1 === day.day &&
        last.start === day.start &&
        last.end === day.end
      ) {
        last.endDay = day.day;
      } else {
        groups.push({
          startDay: day.day,
          endDay: day.day,
          start: day.start,
          end: day.end,
        });
      }
    }

    return groups
      .map((group) => {
        const label =
          group.startDay === group.endDay
            ? WEEKDAYS_FULL[group.startDay]
            : `${WEEKDAYS_FULL[group.startDay]}–${WEEKDAYS_FULL[group.endDay]}`;
        return `${label} · ${group.start}-${group.end}`;
      })
      .join(" • ");
  }, [settings.availability.days]);

  const minDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getTime() + settings.minNoticeMinutes * 60_000);
  }, [settings.minNoticeMinutes]);

  const maxDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getTime() + settings.maxAdvanceDays * 24 * 60 * 60_000);
  }, [settings.maxAdvanceDays]);

  const slots = useMemo(() => {
    if (!selectedDate) return [];
    const weekday = getDayIndexInTimezone(selectedDate, settings.timezone);
    const dayConfig = settings.availability.days.find(
      (day) => day.day === weekday && day.enabled,
    );
    if (!dayConfig) return [];
    const startMinutes = parseTimeToMinutes(dayConfig.start);
    const endMinutes = parseTimeToMinutes(dayConfig.end);
    const duration = settings.defaultDurationMinutes;
    const resultSlots: { time: string; startsAt: Date }[] = [];
    for (
      let minutes = startMinutes;
      minutes + duration <= endMinutes;
      minutes += duration
    ) {
      const time = minutesToTime(minutes);
      const startsAt = makeDateInTimeZone(
        selectedDate,
        time,
        settings.timezone,
      );
      if (startsAt < minDate || startsAt > maxDate) continue;
      resultSlots.push({ time, startsAt });
    }
    return resultSlots;
  }, [
    selectedDate,
    settings.availability.days,
    settings.defaultDurationMinutes,
    settings.timezone,
    minDate,
    maxDate,
  ]);

  const overlapsBusySlot = (slotStart: Date, durationMinutes: number) => {
    if (!busySlots.length) return false;
    const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
    return busySlots.some((busy) => {
      const busyStart = new Date(busy.startsAt);
      const busyEnd = new Date(busy.endsAt);
      return slotStart < busyEnd && slotEnd > busyStart;
    });
  };

  useEffect(() => {
    let active = true;
    const loadContacts = async () => {
      try {
        const res = await fetch(apiV1("/meetings/contacts"), {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { data?: MeetingContact[] };
        if (!active) return;
        setContacts(data?.data ?? []);
      } catch {
        if (!active) return;
        setContacts([]);
      }
    };
    void loadContacts();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadBusy = async () => {
      if (!selectedDate) {
        setBusySlots([]);
        return;
      }
      const from = makeDateInTimeZone(selectedDate, "00:00", settings.timezone);
      const to = makeDateInTimeZone(selectedDate, "23:59", settings.timezone);
      try {
        const res = await fetch(
          apiV1(
            `/meetings/availability?username=${encodeURIComponent(
              host.username,
            )}&from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(
              new Date(to.getTime() + 60_000).toISOString(),
            )}`,
          ),
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error("Failed to load availability");
        const data = (await res.json()) as {
          data?: Array<{ startsAt: string; endsAt: string }>;
        };
        if (!active) return;
        setBusySlots(data?.data ?? []);
      } catch {
        if (!active) return;
        setBusySlots([]);
      }
    };
    void loadBusy();
    return () => {
      active = false;
    };
  }, [host.username, selectedDate, settings.timezone]);

  const addAttendee = () => {
    setExtraAttendees((prev) => [...prev, { name: "", email: "" }]);
  };

  const updateAttendee = (index: number, patch: Partial<ExtraAttendee>) => {
    setExtraAttendees((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    );
  };

  const removeAttendee = (index: number) => {
    setExtraAttendees((prev) => prev.filter((_, idx) => idx !== index));
  };

  const submit = async () => {
    if (!form.startsAt || !form.guestName || !form.guestEmail) {
      toast.error("Please fill in the required fields.");
      return;
    }

    if (
      settings.paymentRequired &&
      settings.paypalLink &&
      !form.paymentReference.trim()
    ) {
      toast.error("Please enter a PayPal payment reference.");
      return;
    }

    const startsAtDate = new Date(form.startsAt);
    if (Number.isNaN(startsAtDate.getTime())) {
      toast.error("Please choose a valid date and time.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(apiV1("/meetings/requests"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: host.username,
          startsAt: startsAtDate.toISOString(),
          guestName: form.guestName,
          guestEmail: form.guestEmail,
          guestNotes: form.guestNotes,
          guestTimezone: form.guestTimezone,
          paymentReference: form.paymentReference,
          extraAttendees,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || body?.message || "Booking failed");
      }
      const data = await res.json();
      setResult({ status: data?.data?.status ?? "pending" });
      toast.success("Booking request sent");
      setForm((prev) => ({
        ...prev,
        startsAt: "",
        guestName: "",
        guestEmail: "",
        guestNotes: "",
        paymentReference: "",
      }));
      setExtraAttendees([]);
      setSelectedDate(undefined);
      setSelectedSlot(null);
    } catch (err) {
      toast.error("Booking failed", {
        description: (err as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-linear-to-br from-muted/20 via-background to-muted/30 p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Meeting</Badge>
          <div className="text-sm text-muted-foreground">
            {settings.defaultDurationMinutes} min · {settings.timezone}
          </div>
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          Availability: {availabilityLabel}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Acceptance:{" "}
          {settings.acceptanceMode === "auto"
            ? "Auto-accept"
            : settings.acceptanceMode === "auto_paid"
              ? "Auto-accept when paid"
              : "Manual review"}
        </div>
        {settings.meetingLocation ? (
          <div className="mt-2 text-xs text-muted-foreground">
            Location: {settings.meetingLocation}
          </div>
        ) : null}
        {settings.paymentRequired && settings.paypalLink ? (
          <div className="mt-4 rounded-md border bg-background/60 px-4 py-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">Pay with PayPal</div>
            <ol className="mt-1 list-decimal space-y-1 pl-4">
              <li>Click the PayPal button and complete payment.</li>
              <li>Copy the PayPal transaction/reference ID.</li>
              <li>Paste it below to send your booking request.</li>
            </ol>
            {settings.paypalMinAmount && settings.paypalMinAmount > 0 ? (
              <div className="mt-2">
                Minimum amount: {settings.paypalMinAmount}.
              </div>
            ) : null}
            <div className="mt-3">
              <Button asChild size="sm">
                <a href={settings.paypalLink} target="_blank" rel="noreferrer">
                  Pay with PayPal
                </a>
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-4">
        <div className="grid gap-2">
          <label className="text-xs text-muted-foreground">Pick a date *</label>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              setSelectedDate(date ?? undefined);
              setSelectedSlot(null);
              setForm((prev) => ({ ...prev, startsAt: "" }));
            }}
            disabled={[{ before: minDate }, { after: maxDate }]}
            className="rounded-md border bg-background"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-xs text-muted-foreground">
            Pick a time * ({settings.timezone})
          </label>
          {selectedDate ? (
            slots.length ? (
              <div className="flex flex-wrap gap-2">
                {slots.map((slot) => {
                  const active = selectedSlot === slot.time;
                  const disabled = overlapsBusySlot(
                    slot.startsAt,
                    settings.defaultDurationMinutes,
                  );
                  return (
                    <Button
                      key={slot.time}
                      type="button"
                      variant={active ? "default" : "outline"}
                      size="sm"
                      disabled={disabled}
                      onClick={() => {
                        setSelectedSlot(slot.time);
                        setForm((prev) => ({
                          ...prev,
                          startsAt: slot.startsAt.toISOString(),
                        }));
                      }}
                    >
                      {slot.time}
                    </Button>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                No slots available for this date.
              </div>
            )
          ) : (
            <div className="text-xs text-muted-foreground">
              Select a date to see available times.
            </div>
          )}
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-xs text-muted-foreground">Your name *</label>
            <Input
              value={form.guestName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, guestName: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs text-muted-foreground">Email *</label>
            <Input
              type="email"
              value={form.guestEmail}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, guestEmail: e.target.value }))
              }
            />
          </div>
        </div>

        <div className="grid gap-2">
          <label className="text-xs text-muted-foreground">Your timezone</label>
          <Input
            value={form.guestTimezone}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, guestTimezone: e.target.value }))
            }
            placeholder="UTC"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-xs text-muted-foreground">
            Reason for booking
          </label>
          <Textarea
            value={form.guestNotes}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, guestNotes: e.target.value }))
            }
          />
        </div>

        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            Additional attendees
          </div>
          {extraAttendees.map((attendee, idx) => (
            <div key={idx} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <Input
                placeholder="Name"
                value={attendee.name}
                onChange={(e) => updateAttendee(idx, { name: e.target.value })}
              />
              <Input
                placeholder="Email"
                value={attendee.email}
                list={contacts.length ? "meeting-contact-list" : undefined}
                onChange={(e) => {
                  const email = e.target.value;
                  const contact = contactMap.get(email.toLowerCase());
                  updateAttendee(idx, {
                    email,
                    name: contact?.name ?? attendee.name,
                  });
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeAttendee(idx)}
              >
                Remove
              </Button>
            </div>
          ))}
          {contacts.length ? (
            <datalist id="meeting-contact-list">
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.email}>
                  {contact.name}
                </option>
              ))}
            </datalist>
          ) : null}
          <Button variant="outline" size="sm" onClick={addAttendee}>
            Add attendee
          </Button>
        </div>

        {settings.paymentRequired && settings.paypalLink ? (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              Pay first, then paste the PayPal transaction/reference ID below.
              We verify the payment before sending your request.
              {settings.paypalMinAmount && settings.paypalMinAmount > 0
                ? ` Minimum amount: ${settings.paypalMinAmount}.`
                : ""}
            </div>
            <Input
              placeholder="Payment reference (required)"
              value={form.paymentReference}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  paymentReference: e.target.value,
                }))
              }
            />
          </div>
        ) : null}

        <Button onClick={submit} disabled={submitting}>
          {submitting ? "Sending request..." : "Request booking"}
        </Button>

        {result ? (
          <div className="text-xs text-muted-foreground">
            Booking submitted. You will receive an email with the next steps.
            Status:{" "}
            <span className="font-medium text-foreground">{result.status}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
