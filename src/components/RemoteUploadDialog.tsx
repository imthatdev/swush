import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "./ui/textarea";
import { apiV1 } from "@/lib/api-path";
import { RemoteUploadJob } from "@/lib/server/remote-upload-jobs";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";

async function deleteJobs(ids: string[]) {
  await fetch(apiV1("/remote-upload"), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
}

export default function RemoteUploadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [input, setInput] = useState("");
  const [names, setNames] = useState<string[]>([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function fetchJobs() {
    return await fetch(apiV1("/remote-upload"), { method: "GET" })
      .then((r) => r.json())
      .then((data) => data.jobs || []);
  }

  async function submitItems(items: { url: string; name?: string }[]) {
    return await fetch(apiV1("/remote-upload"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    }).then((r) => r.json());
  }

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchJobs()
      .then(setJobs)
      .catch(() => setError("Failed to load jobs"))
      .finally(() => setLoading(false));
    const interval = setInterval(() => {
      fetchJobs().then(setJobs);
    }, 4000);
    return () => clearInterval(interval);
  }, [open]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    const urls = input
      .split(/\r?\n|,|;/)
      .map((u) => u.trim())
      .filter(Boolean);
    if (!urls.length) {
      setError("Please enter at least one URL.");
      setSubmitting(false);
      return;
    }
    const items = urls.map((url, i) => ({
      url,
      name: names[i]?.trim() || undefined,
    }));
    try {
      await submitItems(items);
      setInput("");
      setNames([]);
      fetchJobs().then(setJobs);
    } catch {
      setError("Failed to submit URLs");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearAll = async () => {
    if (jobs.length === 0) return;
    await deleteJobs(jobs.map((job: RemoteUploadJob) => job.id));
    fetchJobs().then(setJobs);
  };
  const handleRemoveFailed = async () => {
    const failedIds = jobs
      .filter((job: RemoteUploadJob) => job.status === "failed")
      .map((job: RemoteUploadJob) => job.id);
    if (failedIds.length === 0) return;
    await deleteJobs(failedIds);
    fetchJobs().then(setJobs);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remote Upload</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-w-svw">
          <Textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              const urls = e.target.value
                .split(/\r?\n|,|;/)
                .map((u) => u.trim())
                .filter(Boolean);
              setNames((prev) => {
                const next = [...prev];
                next.length = urls.length;
                return next;
              });
            }}
            placeholder="Paste one or more URLs (one per line or comma separated)"
            disabled={submitting}
            className="max-h-36 break-all"
            rows={3}
          />
          <div className="overflow-y-auto max-h-28">
            {input
              .split(/\r?\n|,|;/)
              .map((u) => u.trim())
              .filter(Boolean)
              .map((url, i) => (
                <div
                  key={i}
                  className="grid grid-cols-3 items-center gap-2 mt-1"
                >
                  <span className="text-xs text-muted-foreground truncate col-span-2">
                    {url}
                  </span>
                  <input
                    className="border rounded px-2 py-1 text-xs flex-1"
                    type="text"
                    placeholder="Optional name"
                    value={names[i] || ""}
                    onChange={(e) => {
                      setNames((prev) => {
                        const next = [...prev];
                        next[i] = e.target.value;
                        return next;
                      });
                    }}
                    disabled={submitting}
                  />
                </div>
              ))}
          </div>
          {error && <div className="text-red-500 text-sm">{error}</div>}
        </div>
        <Separator />
        <div>
          {loading ? (
            <div>Loading...</div>
          ) : jobs.length === 0 ? (
            <div>No remote uploads yet.</div>
          ) : (
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
              {jobs.map((job: RemoteUploadJob) => (
                <div
                  key={job.id}
                  className="border bg-card rounded p-3 flex flex-col w-full"
                >
                  <div className="grid grid-cols-1 gap-1 justify-between">
                    <span className="truncate break-all text-sm text-muted-foreground">
                      {job.name ? `${job.name} (${job.url})` : job.url}
                    </span>
                    <Badge
                      variant={
                        job.status === "completed"
                          ? "default"
                          : job.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {job.status === "completed"
                        ? "Uploaded"
                        : job.status === "failed"
                          ? "Failed"
                          : `Processing (${job.percent}%)`}
                    </Badge>
                  </div>
                  {job.error && (
                    <span className="text-red-500 text-xs">{job.error}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <Separator />
        <DialogFooter>
          <Button variant="outline" onClick={handleClearAll}>
            Clear All
          </Button>
          <Button variant="outline" onClick={handleRemoveFailed}>
            Remove Failed
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !input.trim()}>
            Submit URLs
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
