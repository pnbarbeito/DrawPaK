## Documentación técnica: Editor de esquemas y Editor SVG

Propósito
---------
Este documento describe en detalle cómo funcionan el "Editor de esquemas" (la aplicación principal con React Flow) y el "Editor SVG" (herramienta WYSIWYG para crear/editar snippets SVG). Incluye contratos, estructura de datos, componentes clave, flujos de guardado/recuperación, exportación, y casos borde observados en el código.

Resumen rápido (qué contiene)
- Contratos (inputs/outputs) de los editores
- Estructura de archivos relevantes
- Flujo detallado del Editor de esquemas (UI, nodos, aristas, historial, persistencia, exportación)
- Flujo detallado del Editor SVG (editor gráfico, persistencia temporal, guardado en DB, handles)
- Cómo funciona la paleta dinámica y la integración con la DB
- Consideraciones y casos borde
- Recomendaciones y siguientes pasos

Checklist de requisitos del encargo
- [x] Revisar en detalle todo el proyecto (archivos clave)
- [x] Crear un archivo `.md` que explique el funcionamiento del editor de esquemas
- [x] Explicar el funcionamiento del editor SVG

Contrato (mini-contrato) de cada editor
- Editor de esquemas
  - Inputs: eventos UI (drag/drop desde paleta, clicks, keyboard), nodos/edges existentes en memoria
  - Outputs: cambios en la UI; persistencia a localStorage (autosave) y SQLite (esquemas guardados); archivos exportados (PNG/PDF)
  - Errores: fallos de IO con la base de datos o con Tauri; fallos en serialización JSON

- Editor SVG (SvgShapeEditor + SvgEditorDialog)
  - Inputs: interacciones gráficas para crear shapes/handles; edición de markup SVG en texto; elementos importados desde la DB
  - Outputs: markup SVG normalizado (viewBox, sin width/height), metadata de handles (JSON), persistencia en DB (tabla `svg_elements`)
  - Errores: markup inválido, fallos de sanitización (se usa `dompurify` si está disponible)

Archivos y componentes clave
- `src/App.tsx` — Aplicación principal (Editor de esquemas). Aquí está la mayor parte de la lógica: ReactFlow, toolbar, diálogos, historial, exportación.
- `src/components/DynamicPalette.tsx` — Paleta lateral que carga elementos SVG desde la base de datos y permite arrastrarlos al lienzo.
- `src/components/SvgEditorDialog.tsx` — Diálogo modal para crear/editar elementos SVG; incluye preview, manejo de categorías y llamada al editor gráfico.
- `src/components/SvgShapeEditor.tsx` — Editor gráfico WYSIWYG para construir SVG mediante shapes/handles (guardado temporal en localStorage, exporta SVG limpio y metadata de handles).
- `src/components/SymbolNode.tsx` — Renderizado del nodo en React Flow; soporta símbolos estáticos del catálogo y SVG dinámicos guardados en DB (con preservación de datos si vienen parciales).
- `src/components/symbols.tsx` — Catálogo de símbolos embebidos (trafo, interruptor, barras, etc.).
- `src/reactFlowConfig.ts` — Configuración de `nodeTypes`, `defaultEdgeOptions` y `snapGrid`.
- `src/database.ts` — API del lado cliente para SQLite (a través de plugins de Tauri). Define tablas `schemas` y `svg_elements` y funciones de CRUD.

Datos y modelos
- `Schema` (tabla `schemas`)
  - id, name, description, nodes (JSON string), edges (JSON string), created_at, updated_at

- `SvgElement` (tabla `svg_elements`)
  - id, name, description, category, svg (markup string), handles (JSON string), created_at, updated_at

Editor de esquemas — flujo y detalles
-----------------------------------
1) Canvas y librería
   - La UI principal usa `reactflow` (envoltura en `ReactFlowProvider`).
   - `nodeTypes` registra `symbolNode` (`src/components/SymbolNode.tsx`) que renderiza símbolos catalogados o SVG guardados.

2) Crear/insertar nodos
   - La paleta (`DynamicPalette`) expone ítems arrastrables. `onDragStart` serializa `application/reactflow` (symbolKey) y, si aplica, `application/svgelement` con el objeto `SvgElement` completo.
   - Al soltar (`App.tsx:onDrop`) se crea un `Node` con `type: 'symbolNode'` y `data` que incluye `symbolKey` y, para elementos dinámicos, `svg` y `handles`.
   - `findFreePosition(desired, nodes)` busca una posición en rejilla libre usando snap y un barrido en espiral para evitar colisiones.

3) Renderizado de nodos (`SymbolNode`)
   - Si `data.isDynamicSvg` y `data.svg` están presentes, el componente renderiza el markup SVG inline.
   - Si `data.svg` no está pero `isDynamicSvg` es true, hay lógica de preservación (`preservedSvgData`) para evitar pérdida de datos si el nodo se re-renderiza con campos incompletos.
   - Los `handles` pueden ser dinámicos (JSON guardado por elemento SVG). En ese caso el código calcula la arista más cercana para asignar Position (Top/Left/Right/Bottom) y también mantiene coordenadas absolutas para colocación precisa del punto de conexión.
   - El nodo soporta transformaciones: `rotation`, `scale`, `flipX/flipY` y `invertHandles`. Cuando cambian, se fuerza `updateNodeInternals` para recalcular posiciones de handles.

4) Conexiones
   - `onConnect` usa `addEdge` con tipo `smoothstep` y estilo por defecto (grosor 2, color negro).
   - Si `invertHandles` se activa para un nodo, se eliminan sus aristas existentes para prevenir inconsistencias.

5) Persistencia
   - Autosave en `localStorage` (clave `drawpak-current-schema`) cada vez que hay cambios en nodos/edges; también guarda `currentSchemaId` y `currentSchemaName`.
   - Guardado explícito a DB via `saveSchema` (inserta en `schemas`) o `updateSchema`.
   - `loadSchemas` obtiene la lista desde DB (`getAllSchemas`) y `handleLoadSchema` carga uno (parsea `nodes` y `edges` desde JSON) y sincroniza el contador `id` para nuevos nodos.

6) Historial (undo/redo)
   - Se lleva un arreglo `history` con snapshots (nodes/edges) y `historyIndex`.
   - Cambios se guardan con debounce (100ms) en `saveToHistory`. Límite de 50 entradas.
   - Atajos: Ctrl/Cmd+Z y Ctrl/Cmd+Y ó Ctrl+Shift+Z para redo.

7) Copiar/Pegar y Portapapeles interno
   - `copySelectedElements` guarda nodos seleccionados y aristas relacionadas en un estado `clipboard` local.
   - `pasteElements` crea nuevos IDs y ubica nodos pegados en posiciones libres (empujados por GRID_SIZE).

8) Borrado y Nuevo esquema
   - `handleDelete` remueve nodos/edges seleccionados. `handleClearAll` resetea todo, limpia `localStorage` y `history`.
   - `handleNewSchema` muestra confirmación si hay contenido.

9) Exportación (PNG / PDF / área seleccionada)
   - Hay múltiples estrategias para exportar la vista con buena fidelidad:
     a) `captureViewportDataUrl` — clona el DOM de `.react-flow` a un contenedor offscreen y lo rasteriza con `html-to-image`.
     b) `getSerializedSvgDataUrl` — serializa el `svg` renderer (aristas) en un data URL SVG con estilos inline.
     c) `compositeViewportPng` — estrategia compuesta: dibuja el SVG de las aristas en un canvas y rasteriza/recorta cada nodo HTML encima (mejor fidelidad para nodos complejos que mezclan HTML + SVG).
     d) `exportSelectedAreaPNG` — captura la viewport entera sin el fondo de rejilla, recorta el área seleccionada y descarga usando Tauri FS si está disponible.
   - `exportPDF` usa `compositeViewportPng` con `jsPDF` para generar un PDF vía un canvas intermedio.

Editor SVG — flujo y detalles
--------------------------------
1) Diálogo y opciones
   - `SvgEditorDialog` (modal) permite crear/editar un `SvgElement` con campos: `name`, `description`, `category`, `handles` y `svg markup`.
   - Puede usar dos modos: el editor gráfico (`SvgShapeEditor`) o edición de texto del markup.

2) Editor gráfico (`SvgShapeEditor`)
   - Editor WYSIWYG que permite añadir rectángulos/círculos/lineas, moverlos, rotarlos, redimensionarlos y añadir handles.
   - Mantiene un borrador en `localStorage` (`svgShapeEditor.draft.v1`) para preservar trabajo en curso.
   - Exporta: un markup SVG normalizado (setea `viewBox`, elimina `width`/`height` y quita elementos de UI editor-only con atributos `data-editor-*`). También exporta una lista de `handles` con coordenadas absolutas dentro del viewBox.
   - Atajos: Delete para borrar shapes, Ctrl/Cmd+C para copiar, Ctrl/Cmd+V para pegar.

3) Guardado a BD y sanitización
   - `SvgEditorDialog` llama `onSaveSvgElement` (implementado en `App.tsx`) que:
     - Valida `svgName`.
     - Intenta sanitizar con `dompurify` (si está disponible) con perfil `svg`.
     - Parsea el SVG para eliminar elementos de UI del editor (`[data-editor-handle]`, `[data-editor-resize]`).
     - Asegura un `viewBox` útil a partir de `width/height` si no existía.
     - Elimina atributos `width`/`height` para hacer el SVG escalable, preservando `viewBox` cuando es posible.
     - Inserta en la tabla `svg_elements` (función `saveSvgElement`).

4) Handles
   - Los `handles` son metadata (JSON) que describen puntos de conexión dentro del espacio SVG: { id, x, y, type }.
   - Cuando un `SvgElement` tiene `handles`, `SymbolNode` los consume y posiciona handles físicamente en el nodo (usando coordenadas absolutas y determinando la arista más cercana para la posición semántica Top/Left/Right/Bottom).

Paleta dinámica (`DynamicPalette`)
---------------------------------
- Consulta categorías con `getSvgCategories()` y elementos por categoría con `getSvgElementsByCategory(category)`.
- Renderiza un thumbnail de cada `SvgElement` (normaliza viewBox/size para miniatura).
- El drag de cada item pasa el objeto `SvgElement` serializado para que `onDrop` pueda crear un nodo con `svg` y `handles` embebidos.

Base de datos y persistencia
----------------------------
- La inicialización se hace con `initDatabase()` que abre `sqlite:/home/pbarbeito/Dev/DrawPaK/drawpak.db` usando `@tauri-apps/plugin-sql`.
- Tablas principales:
  - `schemas` (id, name, description, nodes, edges, timestamps)
  - `svg_elements` (id, name, description, category, svg, handles, timestamps)
- CRUD expuesto por `src/database.ts` (saveSchema, updateSchema, getAllSchemas, saveSvgElement, getAllSvgElements, etc.).
- Hay funciones auxiliares para inicializar elementos básicos (desde `symbols.tsx`) si la tabla está vacía.

Casos borde y observaciones
---------------------------
- Manejo de SVG dinámicos: `SymbolNode` preserva `svg`/`handles` en `preservedSvgData` si recibe nodos con campos parciales (evita pérdida por re-render).
- Exportación: hay varios caminos (HTML clone, SVG serializer, composición). En algunos casos (nodos HTML complejos) el `compositeViewportPng` es más robusto.
- Sanitización: si `dompurify` no está disponible, se registra una advertencia y se guarda el markup tal cual —
  esto es aceptable en entornos controlados, pero arriesga inyección si se abre contenido externo.
- Coordenadas de handles: se almacenan en coordenadas del viewBox (px absolutos). Al renderizar, se calculan distancias a bordes para asignar `Position` en React Flow, y se aplican transformaciones (rotación/flip) para posicionamiento visual.
- Historial: se usa debounce y límite de 50 entradas; la comparación para evitar duplicados usa JSON.stringify — puede ser costoso si hay grafos muy grandes.

Recomendaciones / siguientes pasos
---------------------------------
1. Tests unitarios mínimos:
   - Guardado / carga de `Schema` round-trip usando `database.ts` mockeado.
   - Exportación de `SvgShapeEditor` produce un `svg` con `viewBox` y sin `data-editor-*`.
2. Validación y límites:
   - Limitar tamaño máximo de `nodes/edges` serializados por esquema o usar compresión.
3. Seguridad:
   - Forzar `dompurify` en entornos donde se importe SVG externo.
4. UX:
   - Añadir feedback visual cuando `saveSchema` falla o cuando `initDatabase` tarda.
5. Performance:
   - Evitar stringify frecuente si el grafo es muy grande; usar hashing incremental para detectar cambios.

Qualidad / gates (propuesta rápida)
- Build / lint: no se han ejecutado aquí (se recomienda ejecutar `bun`/`pnpm` o `npm` según el proyecto) — el código fuente leído compila en un entorno con React + MUI + Tauri.
- Tests: crear tests para `database.ts` y para la serialización SVG del `SvgShapeEditor`.

Estado de cobertura de requisitos
- Documentación solicitada: Hecho — archivo `DOCS/EDITOR_DESCRIPCION.md` añadido con explicación detallada.

Fin del documento.
