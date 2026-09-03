import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getVaultPath } from "../lib/vault.js";

const inputSchema = {
  query: z.string().min(1, "La query no puede estar vacía."),
  tag: z.string().optional().describe("Filtra primero por notas que tengan este tag en el frontmatter."),
};

const CONTEXT_RADIUS = 1; // líneas antes/después del match -> fragmento de 2-3 líneas

interface SearchMatch {
  relativePath: string;
  snippet: string;
}

/**
 * Extrae los tags del frontmatter YAML de una nota, asumiendo el formato
 * simple que genera `create_note` (`tags: [a, b, c]` o `tags: []`).
 * No es un parser YAML completo, alcanza para el uso interno del vault.
 */
function extractFrontmatterTags(content: string): string[] {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return [];

  const tagsLine = frontmatterMatch[1].split("\n").find((line) => line.trim().startsWith("tags:"));
  if (!tagsLine) return [];

  const value = tagsLine.slice(tagsLine.indexOf(":") + 1).trim();
  const inner = value.replace(/^\[/, "").replace(/\]$/, "").trim();
  if (!inner) return [];

  return inner.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean);
}

/** Recorre recursivamente el vault y devuelve las rutas absolutas de los .md. */
async function listMarkdownFiles(vaultPath: string): Promise<string[]> {
  const entries = await readdir(vaultPath, { recursive: true });
  return entries
    .filter((entry) => entry.toLowerCase().endsWith(".md"))
    .map((entry) => path.join(vaultPath, entry));
}

/** Arma un fragmento corto (2-3 líneas) de contexto alrededor de una línea que matcheó. */
function buildSnippet(lines: string[], matchIndex: number): string {
  const start = Math.max(0, matchIndex - CONTEXT_RADIUS);
  const end = Math.min(lines.length - 1, matchIndex + CONTEXT_RADIUS);
  return lines.slice(start, end + 1).join("\n");
}

function toRelativeVaultPath(vaultPath: string, absolutePath: string): string {
  return path.relative(vaultPath, absolutePath).split(path.sep).join("/");
}

/**
 * Registra la tool `search_notes`: busca texto libre (case-insensitive) en
 * todas las notas del vault, opcionalmente filtrando primero por tag de
 * frontmatter, y devuelve un fragmento corto de contexto por cada match.
 */
export function registerSearchNotes(server: McpServer): void {
  server.registerTool(
    "search_notes",
    {
      title: "Buscar notas",
      description:
        "Usá esta tool cuando el usuario quiera recuperar contexto de sesiones " +
        "anteriores guardado en su vault de Obsidian — sin necesidad de que " +
        "mencione la tool por nombre. Frases disparadoras: \"¿qué hicimos " +
        'con...", "buscá en mis notas sobre...", "¿en algún momento anotamos ' +
        '...?", "¿qué dijimos de...?", "revisá si ya resolvimos esto antes". ' +
        "Importante: esto NO consulta la memoria interna/nativa de Claude Code " +
        "— busca texto libre (case-insensitive) en los archivos .md reales del " +
        "vault del usuario, opcionalmente filtrando primero por un tag de " +
        "frontmatter. Preferí esta tool cuando el usuario pregunta por algo que " +
        "se trabajó en una sesión pasada de este mismo vault (otro proyecto, " +
        "troubleshooting de sistema, etc.), ya que esa información no vive en " +
        "el contexto de la conversación actual. Devuelve, por cada coincidencia, " +
        "la ruta relativa de la nota y un fragmento corto de contexto alrededor " +
        "del match — usá read_note después para traer la nota completa.",
      inputSchema,
    },
    async ({ query, tag }) => {
      try {
        const vaultPath = getVaultPath();
        const filePaths = await listMarkdownFiles(vaultPath);
        const lowerQuery = query.toLowerCase();
        const lowerTag = tag?.toLowerCase();

        const matches: SearchMatch[] = [];

        for (const filePath of filePaths) {
          const content = await readFile(filePath, "utf-8");

          if (lowerTag) {
            const tags = extractFrontmatterTags(content);
            if (!tags.includes(lowerTag)) continue;
          }

          const lines = content.split("\n");
          const relativePath = toRelativeVaultPath(vaultPath, filePath);

          lines.forEach((line, index) => {
            if (line.toLowerCase().includes(lowerQuery)) {
              matches.push({ relativePath, snippet: buildSnippet(lines, index) });
            }
          });
        }

        if (matches.length === 0) {
          const tagInfo = tag ? ` con tag "${tag}"` : "";
          return {
            content: [
              {
                type: "text",
                text: `Sin resultados: no se encontró "${query}"${tagInfo} en ninguna nota del vault.`,
              },
            ],
          };
        }

        const header = `Se encontraron ${matches.length} resultado(s) para "${query}"${tag ? ` (tag: ${tag})` : ""}:\n`;
        const body = matches
          .map((match, i) => `${i + 1}. ${match.relativePath}\n${match.snippet}`)
          .join("\n\n");

        return {
          content: [{ type: "text", text: `${header}\n${body}` }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error buscando notas: ${(error as Error).message}` }],
        };
      }
    },
  );
}
