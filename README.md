# mcp-obsidian-server

Servidor [MCP](https://modelcontextprotocol.io) que le da a **Claude Code** memoria persistente entre sesiones de trabajo, usando un vault de [Obsidian](https://obsidian.md) como bitácora. En lugar de perder el contexto al cerrar la terminal, cada sesión puede leer y escribir notas `.md` reales en un vault que vivís y editás vos mismo.

Detecta automáticamente en qué proyecto estás trabajando (según el directorio desde el que se abrió Claude Code) y guarda las notas en la subcarpeta correspondiente, sin que tengas que indicarlo a mano.

## Características

- **Detección automática de proyecto**: resuelve la subcarpeta del vault según el `cwd` desde el que se lanzó Claude Code — `Proyectos/<nombre-carpeta>` para cualquier proyecto, o `Sistema/` si se abrió directamente desde `$HOME` (troubleshooting general, no ligado a un proyecto puntual).
- **Notas con frontmatter YAML**: cada nota se crea con metadata (`proyecto`, `fecha`, `tags`) lista para explorar y filtrar en Obsidian.
- **Búsqueda de texto libre**: busca en todas las notas del vault, con filtro opcional por tag y fragmentos de contexto alrededor de cada coincidencia.
- **Bitácora diaria**: agrega entradas a una nota del día (`Daily/YYYY-MM-DD.md`), acumulando a lo largo de la jornada sin pisar lo anterior.
- **Transporte stdio**: corre como subproceso local de Claude Code — sin red, sin autenticación, sin dependencias externas más allá del filesystem.
- **Vault separado del código**: el server es un proyecto genérico y portable; tus notas nunca se suben al repo.

## Herramientas (MCP tools)

| Tool | Input | Descripción |
|---|---|---|
| `create_note` | `titulo`, `contenido`, `tags?` | Crea una nota nueva en la subcarpeta que corresponde según el proyecto activo, con frontmatter YAML. |
| `search_notes` | `query`, `tag?` | Busca texto (case-insensitive) en todas las notas del vault, con fragmento de contexto por match. |
| `read_note` | `path` | Devuelve el contenido completo de una nota, dado el path relativo que devuelve `search_notes`. |
| `append_to_daily` | `contenido` | Agrega una entrada a la nota diaria de hoy, separada por hora; la crea si todavía no existe. |

Cada tool incluye una descripción orientada a Claude con las frases disparadoras que la activan (p. ej. *"guardá una nota de..."*, *"buscá en mis notas sobre..."*), para que el modelo la use sin necesidad de invocarla explícitamente por nombre.

## Estructura del vault

```
<OBSIDIAN_VAULT_PATH>/
├── Proyectos/
│   ├── <nombre-proyecto-1>/
│   │   └── YYYY-MM-DD-titulo-sesion.md
│   └── <nombre-proyecto-2>/
│       └── YYYY-MM-DD-titulo-sesion.md
├── Sistema/
│   └── YYYY-MM-DD-titulo-problema.md
└── Daily/
    └── YYYY-MM-DD.md
```

El vault contiene únicamente notas — nunca el código de tus proyectos, que sigue viviendo en su propio repo sin relación de ubicación con el vault.

## Requisitos

- Node.js 18 o superior
- Un vault de Obsidian (o simplemente una carpeta) donde el server pueda leer y escribir archivos `.md`

## Instalación

```bash
git clone https://github.com/simoncastelli/mcp-obsidian-server.git
cd mcp-obsidian-server
npm install
npm run build
```

## Configuración

El path del vault se resuelve siempre desde una variable de entorno — nunca está hardcodeado en el código, para que el proyecto sea portable entre máquinas.

```bash
cp .env.example .env
```

```
OBSIDIAN_VAULT_PATH=/ruta/absoluta/a/tu/vault
```

### Registrar el server en Claude Code

Agregalo a la configuración global de Claude Code (no a un `.mcp.json` por proyecto, para que esté disponible sin importar desde qué carpeta abras `claude`):

```json
{
  "mcpServers": {
    "obsidian-vault": {
      "command": "node",
      "args": ["/ruta/absoluta/a/mcp-obsidian-server/dist/index.js"],
      "env": { "OBSIDIAN_VAULT_PATH": "/ruta/absoluta/a/tu/vault" }
    }
  }
}
```

## Uso

Una vez registrado, no hace falta invocar las tools por nombre — simplemente pedile a Claude Code cosas como:

- *"Anotá que resolvimos el bug de autenticación cambiando el timeout del token."*
- *"¿Qué hicimos la semana pasada con el deploy de staging?"*
- *"Agregá al diario de hoy que arranqué a migrar la base de datos."*
- *"Mostrame la nota completa donde documentamos el setup de Hyprland."*

Claude Code decide sola cuándo usar `create_note`, `search_notes`, `read_note` o `append_to_daily` según la intención del pedido.

## Desarrollo

```bash
npm run dev         # corre el server con tsx (sin compilar)
npm run build        # compila TypeScript a dist/
npm start             # corre la build compilada
npm run inspector    # abre MCP Inspector contra el server compilado, para probar cada tool de forma aislada
```

## Stack técnico

- **TypeScript** sobre **Node.js**
- [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) — SDK oficial de MCP
- [`zod`](https://zod.dev) — validación de inputs de cada tool
- Transporte `stdio`, testing con [`@modelcontextprotocol/inspector`](https://github.com/modelcontextprotocol/inspector)

## Roadmap

- Búsqueda semántica sobre el vault (embeddings).
- Resolución de backlinks / grafo entre notas.
- Tool que resuma automáticamente una sesión completa como nota nueva al cerrar Claude Code.

Ver [`SPEC.md`](./SPEC.md) para el diseño detallado del proyecto.

## Licencia

MIT
