import { spawn, spawnSync } from "child_process";
import { tmpdir } from "os";
import path from "path";
import { nanoid } from "nanoid";
import { readdir, stat } from "fs/promises";

export class YtDlpNotFoundError extends Error {
  constructor(message?: string) {
    super(message ?? "yt-dlp binary not found in PATH");
    this.name = "YtDlpNotFoundError";
  }
}

let _ytDlpAvailable: boolean | null = null;
function getYtDlpBinary() {
  return process.env.YT_DLP_PATH || "yt-dlp";
}
function checkYtDlpAvailable() {
  if (_ytDlpAvailable !== null) return _ytDlpAvailable;
  try {
    const res = spawnSync(getYtDlpBinary(), ["--version"], { stdio: "ignore" });
    _ytDlpAvailable = res && typeof res.status === "number" && res.status === 0;
  } catch {
    _ytDlpAvailable = false;
  }
  return _ytDlpAvailable;
}

export type YtDlpResult = {
  filePath: string;
  fileName: string;
  bytes: number;
};

export async function downloadWithYtDlp(
  url: string,
  prefix = "yt",
  onProgress?: (percent?: number) => void,
): Promise<YtDlpResult> {
  if (!checkYtDlpAvailable()) {
    throw new YtDlpNotFoundError(
      "yt-dlp is not installed or not available in PATH. Install it with `pip install yt-dlp` or `brew install yt-dlp` and ensure it is on PATH.",
    );
  }

  const id = nanoid();
  const outTemplate = path.join(tmpdir(), `${prefix}-${id}.%(ext)s`);

  return new Promise<YtDlpResult>((resolve, reject) => {
    const args = [
      "-f",
      "bestvideo+bestaudio/best",
      "--merge-output-format",
      "mp4",
      "--no-playlist",
      "--newline",
      "-o",
      outTemplate,
    ];

    const cookiesPath = process.env.COOKIES_PATH;
    if (cookiesPath && /twitter\.com|x\.com/.test(url)) {
      args.push("--cookies", cookiesPath);
    }
    args.push(url);
    const proc = spawn(getYtDlpBinary(), args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    proc.stdout?.on("data", (d) => {
      const s = d.toString();
      const m = s.match(/\[download\]\s+([0-9]{1,3}(?:\.[0-9]+)?)%/i);
      if (m) {
        const p = parseFloat(m[1]);
        if (typeof onProgress === "function") onProgress(p);
      }
    });
    proc.stderr?.on("data", (d) => (stderr += d.toString()));
    proc.on("error", (err: Error & { code?: string }) => {
      if (err?.code === "ENOENT") {
        return reject(new YtDlpNotFoundError());
      }
      return reject(err);
    });
    proc.on("close", async (code) => {
      if (code !== 0) {
        return reject(new Error(`yt-dlp failed with code ${code}: ${stderr}`));
      }
      try {
        const dir = tmpdir();
        const files = await readdir(dir);
        const match = files.find((f) => f.startsWith(`${prefix}-${id}.`));
        if (!match)
          return reject(new Error("yt-dlp did not write expected file"));
        const full = path.join(dir, match);
        const st = await stat(full);
        if (typeof onProgress === "function") onProgress(100);
        resolve({ filePath: full, fileName: match, bytes: st.size });
      } catch (err) {
        reject(err);
      }
    });
  });
}
