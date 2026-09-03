import { homedir } from "node:os";
import path from "node:path";

/**
 * Devuelve la ruta absoluta al vault de Obsidian, resuelta desde la
 * variable de entorno OBSIDIAN_VAULT_PATH. Nunca hardcodeada (ver SPEC.md).
 */
export function getVaultPath(): string {
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
  if (!vaultPath) {
    throw new Error(
      "OBSIDIAN_VAULT_PATH no está definida. Configurala en el entorno del " +
        "server (ver README) apuntando a la carpeta raíz del vault.",
    );
  }
  return vaultPath;
}

/**
 * Resultado de la detección automática de proyecto: a qué subcarpeta del
 * vault corresponde la nota, y el nombre "lógico" del proyecto (para el
 * frontmatter).
 */
export interface ProjectContext {
  /** Subcarpeta relativa al vault, ej. "Sistema" o "Proyectos/mi-app". */
  subfolder: string;
  /** Nombre de proyecto para el frontmatter, ej. "Sistema" o "mi-app". */
  proyecto: string;
}

/**
 * Detecta a qué subcarpeta del vault corresponde la nota actual, según el
 * cwd desde el que se lanzó Claude Code:
 *
 * - cwd === $HOME  -> carpeta fija "Sistema/" (troubleshooting general).
 * - cualquier otro cwd -> "Proyectos/<basename(cwd)>".
 *
 * 100% automático: el usuario nunca indica el proyecto a mano.
 */
export function resolveProjectContext(cwd: string = process.cwd()): ProjectContext {
  const resolvedCwd = path.resolve(cwd);
  const resolvedHome = path.resolve(homedir());

  if (resolvedCwd === resolvedHome) {
    return { subfolder: "Sistema", proyecto: "Sistema" };
  }

  const projectName = path.basename(resolvedCwd);
  return {
    subfolder: path.join("Proyectos", projectName),
    proyecto: projectName,
  };
}

const DIACRITICS_REGEX = /[\u0300-\u036f]/g;

/**
 * Convierte un título libre en un slug apto para nombre de archivo:
 * minúsculas, sin acentos, espacios y símbolos colapsados en guiones.
 */
export function slugify(titulo: string): string {
  const slug = titulo
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "") // quita diacríticos (á, ñ, etc.)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "sin-titulo";
}

/** Fecha actual en formato YYYY-MM-DD (hora local). */
export function todayISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
