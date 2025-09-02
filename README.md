## DrawPaK — editor de diagramas y elementos SVG

Proyecto de escritorio híbrido (Tauri + React + TypeScript) para crear y editar esquemas y símbolos SVG.

Este repositorio contiene la interfaz en React (Vite/TypeScript) y el backend nativo empaquetado con Tauri (Rust). Incluye un editor de esquemas basado en React Flow y un editor WYSIWYG para crear/editar elementos SVG reutilizables.

## Contenido rápido
- Frontend: React + TypeScript + Vite
- UI: MUI (Material UI)
- Canvas/Diagrama: React Flow con nodos personalizados
- Persistencia local: SQLite vía plugin Tauri (tauri-plugin-sql) + drafts en localStorage
- Backend nativo: Tauri (Rust) para empaquetado y APIs nativas

## Requisitos
- Node (u otro gestor JS). El repo incluye `bun.lock` si prefieres Bun.
- Rust toolchain (stable) — Tauri requiere una versión reciente; se recomienda Rust >= 1.77.2.
- Tauri CLI (opcional para desarrollo integrado).

## Instalación y desarrollo (ejemplos en fish)

1) Instalar dependencias (elige tu gestor):

```fish
# con Bun
bun install

# o con npm
npm install

# o con pnpm
pnpm install
```

2) Ejecutar en modo desarrollo:

```fish
# frontend (Vite)
npm run dev

# abrir la aplicación Tauri (desde la raíz del repo)
# usa Bun si lo prefieres: bun tauri dev
bun tauri dev

# alternativamente, con npm (requiere que 'tauri' esté disponible en PATH)
npm run tauri dev
```

3) Compilar release (build integrado):

```fish
# compilar frontend
npm run build

# compilar bundle Tauri (release)
bun tauri build
```

Notas:
- Si usas `bun`, algunos comandos de ecosistema JS funcionan ligeramente distinto; los scripts en `package.json` siguen disponibles.
- Asegúrate de tener las dependencias nativas de Tauri instaladas (ver la guía oficial de Tauri para tu SO).

## Estructura del repositorio

Raíz:
- `package.json`, `bun.lock`, `vite.config.ts`, `tsconfig.json` — configuración frontend.
- `README.md`, `LICENSE` — documentación y licencia.

Carpeta `src/` (frontend):
- `main.tsx`, `App.tsx` — punto de entrada y estado global de la app.
- `database.ts` — envoltorio para llamadas al plugin SQL de Tauri y funciones de inicialización.
- `reactFlowConfig.ts` — utilidades y configuración para React Flow.
- `components/` — UI y editores:
	- `SvgShapeEditor.tsx` — editor WYSIWYG SVG (drag/handles/z-order/opacity).
	- `SvgEditorDialog.tsx` — diálogo/modal para crear/editar elementos SVG (integra `SvgShapeEditor`).
	- `SymbolNode.tsx` — nodo personalizado para React Flow (posicionamiento de handles, soporte de escala).
	- `DynamicPalette.tsx` — paleta dinámica de símbolos guardados (recarga automática cuando se añaden nuevos elementos).
	- `symbols.tsx` — símbolos y utilidades de importación/exportación.

Carpeta `src-tauri/` (backend Rust/Tauri):
- `Cargo.toml`, `src/` — código Rust para la app nativa y plugins registrados.
- `gen/schemas/` — manifiestos y esquemas embebidos usados por la app.

## Componentes clave y flujo de datos

- Editor de esquemas: usa React Flow; los nodos representan símbolos SVG y están renderizados con `SymbolNode`.
- Editor SVG: WYSIWYG que edita una lista de `shapes` (rect, circle, line) y metadata (nombre, descripción, canvas w/h). El editor guarda drafts en `localStorage` y exporta SVG serializado al guardar.
- Persistencia: los elementos SVG guardados se almacenan en la base SQLite (accedida por `src/database.ts` vía plugin SQL de Tauri). La paleta dinámica escucha eventos `svg-elements-updated` para refrescarse.

## Importar/exportar SVG

- El editor intenta mapear elementos SVG comunes (rect, circle, line, polyline y ciertos `path`) a formas editables. Hay heurísticas para transformar `polyline`/`path` simples en líneas.
- Antes de exportar, se limpian los elementos y atributos del editor (handles, guías) para producir un SVG listo para uso.

## Licencia

Este proyecto se publica bajo Apache License 2.0. Consulta el archivo `LICENSE` para el texto completo. Algunas dependencias usan MIT o están dual-licenciadas (MIT/Apache); elegir Apache-2.0 para el proyecto es compatible con ellas.

## Contribuir

1) Abre un issue describiendo el cambio o bug.
2) Crea una rama: `git checkout -b feat/mi-mejora`.
3) Añade tests mínimos si corresponde y verifica que la app corre en desarrollo.
4) Crea PR apuntando a `main` con una descripción clara.

Directrices:
- Mantén las dependencias actualizadas y evita introducir paquetes con licencias restrictivas sin revisión.
- Respeta el formato de código existente; se recomienda usar el formateador del proyecto (prettier/eslint si estuvieran configurados).

## Problemas comunes y soluciones rápidas

- Error al iniciar Tauri: verifica que Rust y `tauri-cli` estén instalados y en PATH. Revisa que `rustup` tenga toolchain estable e instala dependencias de sistema (libgtk, libwebkit2gtk, etc.) según tu distribución.
- Dependencias que fallan al instalar: intenta alternar entre `bun install` o `npm install`. Borra `node_modules` y reinstala si persisten problemas.

## Publicar en GitHub / Releases

- Añade `LICENSE` (ya está incluido). Considera agregar `NOTICE` si necesitas atribuciones de terceros.
- Crear etiquetas (`git tag vX.Y.Z`) y GitHub Release con binarios generados por `bun tauri build`.

## Próximos pasos recomendados

- Añadir un `NOTICE` si quieres incluir atribuciones concretas (puedo generarlo con tu nombre y año).
- Escribir tests unitarios para el editor SVG (importación/exportación) y añadir un pipeline CI básico.

Si quieres, actualizo el `README` con más detalles técnicos (diagramas de componentes, contratos de datos) o creo automáticamente un `NOTICE` con tu nombre como copyright.
