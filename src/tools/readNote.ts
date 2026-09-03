import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getVaultPath } from "../lib/vault.js";

const inputSchema = {
  path: z.string().min(1, "El path no puede estar vacío.").describe(
    "Path relativo al vault, en el mismo formato que devuelve search_notes " +
      '(ej. "Proyectos/mi-proyecto/2026-01-01-nota.md").',
  ),
};

/**
 * Resuelve un path relativo dentro del vault a una ruta absoluta, validando
 * que el resultado no se escape del vault (path traversal tipo
 * "../../etc/passwd"). Devuelve `null` si el path se escapa.
 */
function resolveWithinVault(vaultPath: string, relativePath: string): string | null {
  const resolvedVault = path.resolve(vaultPath);
  const resolvedTarget = path.resolve(path.join(vaultPath, relativePath));

  const isInsideVault =
    resolvedTarget === resolvedVault || resolvedTarget.startsWith(resolvedVault + path.sep);

  return isInsideVault ? resolvedTarget : null;
}

/**
 * Registra la tool `read_note`: devuelve el contenido completo (frontmatter
 * incluido) de una nota puntual del vault, dado su path relativo.
 */
export function registerReadNote(server: McpServer): void {
  server.registerTool(
    "read_note",
    {
      title: "Leer nota",
      description:
        "Usá esta tool cuando el usuario quiera recuperar el contenido completo " +
        "de una nota puntual de su vault de Obsidian de una sesión anterior — " +
        'sin necesidad de que mencione la tool por nombre. Frases disparadoras: ' +
        '"leé la nota de...", "abrí la nota sobre...", "mostrame lo que anotamos ' +
        'el <fecha>...", "traé el contenido completo de esa nota". Importante: ' +
        "esto NO lee de la memoria interna/nativa de Claude Code — lee un " +
        "archivo .md real del vault del usuario, dado su path relativo (el " +
        "mismo formato que devuelve search_notes). Normalmente se usa después " +
        "de search_notes: primero se busca para encontrar la nota correcta, " +
        "después se lee completa con esta tool.",
      inputSchema,
    },
    async ({ path: relativePath }) => {
      try {
        const vaultPath = getVaultPath();
        const absolutePath = resolveWithinVault(vaultPath, relativePath);

        if (!absolutePath) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Path inválido: "${relativePath}" está fuera del vault.`,
              },
            ],
          };
        }

        const content = await readFile(absolutePath, "utf-8");
        return {
          content: [{ type: "text", text: content }],
        };
      } catch (error) {
        const isNotFound = (error as NodeJS.ErrnoException).code === "ENOENT";
        const message = isNotFound
          ? `No se encontró la nota en "${relativePath}".`
          : `Error leyendo la nota: ${(error as Error).message}`;
        return {
          isError: true,
          content: [{ type: "text", text: message }],
        };
      }
    },
  );
}
