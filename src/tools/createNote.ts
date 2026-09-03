import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getVaultPath, resolveProjectContext, slugify, todayISODate } from "../lib/vault.js";

const inputSchema = {
  titulo: z.string().min(1, "El título no puede estar vacío."),
  contenido: z.string().min(1, "El contenido no puede estar vacío."),
  tags: z.array(z.string()).optional().describe("Tags opcionales para el frontmatter."),
};

function buildFrontmatter(proyecto: string, fecha: string, tags: string[]): string {
  const tagsYaml = tags.length > 0 ? `[${tags.join(", ")}]` : "[]";
  return ["---", `proyecto: ${proyecto}`, `fecha: ${fecha}`, `tags: ${tagsYaml}`, "---", "", ""].join("\n");
}

/**
 * Registra la tool `create_note`: crea una nota nueva en la subcarpeta del
 * vault que corresponde según el cwd desde el que se lanzó Claude Code
 * (ver `resolveProjectContext`), con frontmatter YAML.
 */
export function registerCreateNote(server: McpServer): void {
  server.registerTool(
    "create_note",
    {
      title: "Crear nota",
      description:
        "Usá esta tool cuando el usuario pida guardar, anotar, registrar o " +
        "documentar algo en su vault de Obsidian / segundo cerebro / bitácora " +
        "de proyecto — sin necesidad de que mencione la tool por nombre. " +
        'Frases disparadoras: "guardá una nota de...", "anotá que...", ' +
        '"documentá esto", "registrá que hicimos...", "dejá constancia de...". ' +
        "Importante: esto NO es la memoria interna/nativa de Claude Code — " +
        "escribe un archivo .md real y persistente en el vault de Obsidian del " +
        "usuario, que él puede después abrir, ver y editar en Obsidian. Preferí " +
        "esta tool sobre la memoria nativa cuando lo que se guarda es contenido " +
        "de proyecto o bitácora que el usuario quiere poder consultar visualmente " +
        "después, no una preferencia o dato de contexto sobre cómo trabajar. " +
        "Crea la nota en la subcarpeta que corresponde automáticamente según el " +
        "directorio de trabajo actual (Proyectos/<carpeta> o Sistema/ si se " +
        "abrió desde $HOME).",
      inputSchema,
    },
    async ({ titulo, contenido, tags }) => {
      try {
        const vaultPath = getVaultPath();
        const { subfolder, proyecto } = resolveProjectContext();
        const fecha = todayISODate();
        const filename = `${fecha}-${slugify(titulo)}.md`;

        const dirPath = path.join(vaultPath, subfolder);
        const filePath = path.join(dirPath, filename);

        const frontmatter = buildFrontmatter(proyecto, fecha, tags ?? []);
        const body = `# ${titulo}\n\n${contenido}\n`;

        await mkdir(dirPath, { recursive: true });
        await writeFile(filePath, frontmatter + body, { flag: "wx" });

        const relativePath = path.join(subfolder, filename);
        return {
          content: [
            {
              type: "text",
              text: `Nota creada: ${relativePath}`,
            },
          ],
        };
      } catch (error) {
        const isExists = (error as NodeJS.ErrnoException).code === "EEXIST";
        const message = isExists
          ? "Ya existe una nota con ese título y fecha. Elegí otro título."
          : `Error creando la nota: ${(error as Error).message}`;
        return {
          isError: true,
          content: [{ type: "text", text: message }],
        };
      }
    },
  );
}
