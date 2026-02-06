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
    const l = lang.toLowerCase();
    try {
      if (l === "typescript" || l === "ts") {
        const m = await import("highlight.js/lib/languages/typescript");
        hljs.registerLanguage("typescript", m.default);
        return "typescript";
      }
      if (l === "tsx") {
        const m = await import("highlight.js/lib/languages/typescript");
        hljs.registerLanguage("typescript", m.default);
        return "typescript";
      }
      if (l === "javascript" || l === "js") {
        const m = await import("highlight.js/lib/languages/javascript");
        hljs.registerLanguage("javascript", m.default);
        return "javascript";
      }
      if (l === "jsx") {
        const m = await import("highlight.js/lib/languages/javascript");
        hljs.registerLanguage("javascript", m.default);
        return "javascript";
      }
      if (l === "json") {
        const m = await import("highlight.js/lib/languages/json");
        hljs.registerLanguage("json", m.default);
        return "json";
      }
      if (l === "yaml" || l === "yml") {
        const m = await import("highlight.js/lib/languages/yaml");
        hljs.registerLanguage("yaml", m.default);
        return "yaml";
      }
      if (l === "markdown" || l === "md") {
        const m = await import("highlight.js/lib/languages/markdown");
        hljs.registerLanguage("markdown", m.default);
        return "markdown";
      }
      if (l === "bash" || l === "sh" || l === "shell") {
        const m = await import("highlight.js/lib/languages/bash");
        hljs.registerLanguage("bash", m.default);
        return "bash";
      }
      if (l === "powershell" || l === "ps") {
        const m = await import("highlight.js/lib/languages/powershell");
        hljs.registerLanguage("powershell", m.default);
        return "powershell";
      }
      if (l === "python" || l === "py") {
        const m = await import("highlight.js/lib/languages/python");
        hljs.registerLanguage("python", m.default);
        return "python";
      }
      if (l === "php") {
        const m = await import("highlight.js/lib/languages/php");
        hljs.registerLanguage("php", m.default);
        return "php";
      }
      if (l === "ruby" || l === "rb") {
        const m = await import("highlight.js/lib/languages/ruby");
        hljs.registerLanguage("ruby", m.default);
        return "ruby";
      }
      if (l === "rust" || l === "rs") {
        const m = await import("highlight.js/lib/languages/rust");
        hljs.registerLanguage("rust", m.default);
        return "rust";
      }
      if (l === "html" || l === "xml") {
        const m = await import("highlight.js/lib/languages/xml");
        hljs.registerLanguage("xml", m.default);
        return "xml";
      }
      if (l === "css") {
        const m = await import("highlight.js/lib/languages/css");
        hljs.registerLanguage("css", m.default);
        return "css";
      }
      if (l === "scss") {
        const m = await import("highlight.js/lib/languages/scss");
        hljs.registerLanguage("scss", m.default);
        return "scss";
      }
      if (l === "sql") {
        const m = await import("highlight.js/lib/languages/sql");
        hljs.registerLanguage("sql", m.default);
        return "sql";
      }
      if (l === "go" || l === "golang") {
        const m = await import("highlight.js/lib/languages/go");
        hljs.registerLanguage("go", m.default);
        return "go";
      }
      if (l === "java") {
        const m = await import("highlight.js/lib/languages/java");
        hljs.registerLanguage("java", m.default);
        return "java";
      }
      if (l === "kotlin" || l === "kt") {
        const m = await import("highlight.js/lib/languages/kotlin");
        hljs.registerLanguage("kotlin", m.default);
        return "kotlin";
      }
      if (l === "swift") {
        const m = await import("highlight.js/lib/languages/swift");
        hljs.registerLanguage("swift", m.default);
        return "swift";
      }
      if (l === "c") {
        const m = await import("highlight.js/lib/languages/c");
        hljs.registerLanguage("c", m.default);
        return "c";
      }
      if (l === "cpp" || l === "c++") {
        const m = await import("highlight.js/lib/languages/cpp");
        hljs.registerLanguage("cpp", m.default);
        return "cpp";
      }
      if (l === "csharp" || l === "cs") {
        const m = await import("highlight.js/lib/languages/csharp");
        hljs.registerLanguage("csharp", m.default);
        return "csharp";
      }
      if (l === "dockerfile" || l === "docker") {
        const m = await import("highlight.js/lib/languages/dockerfile");
        hljs.registerLanguage("dockerfile", m.default);
        return "dockerfile";
      }
      if (l === "graphql" || l === "gql") {
        const m = await import("highlight.js/lib/languages/graphql");
        hljs.registerLanguage("graphql", m.default);
        return "graphql";
      }
      if (l === "ini") {
        const m = await import("highlight.js/lib/languages/ini");
        hljs.registerLanguage("ini", m.default);
        return "ini";
      }
      if (l === "lua") {
        const m = await import("highlight.js/lib/languages/lua");
        hljs.registerLanguage("lua", m.default);
        return "lua";
      }
      if (l === "r") {
        const m = await import("highlight.js/lib/languages/r");
        hljs.registerLanguage("r", m.default);
        return "r";
      }
      return "plaintext";
    } catch {
      return "plaintext";
    }
  }

  const language = await register(langHint);
  const { value } = hljs.highlight(code ?? "", { language });
  node.innerHTML = value;
  node.setAttribute("data-highlighted", "true");
}

export function detectLanguage(filename: string): string {
  const ext = filename?.split(".").pop()?.toLowerCase() || "";
  if (["js", "jsx"].includes(ext)) return "javascript";
  if (["ts", "tsx"].includes(ext)) return "typescript";
  if (["json"].includes(ext)) return "json";
  if (["yaml", "yml"].includes(ext)) return "yaml";
  if (["toml"].includes(ext)) return "toml";
  if (["css"].includes(ext)) return "css";
  if (["scss"].includes(ext)) return "scss";
  if (["html", "htm"].includes(ext)) return "html";
  if (["xml"].includes(ext)) return "xml";
  if (["md", "markdown"].includes(ext)) return "markdown";
  if (["sh", "bash", "zsh"].includes(ext)) return "bash";
  if (["ps1", "psm1"].includes(ext)) return "powershell";
  if (["py"].includes(ext)) return "python";
  if (["php"].includes(ext)) return "php";
  if (["rb"].includes(ext)) return "ruby";
  if (["rs"].includes(ext)) return "rust";
  if (["go"].includes(ext)) return "go";
  if (["java"].includes(ext)) return "java";
  if (["kt", "kts"].includes(ext)) return "kotlin";
  if (["swift"].includes(ext)) return "swift";
  if (["c"].includes(ext)) return "c";
  if (["cpp", "cxx", "cc", "c++"].includes(ext)) return "cpp";
  if (["cs"].includes(ext)) return "csharp";
  if (["sql"].includes(ext)) return "sql";
  if (["dockerfile", "docker"].includes(ext)) return "dockerfile";
  if (["graphql", "gql"].includes(ext)) return "graphql";
  if (["ini", "env"].includes(ext)) return "ini";
  if (["lua"].includes(ext)) return "lua";
  if (["r"].includes(ext)) return "r";
  return "plaintext";
}
