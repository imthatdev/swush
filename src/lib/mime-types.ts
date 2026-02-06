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

export type MediaKind =
  | "audio"
  | "video"
  | "image"
  | "pdf"
  | "text"
  | "application";

const AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/x-pn-wav",
  "audio/flac",
  "audio/aac",
  "audio/ogg",
  "audio/opus",
  "audio/webm",
  "audio/m4a",
  "audio/x-m4a",
  "audio/mp4",
  "audio/x-ms-wma",
  "audio/amr",
  "audio/3gpp",
  "audio/3gpp2",
  "audio/x-aiff",
  "audio/aiff",
  "video/ogg",
  "video/quicktime",
];

const AUDIO_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".flac",
  ".aac",
  ".ogg",
  ".opus",
  ".m4a",
  ".wma",
  ".amr",
  ".aiff",
  ".3gp",
  ".3g2",
];

const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/x-msvideo",
  "video/x-matroska",
  "video/quicktime",
  "video/x-flv",
  "video/mpeg",
  "video/3gpp",
  "video/3gpp2",
  "video/x-ms-wmv",
  "video/avi",
];

const VIDEO_EXTENSIONS = [
  ".mp4",
  ".ogv",
  ".avi",
  ".mkv",
  ".mov",
  ".flv",
  ".mpeg",
  ".mpg",
  ".3gp",
  ".3g2",
  ".wmv",
];

const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/svg+xml",
  "image/tiff",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/heic",
  "image/heif",
  "image/avif",
];

const PDF_MIME_TYPES = ["application/pdf"];

const PDF_EXTENSIONS = [".pdf"];

const TEXT_MIME_TYPES = [
  "text/plain",
  "text/markdown",
  "text/html",
  "text/css",
  "text/csv",
  "text/xml",
  "text/x-python",
  "text/x-java-source",
  "text/x-c",
  "text/x-c++",
  "text/x-shellscript",
  "application/json",
  "application/xml",
  "application/javascript",
  "application/x-javascript",
  "application/x-sh",
  "application/x-python-code",
  "application/x-markdown",
];

const TEXT_EXTENSIONS = [
  ".txt",
  ".md",
  ".markdown",
  ".html",
  ".css",
  ".csv",
  ".xml",
  ".json",
  ".js",
  ".ts",
  ".tsx",
  ".env",
  ".py",
  ".sh",
  ".c",
  ".cpp",
  ".java",
];

const APPLICATION_MIME_TYPES = [
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-tar",
  "application/x-7z-compressed",
  "application/x-rar-compressed",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/x-msdownload",
  "application/x-executable",
  "application/x-bzip",
  "application/x-bzip2",
  "application/x-gzip",
  "application/x-xz",
  "application/x-iso9660-image",
  "application/x-disk-image",
];

const APPLICATION_EXTENSIONS = [
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".7z",
  ".rar",
  ".xls",
  ".xlsx",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".exe",
  ".bin",
  ".iso",
  ".img",
];

const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
  ".tiff",
  ".ico",
  ".heic",
  ".heif",
  ".avif",
];

function getExtension(filename = "") {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

export function isAudio(mime?: string | null, filename?: string | null) {
  if (!mime && !filename) return false;
  const ext = filename ? getExtension(filename) : "";
  if (ext === ".ogg" && (!mime || mime === "audio/ogg" || mime === "video/ogg"))
    return true;
  if (ext === ".m4a") return true;
  if (mime && AUDIO_MIME_TYPES.includes(mime)) return true;
  if (filename && AUDIO_EXTENSIONS.includes(ext)) return true;
  return false;
}

export function isVideo(mime?: string | null, filename?: string | null) {
  if (!mime && !filename) return false;
  const ext = filename ? getExtension(filename) : "";
  if (AUDIO_EXTENSIONS.includes(ext)) return false;
  if (ext === ".ogv") return true;
  if (ext === ".ogg" && mime && mime === "video/ogg") return false;
  if (mime && VIDEO_MIME_TYPES.includes(mime)) return true;
  if (filename && VIDEO_EXTENSIONS.includes(ext)) return true;
  return mime ? mime.startsWith("video/") : false;
}

export function isImage(mime?: string | null, filename?: string | null) {
  if (!mime && !filename) return false;
  const ext = filename ? getExtension(filename) : "";
  if (mime && IMAGE_MIME_TYPES.includes(mime)) return true;
  if (filename && IMAGE_EXTENSIONS.includes(ext)) return true;
  if (ext === ".webp") return true;
  return mime ? mime.startsWith("image/") : false;
}

export function isPdf(mime?: string | null, filename?: string | null) {
  if (!mime && !filename) return false;
  const ext = filename ? getExtension(filename) : "";
  if (mime && PDF_MIME_TYPES.includes(mime)) return true;
  if (filename && PDF_EXTENSIONS.includes(ext)) return true;
  return false;
}

export function isText(mime?: string | null, filename?: string | null) {
  if (!mime && !filename) return false;
  const ext = filename ? getExtension(filename) : "";
  if (mime && TEXT_MIME_TYPES.includes(mime)) return true;
  if (filename && TEXT_EXTENSIONS.includes(ext)) return true;
  return mime ? mime.startsWith("text/") : false;
}

export function isApplication(mime?: string | null, filename?: string | null) {
  if (!mime && !filename) return false;
  const ext = filename ? getExtension(filename) : "";
  if (mime && APPLICATION_MIME_TYPES.includes(mime)) return true;
  if (filename && APPLICATION_EXTENSIONS.includes(ext)) return true;
  return mime ? mime.startsWith("application/") : false;
}

export function isMedia(
  kind: MediaKind,
  mime?: string | null,
  filename?: string | null,
): boolean {
  switch (kind) {
    case "audio":
      return isAudio(mime, filename);
    case "video":
      return isVideo(mime, filename);
    case "image":
      return isImage(mime, filename);
    case "pdf":
      return isPdf(mime, filename);
    case "text":
      return isText(mime, filename);
    case "application":
      return isApplication(mime, filename);
    default:
      return false;
  }
}

export function mimeFromExt(ext?: string): string | undefined {
  if (!ext) return undefined;
  const clean = ext.startsWith(".") ? ext.slice(1) : ext;
  switch (clean.toLowerCase()) {
    case "gif":
      return "image/gif";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    default:
      return undefined;
  }
}

export function getMimeFromFile(input: string): string | undefined {
  let ext = "";
  if (!input) return undefined;
  if (input.startsWith(".")) {
    ext = input.toLowerCase();
  } else if (!input.includes(".")) {
    ext = "." + input.toLowerCase();
  } else {
    ext = getExtension(input);
  }
  if (!ext) return undefined;
  if (AUDIO_EXTENSIONS.includes(ext)) return AUDIO_MIME_TYPES[0];
  if (VIDEO_EXTENSIONS.includes(ext)) return VIDEO_MIME_TYPES[0];
  if (IMAGE_EXTENSIONS.includes(ext)) {
    switch (ext) {
      case ".jpg":
      case ".jpeg":
        return "image/jpeg";
      case ".png":
        return "image/png";
      case ".gif":
        return "image/gif";
      case ".webp":
        return "image/webp";
      case ".bmp":
        return "image/bmp";
      case ".svg":
        return "image/svg+xml";
      case ".tiff":
        return "image/tiff";
      case ".ico":
        return "image/x-icon";
      case ".heic":
        return "image/heic";
      case ".heif":
        return "image/heif";
      case ".avif":
        return "image/avif";
      default:
        return undefined;
    }
  }
  if (PDF_EXTENSIONS.includes(ext)) return PDF_MIME_TYPES[0];
  if (TEXT_EXTENSIONS.includes(ext)) {
    switch (ext) {
      case ".md":
      case ".markdown":
        return "text/markdown";
      case ".html":
        return "text/html";
      case ".css":
        return "text/css";
      case ".csv":
        return "text/csv";
      case ".xml":
        return "text/xml";
      case ".json":
        return "application/json";
      case ".js":
        return "application/javascript";
      case ".ts":
      case ".tsx":
        return "text/plain";
      case ".env":
        return "text/plain";
      case ".py":
        return "text/x-python";
      case ".sh":
        return "text/x-shellscript";
      case ".c":
        return "text/x-c";
      case ".cpp":
        return "text/x-c++";
      case ".java":
        return "text/x-java-source";
      default:
        return "text/plain";
    }
  }
  if (APPLICATION_EXTENSIONS.includes(ext)) {
    switch (ext) {
      case ".zip":
        return "application/zip";
      case ".tar":
        return "application/x-tar";
      case ".gz":
        return "application/x-gzip";
      case ".bz2":
        return "application/x-bzip2";
      case ".7z":
        return "application/x-7z-compressed";
      case ".rar":
        return "application/x-rar-compressed";
      case ".xls":
        return "application/vnd.ms-excel";
      case ".xlsx":
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      case ".doc":
        return "application/msword";
      case ".docx":
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      case ".ppt":
        return "application/vnd.ms-powerpoint";
      case ".pptx":
        return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      case ".exe":
        return "application/x-msdownload";
      case ".bin":
        return "application/x-executable";
      case ".iso":
        return "application/x-iso9660-image";
      case ".img":
        return "application/x-disk-image";
      default:
        return undefined;
    }
  }

  return mimeFromExt(ext);
}
