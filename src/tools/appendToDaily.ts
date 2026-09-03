import { access, appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getVaultPath, todayISODate } from "../lib/vault.js";

const inputSchema = {
  contenido: z.string().min(1, "El contenido no puede estar vacío."),
};

/** Hora actual en formato HH:MM (hora local), para separar entradas del mismo día. */
function currentTimeHHMM(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

/**
 * Registra la tool `append_to_daily`: agrega una entrada a la nota diaria
 * de hoy (`Daily/YYYY-MM-DD.md`). Si la nota no existe todavía la crea con
 * frontmatter mínimo; si ya existe, hace append separando la entrada nueva
 * con un separador de hora, sin pisar nada de lo anterior. A diferencia de
 * `create_note`, nunca falla por "ya existe": ese es el caso normal.
 */
export function registerAppendToDaily(server: McpServer): void {
  server.registerTool(
    "append_to_daily",
    {
      title: "Agregar a la nota diaria",
      description:
        "Usá esta tool cuando el usuario pida anotar algo específicamente en " +
        "su nota del día actual (el diario, no una nota de proyecto) — sin " +
        'necesidad de que mencione la tool por nombre. Frases disparadoras: ' +
        '"agregá a mi diario de hoy...", "anotá en el daily...", "dejá esto en ' +
        'la nota de hoy...", "sumá esto al log de hoy...". Distinción clave con ' +
        "create_note: create_note crea una nota nueva independiente (para un " +
        "proyecto o para Sistema/); append_to_daily en cambio SIEMPRE opera " +
        "sobre una única nota por fecha (Daily/YYYY-MM-DD.md), acumulando " +
        "entradas a lo largo del día — usala para bitácora cronológica del día, " +
        "no para documentar un tema puntual de un proyecto. Importante: esto NO " +
        "es la memoria interna/nativa de Claude Code — escribe en un archivo " +
        ".md real y visible en el vault de Obsidian del usuario. Si la nota del " +
        "día no existe la crea; si ya existe, agrega la entrada al final " +
        "separada por hora, sin perder las entradas previas.",
      inputSchema,
    },
    async ({ contenido }) => {
      try {
        const vaultPath = getVaultPath();
        const fecha = todayISODate();
        const dirPath = path.join(vaultPath, "Daily");
        const filePath = path.join(dirPath, `${fecha}.md`);
        const relativePath = path.join("Daily", `${fecha}.md`);

        if (await fileExists(filePath)) {
          const hora = currentTimeHHMM();
          const entry = `\n---\n### ${hora}\n${contenido}\n`;
          await appendFile(filePath, entry);
        } else {
          await mkdir(dirPath, { recursive: true });
          const frontmatter = `---\nfecha: ${fecha}\n---\n\n`;
          await writeFile(filePath, `${frontmatter}${contenido}\n`);
        }

        return {
          content: [{ type: "text", text: `Entrada agregada a ${relativePath}` }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error agregando a la nota diaria: ${(error as Error).message}` }],
        };
      }
    },
  );
}
