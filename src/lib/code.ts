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

import type { LanguageFn } from "highlight.js";

export const languages = [
  "plaintext",
  "typescript",
  "tsx",
  "javascript",
  "jsx",
  "json",
  "yaml",
  "markdown",
  "bash",
  "powershell",
  "python",
  "php",
  "ruby",
  "rust",
  "go",
  "java",
  "kotlin",
  "swift",
  "c",
  "cpp",
  "csharp",
  "sql",
  "html",
  "xml",
  "css",
  "scss",
  "dockerfile",
  "graphql",
  "ini",
  "lua",
  "r",
];

const LANGUAGE_LABELS: Record<string, string> = {
  plaintext: "Plain text",
  typescript: "TypeScript",
  tsx: "TSX",
  javascript: "JavaScript",
  jsx: "JSX",
  json: "JSON",
  yaml: "YAML",
  toml: "TOML",
  markdown: "Markdown",
  bash: "Bash",
  powershell: "PowerShell",
  python: "Python",
  php: "PHP",
  ruby: "Ruby",
  rust: "Rust",
  go: "Go",
  java: "Java",
  kotlin: "Kotlin",
  swift: "Swift",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  sql: "SQL",
  html: "HTML",
  xml: "XML",
  css: "CSS",
  scss: "SCSS",
  dockerfile: "Dockerfile",
  graphql: "GraphQL",
  ini: "INI",
  lua: "Lua",
  r: "R",
};

const LANGUAGE_ALIASES: Record<string, string> = {
  ts: "typescript",
  typescript: "typescript",
  tsx: "typescript",
  js: "javascript",
  javascript: "javascript",
  jsx: "javascript",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  md: "markdown",
  markdown: "markdown",
  sh: "bash",
  bash: "bash",
  shell: "bash",
  ps: "powershell",
  powershell: "powershell",
  py: "python",
  python: "python",
  php: "php",
  rb: "ruby",
  ruby: "ruby",
  rs: "rust",
  rust: "rust",
  html: "xml",
  xml: "xml",
  css: "css",
  scss: "scss",
  sql: "sql",
  go: "go",
  golang: "go",
  java: "java",
  kt: "kotlin",
  kotlin: "kotlin",
  swift: "swift",
  c: "c",
  cpp: "cpp",
  "c++": "cpp",
  csharp: "csharp",
  cs: "csharp",
  dockerfile: "dockerfile",
  docker: "dockerfile",
  graphql: "graphql",
  gql: "graphql",
  ini: "ini",
  lua: "lua",
  r: "r",
};

type HighlightLanguage =
  | "typescript"
  | "javascript"
  | "json"
  | "yaml"
  | "markdown"
  | "bash"
  | "powershell"
  | "python"
  | "php"
  | "ruby"
  | "rust"
  | "xml"
  | "css"
  | "scss"
  | "sql"
  | "go"
  | "java"
  | "kotlin"
  | "swift"
  | "c"
  | "cpp"
  | "csharp"
  | "dockerfile"
  | "graphql"
  | "ini"
  | "lua"
  | "r";

const LANGUAGE_LOADERS: Record<
  HighlightLanguage,
  () => Promise<{ default: LanguageFn }>
> = {
  typescript: () => import("highlight.js/lib/languages/typescript"),
  javascript: () => import("highlight.js/lib/languages/javascript"),
  json: () => import("highlight.js/lib/languages/json"),
  yaml: () => import("highlight.js/lib/languages/yaml"),
  markdown: () => import("highlight.js/lib/languages/markdown"),
  bash: () => import("highlight.js/lib/languages/bash"),
  powershell: () => import("highlight.js/lib/languages/powershell"),
  python: () => import("highlight.js/lib/languages/python"),
  php: () => import("highlight.js/lib/languages/php"),
  ruby: () => import("highlight.js/lib/languages/ruby"),
  rust: () => import("highlight.js/lib/languages/rust"),
  xml: () => import("highlight.js/lib/languages/xml"),
  css: () => import("highlight.js/lib/languages/css"),
  scss: () => import("highlight.js/lib/languages/scss"),
  sql: () => import("highlight.js/lib/languages/sql"),
  go: () => import("highlight.js/lib/languages/go"),
  java: () => import("highlight.js/lib/languages/java"),
  kotlin: () => import("highlight.js/lib/languages/kotlin"),
  swift: () => import("highlight.js/lib/languages/swift"),
  c: () => import("highlight.js/lib/languages/c"),
  cpp: () => import("highlight.js/lib/languages/cpp"),
  csharp: () => import("highlight.js/lib/languages/csharp"),
  dockerfile: () => import("highlight.js/lib/languages/dockerfile"),
  graphql: () => import("highlight.js/lib/languages/graphql"),
  ini: () => import("highlight.js/lib/languages/ini"),
  lua: () => import("highlight.js/lib/languages/lua"),
  r: () => import("highlight.js/lib/languages/r"),
};

const FILE_EXTENSION_LANGUAGE: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  css: "css",
  scss: "scss",
  html: "html",
  htm: "html",
  xml: "xml",
  md: "markdown",
  markdown: "markdown",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  ps1: "powershell",
  psm1: "powershell",
  py: "python",
  php: "php",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  swift: "swift",
  c: "c",
  cpp: "cpp",
  cxx: "cpp",
  cc: "cpp",
  "c++": "cpp",
  cs: "csharp",
  sql: "sql",
  dockerfile: "dockerfile",
  docker: "dockerfile",
  graphql: "graphql",
  gql: "graphql",
  ini: "ini",
  env: "ini",
  lua: "lua",
  r: "r",
};

export function formatLanguageLabel(lang?: string | null) {
  if (!lang) return "Plain text";
  const key = lang.toLowerCase();
  return LANGUAGE_LABELS[key] ?? key.toUpperCase();
}

export async function registerAndHighlight(
  node: HTMLElement,
  code: string,
  langHint: string,
) {
  const hljs = (await import("highlight.js/lib/core")).default;

  async function register(lang: string): Promise<string> {
    const alias = LANGUAGE_ALIASES[lang.toLowerCase()];
    if (!alias) return "plaintext";
    const normalized = alias as HighlightLanguage;
    const load = LANGUAGE_LOADERS[normalized];
    if (!load) return "plaintext";

    try {
      const m = await load();
      hljs.registerLanguage(normalized, m.default);
      return normalized;
    } catch {
      return "plaintext";
    }
  }

  const language = await register(langHint);
  const { value } = hljs.highlight(code ?? "", { language });
  const parser = new DOMParser();
  const parsed = parser.parseFromString(`<div>${value}</div>`, "text/html");
  const wrapper = parsed.body.firstElementChild;
  const nextNodes = wrapper
    ? Array.from(wrapper.childNodes, (child) => child.cloneNode(true))
    : [document.createTextNode(code ?? "")];
  node.replaceChildren(...nextNodes);
  node.setAttribute("data-highlighted", "true");
}

export function detectLanguage(filename: string): string {
  const ext = filename?.split(".").pop()?.toLowerCase() || "";
  return FILE_EXTENSION_LANGUAGE[ext] || "plaintext";
}
