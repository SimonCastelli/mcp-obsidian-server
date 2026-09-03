# MCP Server — Obsidian Vault de Contexto para Claude Code

## Objetivo

Servidor MCP propio que le da a Claude Code la capacidad de leer y escribir
notas en un vault de Obsidian dedicado, para que funcione como memoria
persistente entre sesiones de trabajo (bitácora de proyectos, troubleshooting
de sistema, etc.). El vault es independiente del vault de apuntes de la
facultad.

Propósitos del proyecto:
- Tener un sistema de contexto persistente real, usable día a día.
- Aprender el protocolo MCP de punta a punta (SDK, tools, transporte, testing).
- Repo mostrable como parte de portfolio técnico.

## Vault

- **Ubicación fija**: `/home/simon/MCP`
- Vive únicamente en la laptop con Omarchy (la máquina "productiva"). No se
  sincroniza con la de escritorio.
- El vault contiene **solo notas** (bitácora), nunca el código de los
  proyectos reales — cada proyecto sigue viviendo en su propia carpeta/repo,
  sin relación de ubicación con el vault.

### Estructura de carpetas

```
/home/simon/MCP/
├── Proyectos/
│   ├── <nombre-carpeta-proyecto-1>/
│   │   └── YYYY-MM-DD-titulo-sesion.md
│   └── <nombre-carpeta-proyecto-2>/
│       └── YYYY-MM-DD-titulo-sesion.md
├── Sistema/
│   └── YYYY-MM-DD-titulo-problema.md
├── Daily/
│   └── YYYY-MM-DD.md
└── _Index.md          (dashboard con links a proyectos activos)
```

## Detección automática de proyecto

Cada vez que se invoca una tool que crea/edita notas, el server debe resolver
a qué subcarpeta del vault corresponde, sin que el usuario lo especifique:

1. Tomar `process.cwd()` (directorio desde el que se lanzó `claude`).
2. Si el `cwd` es igual al `$HOME` del usuario (es decir, Claude Code se abrió
   directamente desde la carpeta principal, sin `cd` a un proyecto) →
   usar la carpeta fija **`Sistema/`** en vez del nombre de carpeta real.
   Este es el caso típico de troubleshooting de Linux (cambiar distribución
   de teclado, arreglar configs de Hyprland, etc.).
3. En cualquier otro caso → usar `path.basename(cwd)` como nombre de
   subcarpeta dentro de `Proyectos/`.

Esta lógica es 100% automática: el usuario nunca tiene que indicar
manualmente en qué proyecto está.

## Tools a implementar

### MVP (primera iteración)

| Tool | Input | Qué hace |
|---|---|---|
| `create_note` | `titulo`, `contenido` | Crea una nota nueva en la subcarpeta correspondiente (resuelta según la lógica de detección de arriba), con frontmatter YAML (`proyecto`, `fecha`, `tags`) |
| `search_notes` | `query` | Busca texto/tags en todas las notas del vault |
| `read_note` | `path` | Devuelve el contenido de una nota puntual |
| `append_to_daily` | `contenido` | Agrega una entrada a la nota diaria de la fecha actual en `Daily/` |

### Iteraciones futuras (post-MVP)

- Búsqueda semántica sobre el vault (embeddings).
- Resolución de backlinks / grafo entre notas.
- Tool que resuma automáticamente una sesión completa como nota nueva al
  cerrar Claude Code.

## Stack técnico

- **Lenguaje**: TypeScript / Node.js
- **SDK**: `@modelcontextprotocol/sdk` (oficial de Anthropic)
- **Validación de inputs**: `zod`
- **Transporte**: `stdio` (server local, sin red, sin auth — Claude Code lo
  levanta como subproceso)
- **Testing**: `@modelcontextprotocol/inspector` para probar cada tool de
  forma aislada antes de conectar el server real

## Configuración

Variable de entorno que resuelve el path del vault (nunca hardcodeada en el
código, para que el proyecto sea portable):

```
OBSIDIAN_VAULT_PATH=/home/simon/MCP
```

Registro en la config global de Claude Code (no en un `.mcp.json` por
proyecto — debe estar disponible en cualquier carpeta desde la que se abra
`claude`):

```json
{
  "mcpServers": {
    "obsidian-vault": {
      "command": "node",
      "args": ["/ruta/a/mcp-obsidian-server/dist/index.js"],
      "env": { "OBSIDIAN_VAULT_PATH": "/home/simon/MCP" }
    }
  }
}
```

## Portabilidad

- El **repo del server** (código) se sube a GitHub como proyecto genérico,
  sin datos personales — cualquiera podría clonarlo y usarlo con su propio
  vault.
- El **vault** (datos) nunca va en el mismo repo. Queda local en la máquina,
  referenciado solo por la variable de entorno `OBSIDIAN_VAULT_PATH`.
- Para portar el sistema a otra máquina: clonar el repo, instalar
  dependencias, compilar, y apuntar la variable de entorno al vault de esa
  máquina (nuevo o sincronizado).

## Roadmap de implementación

1. Setup del proyecto (`npm init`, dependencias, estructura de carpetas).
2. Implementar `create_note` primero (incluye la lógica de detección de
   proyecto/fallback a `Sistema/`).
3. Probar con MCP Inspector.
4. Implementar `search_notes`, `read_note`, `append_to_daily` — una por vez,
   probando cada una antes de sumar la siguiente.
5. Conectar a la config global de Claude Code recién cuando todas las tools
   del MVP estén probadas.
6. Documentar en README con arquitectura y demo.
7. Iterar con features post-MVP.
