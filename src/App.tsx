import React, { useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
    ReactFlowProvider,
    addEdge,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    ConnectionLineType,
    Node,
    OnConnect,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './App.css';
import DynamicPalette from './components/DynamicPalette';
import { nodeTypes, defaultEdgeOptions, snapGrid } from './reactFlowConfig';
import { initDatabase, saveSchema, getAllSchemas, deleteSchema, duplicateSchema, updateSchema, Schema, saveSvgElement, getAllSvgElements, deleteSvgElement, SvgElement, getSvgCategories } from './database';
import SvgEditorDialog from './components/SvgEditorDialog';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
// Tauri APIs (optional)
let tauriDialog: any = null;
let tauriFs: any = null;
// Try dynamic import when running inside Tauri
const tryLoadTauri = async () => {
    try {
        // Use Tauri v2 plugin package names (plugin-dialog, plugin-fs)
        // concatenate strings so Vite doesn't try to resolve them at build time
        const dialogMod = await import('@tauri-apps' + '/plugin-dialog');
        const fsMod = await import('@tauri-apps' + '/plugin-fs');
        tauriDialog = dialogMod;
        tauriFs = fsMod;
    } catch (e) {
        // ignore when running in plain web (no Tauri runtime)
    }
};
// kick off load attempt
tryLoadTauri();
import { Box, AppBar, Toolbar, IconButton, Typography, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemText, ListItemSecondaryAction, Checkbox, FormControlLabel } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import FlipIcon from '@mui/icons-material/Flip';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import CropFreeIcon from '@mui/icons-material/CropFree';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import MergeTypeIcon from '@mui/icons-material/MergeType';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
let id = 0;
const getId = (): string => `node_${id++}`;

const GRID_SIZE = 20;
function snapToGridPos(
    pos: { x: number; y: number },
    gridSize = GRID_SIZE,
) {
    return {
        x: Math.round(pos.x / gridSize) * gridSize,
        y: Math.round(pos.y / gridSize) * gridSize,
    };
}

// Función centralizada para encontrar una posición libre
function findFreePosition(
    desiredPosition: { x: number; y: number },
    nodes: Node<any>[],
    excludeNodeId?: string,
    gridSize = GRID_SIZE
): { x: number; y: number } {
    const isPositionOccupied = (pos: { x: number; y: number }) => {
        return nodes.some(node => 
            node.id !== excludeNodeId && 
            node.position.x === pos.x && 
            node.position.y === pos.y
        );
    };

    let position = snapToGridPos(desiredPosition, gridSize);
    
    // Si la posición deseada está libre, usarla
    if (!isPositionOccupied(position)) {
        return position;
    }

    // Buscar en espiral alrededor de la posición deseada
    const maxRadius = 10; // Máximo 10 celdas de radio
    for (let radius = 1; radius <= maxRadius; radius++) {
        // Probar posiciones en un patrón en espiral
        const directions = [
            { x: gridSize, y: 0 },      // derecha
            { x: 0, y: gridSize },      // abajo
            { x: -gridSize, y: 0 },     // izquierda
            { x: 0, y: -gridSize },     // arriba
            { x: gridSize, y: gridSize }, // diagonal inferior derecha
            { x: -gridSize, y: gridSize }, // diagonal inferior izquierda
            { x: -gridSize, y: -gridSize }, // diagonal superior izquierda
            { x: gridSize, y: -gridSize }   // diagonal superior derecha
        ];

        for (const direction of directions) {
            const candidatePos = {
                x: position.x + (direction.x * radius),
                y: position.y + (direction.y * radius)
            };
            
            if (!isPositionOccupied(candidatePos)) {
                return candidatePos;
            }
        }
    }

    // Si no se encuentra posición libre, devolver la original con un desplazamiento aleatorio
    return {
        x: position.x + (Math.random() * 4 - 2) * gridSize,
        y: position.y + (Math.random() * 4 - 2) * gridSize
    };
}

function FlowApp(): React.ReactElement {
    // Tipado específico para los datos de nodo/edge en esta app
    type ElectNodeData = { 
        label: string; 
        rotation?: number; 
        scale?: number; 
        flipX?: boolean; 
        flipY?: boolean; 
        invertHandles?: boolean;
        symbolKey?: string;
        isDynamicSvg?: boolean;
        svg?: string;
        handles?: string;
    };
    type ElectEdgeData = Record<string, unknown>;

    const reactFlowWrapper = useRef<HTMLDivElement | null>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState<ElectNodeData>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<ElectEdgeData>([]);
    
    // Clipboard para copiar/pegar nodos
    const [clipboard, setClipboard] = React.useState<{ nodes: Node<ElectNodeData>[]; edges: any[] } | null>(null);
    
    // Estado para la selección de área de exportación
    const [isSelectingExportArea, setIsSelectingExportArea] = React.useState(false);
    const [exportArea, setExportArea] = React.useState<{ x: number; y: number; width: number; height: number } | null>(null);
    const [isDrawingArea, setIsDrawingArea] = React.useState(false);
    const [areaStart, setAreaStart] = React.useState<{ x: number; y: number } | null>(null);
    const [showBackground, setShowBackground] = React.useState(true);
    const [lastSaved, setLastSaved] = React.useState<Date | null>(null);
    
    // Estado para historial de deshacer/rehacer
    const [history, setHistory] = React.useState<Array<{ nodes: Node<ElectNodeData>[]; edges: any[] }>>([]);
    const [historyIndex, setHistoryIndex] = React.useState(-1);
    const [isUndoRedoAction, setIsUndoRedoAction] = React.useState(false);
    
    // Estado para gestión de esquemas
    const [showSchemasDialog, setShowSchemasDialog] = React.useState(false);
    const [showSvgDialog, setShowSvgDialog] = React.useState(false);
    const [svgElements, setSvgElements] = React.useState<SvgElement[]>([]);
    const [svgCategories, setSvgCategories] = React.useState<string[]>([]);
    const [svgName, setSvgName] = React.useState('');
    const [svgDescription, setSvgDescription] = React.useState('');
    const [svgCategory, setSvgCategory] = React.useState('custom');
    const [svgMarkup, setSvgMarkup] = React.useState('');
    const [svgHandles, setSvgHandles] = React.useState('');
    const [sanitizedSvg, setSanitizedSvg] = React.useState('');
    const [useEditor, setUseEditor] = React.useState(true);

    React.useEffect(() => {
        let mounted = true;
        (async () => {
            if (!svgMarkup) {
                if (mounted) setSanitizedSvg('');
                return;
            }
            try {
                const DOMPurifyModule = await import('dompurify');
                const DOMPurify = (DOMPurifyModule && (DOMPurifyModule as any).default) || DOMPurifyModule;
                const safe = DOMPurify.sanitize(svgMarkup, { USE_PROFILES: { svg: true } });
                if (mounted) setSanitizedSvg(safe);
            } catch (e) {
                console.warn('dompurify not available, using raw svg markup for preview', e);
                if (mounted) setSanitizedSvg(svgMarkup);
            }
        })();
        return () => { mounted = false; };
    }, [svgMarkup]);
    const [showSaveDialog, setShowSaveDialog] = React.useState(false);
    const [schemas, setSchemas] = React.useState<Schema[]>([]);
    const [schemaName, setSchemaName] = React.useState('');
    const [schemaDescription, setSchemaDescription] = React.useState('');
    const [isTemplate, setIsTemplate] = React.useState(false);
    const [currentSchemaId, setCurrentSchemaId] = React.useState<number | null>(null); // ID del esquema actual en edición
    const [currentSchemaName, setCurrentSchemaName] = React.useState<string>(''); // Nombre del esquema actual en edición
    const [isHandlingNewSchema, setIsHandlingNewSchema] = React.useState(false); // Para prevenir ejecuciones múltiples
    const [showNewSchemaConfirm, setShowNewSchemaConfirm] = React.useState(false); // Diálogo de confirmación para nuevo esquema

    // Inicializar la base de datos al cargar la aplicación
    React.useEffect(() => {
        initDatabase().catch(error => {
            console.error('Error inicializando la base de datos:', error);
        });
    }, []);

    // cargar elementos svg guardados
    const loadSvgElements = useCallback(async () => {
        try {
            const elems = await getAllSvgElements();
            setSvgElements(elems);
        } catch (e) {
            console.error('Error cargando svg elements', e);
        }
    }, []);

    // cargar categorías disponibles
    const loadSvgCategories = useCallback(async () => {
        try {
            const categories = await getSvgCategories();
            setSvgCategories(categories);
        } catch (e) {
            console.error('Error cargando categorías', e);
        }
    }, []);

    // Usamos el editor interno SvgShapeEditor en lugar de cargar librerías externas
    React.useEffect(() => {
        if (showSvgDialog) {
            // aseguramos que el toggle de uso de editor gráfico esté activo por defecto
            setUseEditor(true);
        }
    }, [showSvgDialog]);

    // Funciones para manejar esquemas
    const loadSchemas = useCallback(async () => {
        try {
            const allSchemas = await getAllSchemas();
            setSchemas(allSchemas);
        } catch (error) {
            console.error('Error cargando esquemas:', error);
        }
    }, []);

    const handleSaveSchema = useCallback(async () => {
        try {
            // Si hay un esquema actual en edición, actualizarlo directamente
            if (currentSchemaId) {
                await updateSchema(currentSchemaId, {
                    nodes: JSON.stringify(nodes),
                    edges: JSON.stringify(edges),
                });
                
                // Actualizar localStorage
                saveToLocalStorage(nodes, edges, currentSchemaId, currentSchemaName);
                
                await loadSchemas();
                alert('Esquema actualizado correctamente');
                return;
            }
            
            // Si no hay esquema actual, pedir nombre para crear uno nuevo
            if (!schemaName.trim()) {
                alert('Por favor ingresa un nombre para el esquema');
                return;
            }

            const newSchemaId = await saveSchema({
                name: schemaName,
                description: schemaDescription,
                nodes: JSON.stringify(nodes),
                edges: JSON.stringify(edges),
            });

            // Establecer el nuevo esquema como actual
            setCurrentSchemaId(newSchemaId);
            
            // Actualizar localStorage con el nuevo ID
            saveToLocalStorage(nodes, edges, newSchemaId, schemaName);

            setShowSaveDialog(false);
            setSchemaName('');
            setSchemaDescription('');
            setIsTemplate(false);
            await loadSchemas();
            alert('Esquema guardado correctamente');
        } catch (error) {
            console.error('Error guardando esquema:', error);
            alert('Error al guardar el esquema');
        }
    }, [schemaName, schemaDescription, nodes, edges, isTemplate, loadSchemas, currentSchemaId, setCurrentSchemaId]);

    // Guardar elemento SVG en DB
    const handleSaveSvgElement = useCallback(async () => {
        try {
            if (!svgName.trim()) {
                alert('Ingresa un nombre para el elemento SVG');
                return;
            }

            // Sanitizar markup antes de guardar
            // dompurify se importará dinámicamente para evitar problemas en build web
            let DOMPurify: any = null;
            try {
                DOMPurify = (await import('dompurify')).default;
            } catch (e) {
                // fallback: no sanitizar (en entornos controlados esto no debería pasar)
                console.warn('dompurify no disponible, guardando sin sanitizar');
            }

            // Primera sanitización/entrada
            let sanitized = DOMPurify ? DOMPurify.sanitize(svgMarkup, { USE_PROFILES: { svg: true } }) : svgMarkup;

            // Limpieza adicional: eliminar elementos de la UI del editor antes de persistir
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(sanitized || '', 'image/svg+xml');
                const svgEl = doc.querySelector('svg');
                if (svgEl) {
                    // remover nodos de editor si quedaron (handles temporales y rects de redimension)
                    svgEl.querySelectorAll('[data-editor-handle="true"], [data-editor-resize="true"]').forEach(n => n.remove());

                    // intentar asegurar un viewBox útil: si no tiene, pero tiene width/height, derivarlo
                    const hasViewBox = svgEl.hasAttribute('viewBox') && svgEl.getAttribute('viewBox')?.trim() !== '';
                    const wAttr = svgEl.getAttribute('width');
                    const hAttr = svgEl.getAttribute('height');
                    if (!hasViewBox && wAttr && hAttr) {
                        const pw = parseFloat(wAttr.toString().replace(/[^0-9.\-]/g, ''));
                        const ph = parseFloat(hAttr.toString().replace(/[^0-9.\-]/g, ''));
                        if (!isNaN(pw) && !isNaN(ph) && pw > 0 && ph > 0) {
                            svgEl.setAttribute('viewBox', `0 0 ${pw} ${ph}`);
                        }
                    }

                    // eliminar width/height para que el SVG sea escalable (guardamos viewBox cuando sea posible)
                    svgEl.removeAttribute('width');
                    svgEl.removeAttribute('height');

                    const serializer = new XMLSerializer();
                    sanitized = serializer.serializeToString(svgEl);
                } else {
                    // si no encontramos <svg>, no convertir
                    // sanitized permanece como estaba
                }
            } catch (e) {
                console.warn('Error limpiando SVG antes de guardar:', e);
            }

            const elem: SvgElement = {
                name: svgName,
                description: svgDescription,
                category: svgCategory,
                svg: sanitized,
                handles: svgHandles || ''
            };

            await saveSvgElement(elem);
            setShowSvgDialog(false);
            setSvgName('');
            setSvgDescription('');
            setSvgCategory('custom');
            setSvgMarkup('');
            setSvgHandles('');
            await loadSvgElements();
            alert('Elemento SVG guardado correctamente');
        } catch (e) {
            console.error('Error guardando svg element', e);
            alert('Error guardando elemento SVG');
        }
    }, [svgName, svgDescription, svgMarkup, svgHandles, loadSvgElements]);

    // Función para manejar el clic del botón guardar
    const handleSaveButtonClick = useCallback(() => {
        // Si hay un esquema actual, guardar directamente sin abrir diálogo
        if (currentSchemaId) {
            handleSaveSchema();
        } else {
            // Si no hay esquema actual, abrir diálogo para pedir nombre
            setShowSaveDialog(true);
        }
    }, [currentSchemaId, handleSaveSchema]);

    const handleLoadSchema = useCallback(async (schema: Schema) => {
        try {
            const parsedNodes = JSON.parse(schema.nodes);
            const parsedEdges = JSON.parse(schema.edges);
            
            setNodes(parsedNodes);
            setEdges(parsedEdges);
            setShowSchemasDialog(false);
            
            // Establecer el ID del esquema actual para futuras actualizaciones
            setCurrentSchemaId(schema.id || null);
            setCurrentSchemaName(schema.name || '');
            
            // Guardar en localStorage con el ID del esquema
            saveToLocalStorage(parsedNodes, parsedEdges, schema.id || null, schema.name);
            
            // Sincronizar el contador de ID con los nodos cargados
            let maxId = 0;
            for (const node of parsedNodes) {
                const match = node.id?.toString().match(/node_(\d+)/);
                if (match) {
                    maxId = Math.max(maxId, Number(match[1]));
                }
            }
            id = maxId + 1;
        } catch (error) {
            console.error('Error cargando esquema:', error);
            alert('Error al cargar el esquema');
        }
    }, [setNodes, setEdges, setCurrentSchemaId, setCurrentSchemaName]);

    // Función para importar elementos de un esquema al esquema actual
    const handleImportSchema = useCallback(async (schema: Schema) => {
        try {
            const parsedNodes = JSON.parse(schema.nodes);
            const parsedEdges = JSON.parse(schema.edges);
            
            // Crear un mapa de IDs antiguos a nuevos para evitar conflictos
            const nodeIdMap = new Map<string, string>();
            
            // Generar nuevos IDs para los nodos importados y encontrar posiciones libres
            const newNodes = parsedNodes.map((node: any) => {
                const newId = `node_${id++}`;
                nodeIdMap.set(node.id, newId);
                
                // Usar findFreePosition para evitar colisiones
                const desiredPosition = {
                    x: node.position.x + 100, // Offset inicial
                    y: node.position.y + 100
                };
                const freePosition = findFreePosition(desiredPosition, nodes);
                
                return {
                    ...node,
                    id: newId,
                    selected: false, // Deseleccionar nodos importados
                    position: freePosition
                };
            });
            
            // Actualizar IDs en las conexiones importadas
            const newEdges = parsedEdges
                .filter((edge: any) => nodeIdMap.has(edge.source) && nodeIdMap.has(edge.target))
                .map((edge: any) => ({
                    ...edge,
                    id: `edge_${nodeIdMap.get(edge.source)}_${nodeIdMap.get(edge.target)}`,
                    source: nodeIdMap.get(edge.source),
                    target: nodeIdMap.get(edge.target),
                    selected: false
                }));
            
            // Agregar los nuevos elementos al esquema actual
            const updatedNodes = [...nodes, ...newNodes];
            const updatedEdges = [...edges, ...newEdges];
            
            setNodes(updatedNodes);
            setEdges(updatedEdges);
            setShowSchemasDialog(false);
            
        } catch (error) {
            console.error('Error importando esquema:', error);
            alert('Error al importar el esquema');
        }
    }, [nodes, edges, setNodes, setEdges]);

    const handleDeleteSchema = useCallback(async (schemaId: number, schemaName: string) => {
        if (window.confirm(`¿Estás seguro de que quieres eliminar el esquema "${schemaName}"?`)) {
            try {
                await deleteSchema(schemaId);
                await loadSchemas();
                alert('Esquema eliminado correctamente');
            } catch (error) {
                console.error('Error eliminando esquema:', error);
                alert('Error al eliminar el esquema');
            }
        }
    }, [loadSchemas]);

    const handleDuplicateSchema = useCallback(async (schemaId: number, originalName: string) => {
        const newName = prompt(`Ingresa el nombre para la copia de "${originalName}":`, `${originalName} (copia)`);
        if (newName && newName.trim()) {
            try {
                await duplicateSchema(schemaId, newName.trim());
                await loadSchemas();
                alert('Esquema duplicado correctamente');
            } catch (error) {
                console.error('Error duplicando esquema:', error);
                alert('Error al duplicar el esquema');
            }
        }
    }, [loadSchemas]);

    // Constantes para localStorage
    const STORAGE_KEY = 'drawpak-current-schema';
    const CURRENT_SCHEMA_KEY = 'drawpak-current-schema-id';

    // Funciones de persistencia
    const saveToLocalStorage = useCallback((currentNodes: Node<ElectNodeData>[], currentEdges: any[], schemaId: number | null = null, schemaName: string = '') => {
        try {
            const schemaData = {
                nodes: currentNodes,
                edges: currentEdges,
                timestamp: Date.now(),
                currentSchemaId: schemaId || currentSchemaId,
                currentSchemaName: schemaName || currentSchemaName
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(schemaData));
            
            // Guardar también el ID del esquema actual por separado
            if (schemaId !== null || currentSchemaId !== null) {
                localStorage.setItem(CURRENT_SCHEMA_KEY, String(schemaId || currentSchemaId));
            } else {
                localStorage.removeItem(CURRENT_SCHEMA_KEY);
            }
            
            setLastSaved(new Date());
        } catch (error) {
            console.error('Error guardando en localStorage:', error);
        }
    }, [currentSchemaId, currentSchemaName]);

    const loadFromLocalStorage = useCallback(() => {
        try {
            const savedData = localStorage.getItem(STORAGE_KEY);
            const savedSchemaId = localStorage.getItem(CURRENT_SCHEMA_KEY);
            
            if (savedData) {
                const schemaData = JSON.parse(savedData);
                
                // Establecer el ID del esquema actual si existe
                if (savedSchemaId) {
                    setCurrentSchemaId(Number(savedSchemaId));
                } else if (schemaData.currentSchemaId) {
                    setCurrentSchemaId(schemaData.currentSchemaId);
                }
                
                // Establecer el nombre del esquema actual si existe
                if (schemaData.currentSchemaName) {
                    setCurrentSchemaName(schemaData.currentSchemaName);
                }
                
                return {
                    nodes: schemaData.nodes || [],
                    edges: schemaData.edges || [],
                    currentSchemaId: Number(savedSchemaId) || schemaData.currentSchemaId || null,
                    currentSchemaName: schemaData.currentSchemaName || ''
                };
            }
        } catch (error) {
            console.error('Error cargando desde localStorage:', error);
        }
        return { nodes: [], edges: [], currentSchemaId: null, currentSchemaName: '' };
    }, []);

    // Cargar esquema al inicializar la aplicación
    React.useEffect(() => {
        const { nodes: savedNodes, edges: savedEdges, currentSchemaId: savedSchemaId, currentSchemaName: savedSchemaName } = loadFromLocalStorage();
        if (savedNodes.length > 0 || savedEdges.length > 0) {
            setNodes(savedNodes);
            setEdges(savedEdges);
            
            // Establecer el ID del esquema actual si existe
            if (savedSchemaId) {
                setCurrentSchemaId(savedSchemaId);
            }
            
            // Establecer el nombre del esquema actual si existe
            if (savedSchemaName) {
                setCurrentSchemaName(savedSchemaName);
            }
            
            // Sincronizar el contador de ID con los nodos cargados
            let maxId = 0;
            for (const node of savedNodes) {
                const match = node.id?.toString().match(/node_(\d+)/);
                if (match) {
                    maxId = Math.max(maxId, Number(match[1]));
                }
            }
            id = maxId + 1;
            
            // Inicializar historial con el estado cargado (después de un breve delay)
            setTimeout(() => {
                const initialState = {
                    nodes: JSON.parse(JSON.stringify(savedNodes)),
                    edges: JSON.parse(JSON.stringify(savedEdges))
                };
                setHistory([initialState]);
                setHistoryIndex(0);
                lastNodesRef.current = JSON.stringify(savedNodes);
                lastEdgesRef.current = JSON.stringify(savedEdges);
            }, 100);
        } else {
            // Si no hay datos guardados, inicializar historial vacío
            setHistory([]);
            setHistoryIndex(-1);
        }
    }, [loadFromLocalStorage, setNodes, setEdges]);

    // Guardar automáticamente cuando cambien los nodos o edges
    React.useEffect(() => {
        if (nodes.length > 0 || edges.length > 0) {
            saveToLocalStorage(nodes, edges, currentSchemaId, currentSchemaName);
        }
    }, [nodes, edges, saveToLocalStorage, currentSchemaId, currentSchemaName]);

    // Funciones de historial para deshacer/rehacer
    const saveToHistory = useCallback((currentNodes: Node<ElectNodeData>[], currentEdges: any[]) => {
        setHistory(prevHistory => {
            // Crear una copia profunda del estado actual
            const newState = {
                nodes: JSON.parse(JSON.stringify(currentNodes)),
                edges: JSON.parse(JSON.stringify(currentEdges))
            };
            
            // Verificar si el estado actual es diferente al último en el historial
            if (prevHistory.length > 0) {
                const lastState = prevHistory[prevHistory.length - 1];
                if (JSON.stringify(lastState.nodes) === JSON.stringify(newState.nodes) && 
                    JSON.stringify(lastState.edges) === JSON.stringify(newState.edges)) {
                    return prevHistory; // No hay cambios, no guardar
                }
            }
            
            // Si estamos en medio del historial, descartar todo lo que está después del índice actual
            const currentHistoryIndex = historyIndex;
            const newHistory = prevHistory.slice(0, currentHistoryIndex + 1);
            newHistory.push(newState);
            
            // Limitar el historial a los últimos 50 estados para evitar problemas de memoria
            if (newHistory.length > 50) {
                newHistory.shift();
                setHistoryIndex(prev => Math.max(0, prev - 1));
                return newHistory;
            }
            
            setHistoryIndex(newHistory.length - 1);
            return newHistory;
        });
    }, [historyIndex]);

    const undo = useCallback(() => {
        if (historyIndex > 0) {
            setIsUndoRedoAction(true);
            const previousState = history[historyIndex - 1];
            
            // Limpiar cualquier timeout pendiente de guardar historial
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
            }
            
            setNodes(previousState.nodes);
            setEdges(previousState.edges);
            setHistoryIndex(historyIndex - 1);
            
            // Actualizar las referencias para evitar que se guarde nuevamente
            lastNodesRef.current = JSON.stringify(previousState.nodes);
            lastEdgesRef.current = JSON.stringify(previousState.edges);
            
            // Resetear la bandera después de un breve delay
            setTimeout(() => setIsUndoRedoAction(false), 50);
        }
    }, [historyIndex, history, setNodes, setEdges]);

    const redo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            setIsUndoRedoAction(true);
            const nextState = history[historyIndex + 1];
            
            // Limpiar cualquier timeout pendiente de guardar historial
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
            }
            
            setNodes(nextState.nodes);
            setEdges(nextState.edges);
            setHistoryIndex(historyIndex + 1);
            
            // Actualizar las referencias para evitar que se guarde nuevamente
            lastNodesRef.current = JSON.stringify(nextState.nodes);
            lastEdgesRef.current = JSON.stringify(nextState.edges);
            
            // Resetear la bandera después de un breve delay
            setTimeout(() => setIsUndoRedoAction(false), 50);
        }
    }, [historyIndex, history, setNodes, setEdges]);

    // Guardar en historial cuando cambien los nodos o edges (pero no durante undo/redo)
    const lastNodesRef = React.useRef<string>('');
    const lastEdgesRef = React.useRef<string>('');
    const saveTimeoutRef = React.useRef<number | null>(null);
    
    React.useEffect(() => {
        if (isUndoRedoAction) return;
        
        const nodesStr = JSON.stringify(nodes);
        const edgesStr = JSON.stringify(edges);
        
        // Solo guardar si realmente hay cambios
        if (nodesStr !== lastNodesRef.current || edgesStr !== lastEdgesRef.current) {
            // Limpiar timeout anterior si existe
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            
            // Debounce para evitar demasiadas entradas en el historial
            saveTimeoutRef.current = setTimeout(() => {
                // Verificar otra vez si no estamos en una operación de undo/redo
                if (!isUndoRedoAction) {
                    if (nodes.length > 0 || edges.length > 0 || lastNodesRef.current !== '' || lastEdgesRef.current !== '') {
                        saveToHistory(nodes, edges);
                    }
                    lastNodesRef.current = nodesStr;
                    lastEdgesRef.current = edgesStr;
                }
            }, 100); // Reducir el tiempo de debounce a 100ms
        }
        
        // Cleanup del timeout al desmontar
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [nodes, edges, saveToHistory, isUndoRedoAction]);

    // Agregar atajos de teclado para undo/redo
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z' && !e.shiftKey) {
                    e.preventDefault();
                    undo();
                } else if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
                    e.preventDefault();
                    redo();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    const onConnect: OnConnect = useCallback((params) => {
        // Ensure connections align with grid by using SmoothStep lines
        const newEdge = {
            ...params,
            type: 'smoothstep',
            style: {
                strokeWidth: 2,
                stroke: '#000000' // Color negro por defecto
            },
        };
        setEdges((eds) => addEdge(newEdge, eds));
    }, [setEdges]);

    const handleDelete = useCallback(() => {
        // Remove selected nodes and edges. Also remove edges connected to removed nodes.
        let removedNodeIds: string[] = [];
        setNodes((nds) => {
            removedNodeIds = nds.filter((n) => n.selected).map((n) => n.id);
            return nds.filter((n) => !n.selected);
        });

        setEdges((eds) => eds.filter((e) => !e.selected && !removedNodeIds.includes(e.source) && !removedNodeIds.includes(e.target)));
    }, [setNodes, setEdges]);

    const handleClearAll = useCallback(() => {
        console.log('🗑️ handleClearAll ejecutándose...', {
            timestamp: new Date().toISOString(),
            stackTrace: new Error().stack?.split('\n').slice(1, 5).join('\n')
        });
        
        // Clear all nodes and edges
        setNodes([]);
        setEdges([]);
        // Reset ID counter
        id = 0;
        // Limpiar el esquema actual
        setCurrentSchemaId(null);
        setCurrentSchemaName('');
        // Limpiar también el localStorage
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(CURRENT_SCHEMA_KEY);
            console.log('✅ localStorage limpiado');
        } catch (error) {
            console.error('Error limpiando localStorage:', error);
        }
        // Limpiar historial
        setHistory([]);
        setHistoryIndex(-1);
        console.log('🎯 handleClearAll completado');
    }, [setNodes, setEdges, setCurrentSchemaId, setCurrentSchemaName]);

    const handleNewSchema = useCallback(() => {
        if (isHandlingNewSchema) {
            console.log('⚠️ handleNewSchema ya se está ejecutando, ignorando...');
            return;
        }
        
        console.log('🆕 Botón Nuevo Esquema presionado', { 
            nodes: nodes.length, 
            edges: edges.length,
            currentSchemaId,
            currentSchemaName 
        });
        
        // Solo mostrar confirmación si hay contenido
        if (nodes.length > 0 || edges.length > 0) {
            console.log('⚠️ Hay contenido, mostrando diálogo de confirmación...');
            setShowNewSchemaConfirm(true);
        } else {
            // Si no hay contenido, limpiar directamente
            console.log('ℹ️ No hay contenido, limpiando directamente');
            handleClearAll();
        }
    }, [nodes.length, edges.length, currentSchemaId, currentSchemaName, handleClearAll, isHandlingNewSchema]);

    const confirmNewSchema = useCallback(() => {
        console.log('✅ Usuario confirmó crear nuevo esquema');
        setShowNewSchemaConfirm(false);
        setIsHandlingNewSchema(false);
        handleClearAll();
    }, [handleClearAll]);

    const cancelNewSchema = useCallback(() => {
        console.log('❌ Usuario canceló crear nuevo esquema');
        setShowNewSchemaConfirm(false);
        setIsHandlingNewSchema(false);
    }, []);

    // Funciones de copiar y pegar
    const copySelectedElements = useCallback(() => {
        const selectedNodes = nodes.filter(node => node.selected);
        const selectedNodeIds = selectedNodes.map(node => node.id);
        const selectedEdges = edges.filter(edge => 
            selectedNodeIds.includes(edge.source) && selectedNodeIds.includes(edge.target)
        );
        
        if (selectedNodes.length > 0) {
            setClipboard({ nodes: selectedNodes, edges: selectedEdges });
            console.log(`Copiados ${selectedNodes.length} nodos y ${selectedEdges.length} conexiones`);
        }
    }, [nodes, edges, setClipboard]);

    const pasteElements = useCallback(() => {
        if (!clipboard || clipboard.nodes.length === 0) return;

        // Mapeo para nuevos IDs
        const idMapping: Record<string, string> = {};
        
        // Crear nuevos nodos con IDs únicos y posiciones libres
        const newNodes = clipboard.nodes.map(node => {
            const newId = getId();
            idMapping[node.id] = newId;
            
            // Posición deseada (desplazada de la original)
            const desiredPosition = {
                x: node.position.x + GRID_SIZE * 2,
                y: node.position.y + GRID_SIZE * 2
            };
            
            // Encontrar una posición libre
            const freePosition = findFreePosition(desiredPosition, nodes);
            
            return {
                ...node,
                id: newId,
                position: freePosition,
                selected: true // Seleccionar los elementos pegados
            };
        });

        // Crear nuevas conexiones entre los nodos copiados
        const newEdges = clipboard.edges.map(edge => ({
            ...edge,
            id: `edge_${Date.now()}_${Math.random()}`,
            source: idMapping[edge.source],
            target: idMapping[edge.target]
        }));

        // Deseleccionar elementos existentes y agregar los nuevos
        setNodes(nds => nds.map(n => ({ ...n, selected: false })).concat(newNodes));
        setEdges(eds => eds.concat(newEdges));

        console.log(`Pegados ${newNodes.length} nodos y ${newEdges.length} conexiones`);
    }, [clipboard, setNodes, setEdges, nodes]);

    // Función helper para exportar sin fondo de puntos
    const exportWithoutBackground = async (exportFunction: () => Promise<string | null>): Promise<string | null> => {
        // Desactivar el fondo temporalmente
        setShowBackground(false);
        
        // Esperar un frame para que se actualice la UI
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        try {
            // Realizar la exportación
            const result = await exportFunction();
            return result;
        } finally {
            // Reactivar el fondo
            setShowBackground(true);
        }
    };

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            // If focus is inside an editable field, don't intercept Delete/Backspace so the user can edit text
            const active = document.activeElement as HTMLElement | null;
            const isEditable = active && (
                active.tagName === 'INPUT' ||
                active.tagName === 'TEXTAREA' ||
                active.isContentEditable
            );

            // Delete or Backspace -> only when not editing text
            if (!isEditable && (event.key === 'Delete' || event.key === 'Backspace')) {
                // Prevent navigation on Backspace
                event.preventDefault();
                handleDelete();
                return;
            }

            // Ctrl+C para copiar -> if not editing
            if (!isEditable && event.ctrlKey && event.key === 'c') {
                event.preventDefault();
                copySelectedElements();
                return;
            }

            // Ctrl+V para pegar -> if not editing
            if (!isEditable && event.ctrlKey && event.key === 'v') {
                event.preventDefault();
                pasteElements();
                return;
            }
        };

        // use capture phase so other layers (like ReactFlow) don't stop the event before we see it
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [handleDelete, copySelectedElements, pasteElements]);



    // Drag handlers for palette items
    const onDragStart = (event: React.DragEvent, symbolKey: string, svgElement?: SvgElement) => {
        event.dataTransfer.setData('application/reactflow', symbolKey);
        if (svgElement) {
            event.dataTransfer.setData('application/svgelement', JSON.stringify(svgElement));
        }
        event.dataTransfer.effectAllowed = 'move';
    };

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();
            if (!reactFlowWrapper.current) return;

            const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
            const symbolKey = event.dataTransfer.getData('application/reactflow');
            if (!symbolKey) return;

            const svgElementData = event.dataTransfer.getData('application/svgelement');
            let svgElement: SvgElement | null = null;
            
            console.log('🎯 onDrop received:', { symbolKey, svgElementData: !!svgElementData });
            
            try {
                if (svgElementData) {
                    svgElement = JSON.parse(svgElementData);
                    console.log('📦 Parsed svgElement:', {
                        id: svgElement?.id,
                        name: svgElement?.name,
                        hasSvg: !!svgElement?.svg,
                        svgLength: svgElement?.svg?.length,
                        hasHandles: !!svgElement?.handles
                    });
                }
            } catch (e) {
                console.warn('Error parsing SVG element data:', e);
            }

            const desiredPosition = {
                x: event.clientX - reactFlowBounds.left,
                y: event.clientY - reactFlowBounds.top,
            };

            // Encontrar una posición libre usando la función centralizada
            const position = findFreePosition(desiredPosition, nodes);

            const newNode: Node<any> = {
                id: getId(),
                position,
                type: 'symbolNode',
                data: svgElement ? {
                    symbolKey,
                    label: svgElement.name,
                    svg: svgElement.svg,
                    handles: svgElement.handles,
                    isDynamicSvg: true
                } : {
                    symbolKey,
                    label: symbolKey,
                    isDynamicSvg: false
                },
            };

            console.log('✨ Creating new node:', {
                id: newNode.id,
                type: newNode.type,
                dataKeys: Object.keys(newNode.data),
                isDynamicSvg: newNode.data.isDynamicSvg,
                hasSvg: !!newNode.data.svg,
                svgLength: newNode.data.svg?.length
            });
            
            setNodes((nds) => nds.concat(newNode));
        },
        [setNodes, nodes],
    );

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    // Handlers para la selección de área de exportación
    const handleCanvasMouseDown = useCallback((event: React.MouseEvent) => {
        if (!isSelectingExportArea || !reactFlowWrapper.current) return;
        
        // Prevenir el comportamiento por defecto de ReactFlow
        event.preventDefault();
        event.stopPropagation();
        
        const rect = reactFlowWrapper.current.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        setAreaStart({ x, y });
        setIsDrawingArea(true);
        setExportArea(null);
    }, [isSelectingExportArea]);

    const handleCanvasMouseMove = useCallback((event: React.MouseEvent) => {
        if (!isSelectingExportArea || !isDrawingArea || !areaStart || !reactFlowWrapper.current) return;
        
        // Prevenir el comportamiento por defecto de ReactFlow
        event.preventDefault();
        event.stopPropagation();
        
        const rect = reactFlowWrapper.current.getBoundingClientRect();
        const currentX = event.clientX - rect.left;
        const currentY = event.clientY - rect.top;
        
        const x = Math.min(areaStart.x, currentX);
        const y = Math.min(areaStart.y, currentY);
        const width = Math.abs(currentX - areaStart.x);
        const height = Math.abs(currentY - areaStart.y);
        
        setExportArea({ x, y, width, height });
    }, [isSelectingExportArea, isDrawingArea, areaStart]);

    const handleCanvasMouseUp = useCallback((event: React.MouseEvent) => {
        if (!isSelectingExportArea || !isDrawingArea) return;
        
        // Prevenir el comportamiento por defecto de ReactFlow
        event.preventDefault();
        event.stopPropagation();
        
        setIsDrawingArea(false);
        setAreaStart(null);
    }, [isSelectingExportArea, isDrawingArea]);

    // Función para iniciar la selección de área
    const startAreaSelection = useCallback(() => {
        setIsSelectingExportArea(true);
        setExportArea(null);
    }, []);

    // Función para cancelar la selección de área
    const cancelAreaSelection = useCallback(() => {
        setIsSelectingExportArea(false);
        setExportArea(null);
        setIsDrawingArea(false);
        setAreaStart(null);
    }, []);

    // Nueva función de exportación PNG con área seleccionada
    const exportSelectedAreaPNG = useCallback(async () => {
        if (!exportArea || !reactFlowWrapper.current) {
            alert('Primero selecciona un área para exportar');
            return;
        }

        try {
            // Capturar toda la viewport sin fondo de puntos
            const fullDataUrl = await exportWithoutBackground(async () => {
                return await toPng(reactFlowWrapper.current!, { 
                    cacheBust: true,
                    backgroundColor: '#ffffff'
                });
            });

            if (!fullDataUrl) return;

            // Crear un canvas temporal para capturar solo el área seleccionada
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Configurar el canvas con las dimensiones del área seleccionada
            const ratio = window.devicePixelRatio || 1;
            canvas.width = exportArea.width * ratio;
            canvas.height = exportArea.height * ratio;
            canvas.style.width = exportArea.width + 'px';
            canvas.style.height = exportArea.height + 'px';
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

            // Rellenar el fondo con blanco
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, exportArea.width, exportArea.height);
            
            // Crear una imagen con toda la viewport
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = reject;
                img.src = fullDataUrl;
            });

            // Dibujar solo la parte seleccionada en el canvas
            ctx.drawImage(
                img,
                exportArea.x, exportArea.y, exportArea.width, exportArea.height, // área fuente
                0, 0, exportArea.width, exportArea.height // área destino
            );

            // Convertir a PNG y descargar
            const croppedDataUrl = canvas.toDataURL('image/png');
            const bytes = dataUrlToUint8Array(croppedDataUrl);

            // Intentar guardar con Tauri
            if (tauriDialog && tauriFs) {
                try {
                    const path = await tauriDialog.save({ defaultPath: 'area_selected.png' });
                    if (path) {
                        await tauriFs.writeFile(path, bytes);
                        cancelAreaSelection();
                        return;
                    }
                } catch (err) {
                    console.error('Tauri save failed', err);
                }
            }

            // Fallback: descarga del navegador
            const a = document.createElement('a');
            a.href = croppedDataUrl;
            a.download = 'area_selected.png';
            a.click();
            
            cancelAreaSelection();
        } catch (error) {
            console.error('Error exporting selected area:', error);
            alert('Error al exportar el área seleccionada');
        }
    }, [exportArea, cancelAreaSelection, exportWithoutBackground]);

    const onNodeDragStop = useCallback((_: React.MouseEvent, node: Node<ElectNodeData>) => {
        // Encontrar una posición libre para el nodo arrastrado
        const freePosition = findFreePosition(node.position as { x: number; y: number }, nodes, node.id);

        // Ensure exact integer coordinates
        freePosition.x = Math.round(freePosition.x);
        freePosition.y = Math.round(freePosition.y);

        setNodes((nds) => nds.map((n) => (n.id === node.id ? { ...n, position: freePosition } : n)));

        // Force update of all edges to ensure they align properly
        setEdges((eds) => [...eds]);
    }, [setNodes, setEdges, nodes]);

    const dataUrlToUint8Array = (dataUrl: string) => {
        const base64 = dataUrl.split(',')[1];
        const binary = atob(base64);
        const len = binary.length;
        const arr = new Uint8Array(len);
        for (let i = 0; i < len; i++) arr[i] = binary.charCodeAt(i);
        return arr;
    };

    // SavedSvgPreview moved into SvgEditorDialog

    // Capture only the React Flow viewport by cloning it into an offscreen container.
    // This keeps nodes and edges (connections) but excludes UI overlays like palettes, toolbars, etc.
    const captureViewportDataUrl = async (): Promise<string | null> => {
        if (!reactFlowWrapper.current) return null;

        // prefer cloning the .react-flow root (it contains nodes and edges),
        // fall back to viewport or wrapper
        const original = (reactFlowWrapper.current.querySelector('.react-flow')
            ?? reactFlowWrapper.current.querySelector('.react-flow__viewport')
            ?? reactFlowWrapper.current) as HTMLElement | null;
        if (!original) return null;

        const rect = original.getBoundingClientRect();

        // Deep clone the viewport
        const clone = original.cloneNode(true) as HTMLElement;

        // Helper: copy computed styles from original tree to cloned tree
        const copyStylesRecursive = (src: Element, dst: Element) => {
            try {
                const s = window.getComputedStyle(src as Element);
                (dst as HTMLElement).style.cssText = s.cssText || '';
            } catch (e) {
                // ignore
            }
            // copy SVG presentation attributes (stroke, fill) if present
            try {
                for (let i = 0; i < src.attributes.length; i++) {
                    const attr = src.attributes[i];
                    // For presentation attrs, ensure they exist on dst
                    if (attr && attr.name && (attr.name === 'stroke' || attr.name === 'fill' || attr.name === 'stroke-width' || attr.name === 'd')) {
                        try { dst.setAttribute(attr.name, attr.value); } catch (e) { /* ignore */ }
                    }
                }
            } catch (e) { }

            const srcChildren = src.children || [];
            const dstChildren = dst.children || [];
            for (let i = 0; i < srcChildren.length; i++) {
                const sChild = srcChildren[i] as Element | undefined;
                const dChild = dstChildren[i] as Element | undefined;
                if (sChild && dChild) copyStylesRecursive(sChild, dChild);
            }
        };

        try {
            copyStylesRecursive(original, clone);
        } catch (e) {
            // ignore copy errors
        }

        // Prepare offscreen container
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = rect.width + 'px';
        container.style.height = rect.height + 'px';
        container.style.overflow = 'visible';
        container.style.background = 'transparent';

        // Normalize clone sizing so html-to-image captures correctly
        clone.style.width = rect.width + 'px';
        clone.style.height = rect.height + 'px';
        clone.style.maxWidth = 'none';
        clone.style.maxHeight = 'none';

        // Keep computed transform (scale/translate) so the visual layout matches
        try {
            const cs = window.getComputedStyle(original);
            const transform = cs.transform;
            if (transform && transform !== 'none') {
                clone.style.transform = transform;
                clone.style.transformOrigin = cs.transformOrigin || '0 0';
            }
        } catch (e) {
            // ignore
        }

        container.appendChild(clone);
        document.body.appendChild(container);

        try {
            // allow one animation frame for styles and SVG to settle
            await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
            const dataUrl = await toPng(clone as HTMLElement, { 
                cacheBust: true,
                backgroundColor: '#ffffff'
            });
            return dataUrl;
        } finally {
            // cleanup
            try { document.body.removeChild(container); } catch (e) { /* ignore */ }
        }
    };

    // Serialize renderer SVG (edges/nodes) with inline styles to an SVG data URL
    const getSerializedSvgDataUrl = async (): Promise<string | null> => {
        if (!reactFlowWrapper.current) return null;
        const svgEl = (reactFlowWrapper.current.querySelector('.react-flow__renderer svg')
            ?? reactFlowWrapper.current.querySelector('svg')) as SVGElement | null;
        if (!svgEl) return null;

        const clone = svgEl.cloneNode(true) as SVGElement;

        const inlineStyles = (src: Element, dst: Element) => {
            try {
                const cs = window.getComputedStyle(src as Element);
                let cssText = '';
                for (let i = 0; i < cs.length; i++) {
                    const prop = cs[i];
                    const val = cs.getPropertyValue(prop);
                    cssText += `${prop}:${val};`;
                }
                (dst as HTMLElement).setAttribute('style', cssText);
            } catch (e) { /* ignore */ }
            const sChildren = src.children || [];
            const dChildren = dst.children || [];
            for (let i = 0; i < sChildren.length; i++) {
                const sC = sChildren[i] as Element | undefined;
                const dC = dChildren[i] as Element | undefined;
                if (sC && dC) inlineStyles(sC, dC);
            }
        };

        try { inlineStyles(svgEl, clone); } catch (e) { /* ignore */ }

        if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        try {
            const vb = svgEl.getAttribute('viewBox');
            if (vb && !clone.getAttribute('viewBox')) clone.setAttribute('viewBox', vb);
            const w = svgEl.getAttribute('width') || String(svgEl.clientWidth);
            const h = svgEl.getAttribute('height') || String(svgEl.clientHeight);
            if (w && !clone.getAttribute('width')) clone.setAttribute('width', String(w));
            if (h && !clone.getAttribute('height')) clone.setAttribute('height', String(h));
        } catch (e) { }

        const serialized = new XMLSerializer().serializeToString(clone);
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(serialized);
    };

    // Convert an SVG data URL into a PNG data URL by drawing it onto a canvas
    const svgDataUrlToPngDataUrl = async (svgDataUrl: string): Promise<string> => {
        return new Promise(async (resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const ratio = window.devicePixelRatio || 1;
                    const w = img.width;
                    const h = img.height;
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(w * ratio);
                    canvas.height = Math.round(h * ratio);
                    canvas.style.width = w + 'px';
                    canvas.style.height = h + 'px';
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return reject(new Error('no-canvas-ctx'));
                    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                } catch (err) { reject(err); }
            };
            img.onerror = (e) => reject(e);
            img.src = svgDataUrl;
        });
    };

    // Composite export: draw SVG (edges) then rasterize each HTML node and draw on top
    const compositeViewportPng = async (): Promise<string | null> => {
        if (!reactFlowWrapper.current) return null;
        const root = (reactFlowWrapper.current.querySelector('.react-flow')
            ?? reactFlowWrapper.current.querySelector('.react-flow__viewport')
            ?? reactFlowWrapper.current) as HTMLElement | null;
        if (!root) return null;

        const rect = root.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(rect.width * ratio);
        canvas.height = Math.round(rect.height * ratio);
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

        // Rellenar el fondo con blanco
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, rect.width, rect.height);

        // draw edges (SVG) first
        try {
            const svgUrl = await getSerializedSvgDataUrl();
            if (svgUrl) {
                await new Promise<void>((res, rej) => {
                    const img = new Image();
                    img.onload = () => { try { ctx.drawImage(img, 0, 0, rect.width, rect.height); res(); } catch (e) { rej(e); } };
                    img.onerror = rej;
                    img.src = svgUrl;
                });
            }
        } catch (e) {
            // ignore svg draw errors
            console.warn('Error drawing svg', e);
        }

        // produce a nodes-only raster by cloning root and removing the SVG renderer from the clone
        try {
            const clone = root.cloneNode(true) as HTMLElement;
            // remove svg renderer from clone so only nodes remain
            const svgInClone = clone.querySelector('.react-flow__renderer svg') ?? clone.querySelector('svg');
            if (svgInClone && svgInClone.parentNode) svgInClone.parentNode.removeChild(svgInClone);

            // place clone in an offscreen container
            const off = document.createElement('div');
            off.style.position = 'fixed';
            off.style.left = '-9999px';
            off.style.top = '0';
            off.style.width = rect.width + 'px';
            off.style.height = rect.height + 'px';
            off.style.overflow = 'visible';
            off.style.background = 'transparent';
            clone.style.width = rect.width + 'px';
            clone.style.height = rect.height + 'px';
            off.appendChild(clone);
            document.body.appendChild(off);

            // allow styles to settle
            await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
            const nodesOnlyDataUrl = await toPng(clone as HTMLElement, { 
                cacheBust: true,
                backgroundColor: '#ffffff'
            });
            // draw nodes image on top of edges
            await new Promise<void>((res, rej) => {
                const img = new Image();
                img.onload = () => { try { ctx.drawImage(img, 0, 0, rect.width, rect.height); res(); } catch (e) { rej(e); } };
                img.onerror = rej;
                img.src = nodesOnlyDataUrl;
            });

            try { document.body.removeChild(off); } catch (e) { /* ignore */ }
        } catch (e) {
            console.warn('Failed to create nodes-only raster via clone', e);
            // fallback: try rasterizing individual nodes
            const nodeEls = Array.from(root.querySelectorAll('.react-flow__node')) as HTMLElement[];
            console.debug('[export] compositeViewportPng rootRect=', rect, 'nodeCount=', nodeEls.length);
            for (const nodeEl of nodeEls) {
                try {
                    const nRect = nodeEl.getBoundingClientRect();
                    const dx = nRect.left - rect.left;
                    const dy = nRect.top - rect.top;
                    console.debug('[export] node', nodeEl.getAttribute('data-id') || nodeEl.id, 'rect=', nRect, 'dx,dy=', dx, dy);
                    const imgDataUrl = await toPng(nodeEl as HTMLElement, { 
                        cacheBust: true,
                        backgroundColor: '#ffffff'
                    });
                    await new Promise<void>((res, rej) => {
                        const img = new Image();
                        img.onload = () => { try { ctx.drawImage(img, dx, dy, nRect.width, nRect.height); res(); } catch (e) { rej(e); } };
                        img.onerror = rej;
                        img.src = imgDataUrl;
                    });
                } catch (e) {
                    console.warn('Failed to rasterize node', e);
                }
            }
        }

        return canvas.toDataURL('image/png');
    };

    const exportPDF = async () => {
        if (!reactFlowWrapper.current) return;
        // Prefer composite export (SVG edges + rasterized nodes) for best fidelity
        let dataUrl: string | null = null;
        try {
            dataUrl = await compositeViewportPng();
        } catch (e) { console.warn('composite export failed', e); }
        if (!dataUrl) {
            try {
                const svgUrl = await getSerializedSvgDataUrl();
                if (svgUrl) dataUrl = await svgDataUrlToPngDataUrl(svgUrl);
            } catch (e) {
                console.warn('SVG export failed, falling back to DOM clone export', e);
            }
        }
        if (!dataUrl) dataUrl = await captureViewportDataUrl();
        if (!dataUrl) return;
        const img = new Image();
        img.src = dataUrl;
        await img.decode();
        const w = img.width;
        const h = img.height;
        const pdf = new jsPDF({ unit: 'px', format: [w, h] });
        pdf.addImage(dataUrl, 'PNG', 0, 0, w, h);
        const arrayBuffer = pdf.output('arraybuffer');
        const bytes = new Uint8Array(arrayBuffer);

        if (tauriDialog && tauriFs) {
            try {
                const path = await tauriDialog.save({ defaultPath: 'diagram.pdf' });
                if (path) {
                    await tauriFs.writeFile(path, bytes);
                    return;
                }
            } catch (err) {
                console.error('Tauri save failed', err);
            }
        }

        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'diagram.pdf';
        a.click();
        URL.revokeObjectURL(url);
    };

    // Selection controls for rotate/scale
    const selectedNode = nodes.find((n) => n.selected);
    const updateSelectedNodeData = (patch: Partial<any>) => {
        if (!selectedNode) return;
        
        // Si estamos invirtiendo handles, romper todas las conexiones del elemento
        if (patch.invertHandles !== undefined) {
            const nodeId = selectedNode.id;
            
            // Eliminar todas las conexiones que involucren este nodo
            setEdges((currentEdges) => 
                currentEdges.filter((edge) => 
                    edge.source !== nodeId && edge.target !== nodeId
                )
            );
        }
        
        setNodes((nds) => nds.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, ...(patch) } } : n)));
    };

    return (
        <Box sx={{ height: 'calc(100vh - 17px)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <AppBar position="static">
                <Toolbar variant="dense">
                    <IconButton color="inherit" onClick={handleNewSchema} title="Nuevo esquema">
                        <AddIcon />
                    </IconButton>
                    <IconButton color="inherit" onClick={undo} disabled={historyIndex <= 0} title={`Deshacer (Ctrl+Z) - ${historyIndex}/${history.length}`}>
                        <UndoIcon />
                    </IconButton>
                    <IconButton color="inherit" onClick={redo} disabled={historyIndex >= history.length - 1} title={`Rehacer (Ctrl+Y) - ${historyIndex}/${history.length}`}>
                        <RedoIcon />
                    </IconButton>
                    <IconButton color="inherit" onClick={handleSaveButtonClick} title={currentSchemaId ? "Actualizar esquema" : "Guardar esquema"}>
                        <SaveIcon />
                    </IconButton>
                    <IconButton color="inherit" onClick={() => { loadSchemas(); setShowSchemasDialog(true); }} title="Cargar esquema">
                        <FolderOpenIcon />
                    </IconButton>
                    <Typography variant="h6" sx={{ flexGrow: 1, textAlign: 'center' }}>
                        Editor de esquemas{currentSchemaName ? `: ${currentSchemaName}` : ': Nuevo'}
                        {lastSaved && (
                            <Typography variant="caption" display="block" sx={{ fontSize: '0.6rem', opacity: 0.7 }}>
                                Guardado automáticamente: {lastSaved.toLocaleTimeString()}
                            </Typography>
                        )}
                    </Typography>
                    <IconButton color="inherit" onClick={copySelectedElements} title="Copiar elementos seleccionados (Ctrl+C)">
                        <ContentCopyIcon />
                    </IconButton>
                    <IconButton color="inherit" onClick={() => { loadSvgElements(); loadSvgCategories(); setShowSvgDialog(true); }} title="Elementos SVG">
                        <EditIcon />
                    </IconButton>
                    <IconButton color="inherit" onClick={pasteElements} title="Pegar elementos (Ctrl+V)" disabled={!clipboard || clipboard.nodes.length === 0}>
                        <ContentPasteIcon />
                    </IconButton>
                    {!isSelectingExportArea ? (
                        <>
                            <IconButton color="inherit" onClick={startAreaSelection} title="Seleccionar área para exportar PNG">
                                <CropFreeIcon />
                            </IconButton>
                        </>
                    ) : (
                        <>
                            <IconButton color="inherit" onClick={exportSelectedAreaPNG} title="Exportar área seleccionada" disabled={!exportArea}>
                                <CheckIcon />
                            </IconButton>
                            <IconButton color="inherit" onClick={cancelAreaSelection} title="Cancelar selección">
                                <CloseIcon />
                            </IconButton>
                        </>
                    )}
                    <IconButton color="inherit" onClick={exportPDF} title="Exportar PDF">
                        <PictureAsPdfIcon />
                    </IconButton>
                </Toolbar>
            </AppBar>
            <Box 
                ref={reactFlowWrapper} 
                style={{ 
                    flex: 1, 
                    position: 'relative',
                    cursor: isSelectingExportArea ? 'crosshair' : 'default'
                }}
                onMouseDown={isSelectingExportArea ? handleCanvasMouseDown : undefined}
                onMouseMove={isSelectingExportArea ? handleCanvasMouseMove : undefined}
                onMouseUp={isSelectingExportArea ? handleCanvasMouseUp : undefined}
            >
                <ReactFlowProvider>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeDragStop={onNodeDragStop}
                        snapToGrid={true}
                        snapGrid={snapGrid}
                        connectionLineType={ConnectionLineType.SmoothStep}
                        defaultEdgeOptions={defaultEdgeOptions}
                        nodeTypes={nodeTypes}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        fitView
                        attributionPosition="bottom-left"
                        connectOnClick={false}
                        elementsSelectable={!isSelectingExportArea}
                        panOnDrag={!isSelectingExportArea}
                        zoomOnScroll={!isSelectingExportArea}
                        zoomOnPinch={!isSelectingExportArea}
                        zoomOnDoubleClick={!isSelectingExportArea}
                    >
                        <MiniMap />
                        <Controls />
                        {showBackground && <Background gap={GRID_SIZE} />}
                    </ReactFlow>
                </ReactFlowProvider>
                
                {/* Overlay para mostrar el área de selección */}
                {isSelectingExportArea && exportArea && (
                    <Box
                        style={{
                            position: 'absolute',
                            left: exportArea.x,
                            top: exportArea.y,
                            width: exportArea.width,
                            height: exportArea.height,
                            border: '2px dashed #2196f3',
                            backgroundColor: 'rgba(33, 150, 243, 0.1)',
                            pointerEvents: 'none',
                            zIndex: 1000
                        }}
                    />
                )}
                
                {/* Instrucciones para la selección de área */}
                {isSelectingExportArea && (
                    <Box
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            background: 'rgba(0, 0, 0, 0.8)',
                            color: 'white',
                            padding: '16px',
                            borderRadius: '8px',
                            textAlign: 'center',
                            zIndex: 1001,
                            pointerEvents: 'none'
                        }}
                    >
                        <Typography variant="h6" style={{ marginBottom: '8px' }}>
                            Seleccionar área para exportar
                        </Typography>
                        <Typography variant="body2">
                            Arrastra para dibujar un rectángulo sobre el área que quieres exportar
                        </Typography>
                    </Box>
                )}
            </Box>
            <DynamicPalette onDragStart={onDragStart} />
            {selectedNode ? (
                <Box style={{ position: 'absolute', right: 12, top: 72, padding: 8, background: '#fff', border: '1px solid #ddd', borderRadius: 6, zIndex: 1300 }}>
                    <Typography variant="h6" style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, textAlign: 'center' }}>
                        Edición
                    </Typography>
                    <Box style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <Button 
                            variant="outlined" 
                            size="small" 
                            fullWidth
                            startIcon={<RotateLeftIcon />}
                            onClick={() => updateSelectedNodeData({ rotation: (selectedNode.data?.rotation ?? 0) - 90 })}
                        >
                            90°
                        </Button>
                        <Button 
                            variant="outlined" 
                            size="small" 
                            fullWidth
                            startIcon={<RotateRightIcon />}
                            onClick={() => updateSelectedNodeData({ rotation: (selectedNode.data?.rotation ?? 0) + 90 })}
                        >
                            90°
                        </Button>
                    </Box>
                    <Box style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <Button 
                            variant="outlined" 
                            size="small" 
                            fullWidth
                            startIcon={<FlipIcon />}
                            onClick={() => updateSelectedNodeData({ flipX: !(selectedNode.data?.flipX ?? false) })}
                        >
                            Flip X
                        </Button>
                        <Button 
                            variant="outlined" 
                            size="small" 
                            fullWidth
                            startIcon={<FlipIcon style={{ transform: 'rotate(90deg)' }} />}
                            onClick={() => updateSelectedNodeData({ flipY: !(selectedNode.data?.flipY ?? false) })}
                        >
                            Flip Y
                        </Button>
                    </Box>
                    <Box style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                        <TextField
                            type="number"
                            size="small"
                            slotProps={{
                                htmlInput: {
                                    min: 0.5,
                                    max: 2,
                                    step: 0.05
                                }
                            }}
                            fullWidth
                            label="Escala"
                            value={selectedNode.data?.scale ?? 1}
                            onChange={(e) => {
                                const v = Number(e.target.value);
                                if (isNaN(v)) return;
                                updateSelectedNodeData({ scale: v });
                            }}
                        />
                    </Box>
                    <Box style={{ display: 'flex', justifyContent: 'center' }}>
                        <Button 
                            variant="contained" 
                            size="small" 
                            startIcon={<SwapHorizIcon />}
                            onClick={() => updateSelectedNodeData({ invertHandles: !(selectedNode.data?.invertHandles ?? false) })}
                        >
                            Invertir handles
                        </Button>
                    </Box>
                </Box>
            ) : null}

            {/* Diálogo de confirmación para nuevo esquema */}
            <Dialog open={showNewSchemaConfirm} onClose={cancelNewSchema} maxWidth="sm">
                <DialogTitle>Crear Nuevo Esquema</DialogTitle>
                <DialogContent>
                    <Typography>
                        ¿Estás seguro de que quieres crear un nuevo esquema? Se perderán todos los cambios no guardados.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={cancelNewSchema}>Cancelar</Button>
                    <Button onClick={confirmNewSchema} variant="contained" color="error">
                        Crear Nuevo
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Diálogo para guardar esquema */}
            <Dialog open={showSaveDialog} onClose={() => setShowSaveDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Guardar Esquema</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Nombre del esquema"
                        fullWidth
                        variant="outlined"
                        value={schemaName}
                        onChange={(e) => setSchemaName(e.target.value)}
                        //sx={{ mb: 2 }}
                        slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <TextField
                        margin="dense"
                        label="Descripción (opcional)"
                        fullWidth
                        variant="outlined"
                        multiline
                        rows={3}
                        value={schemaDescription}
                        onChange={(e) => setSchemaDescription(e.target.value)}
                        //sx={{ mb: 2 }}
                        slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={isTemplate}
                                onChange={(e) => setIsTemplate(e.target.checked)}
                            />
                        }
                        label="Guardar como plantilla"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowSaveDialog(false)}>Cancelar</Button>
                    <Button onClick={handleSaveSchema} variant="contained">
                        {currentSchemaId ? 'Actualizar' : 'Guardar'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Diálogo para cargar esquemas */}
            <Dialog open={showSchemasDialog} onClose={() => setShowSchemasDialog(false)} maxWidth="md" fullWidth>
                <DialogTitle>Esquemas Guardados</DialogTitle>
                <DialogContent>
                    <List>
                        {schemas.map((schema) => (
                            <ListItem key={schema.id}>
                                <ListItemText
                                    primary={schema.name}
                                    secondary={`${schema.description ? schema.description + ' • ' : ''}Actualizado: ${new Date(schema.updated_at || '').toLocaleString()}`}
                                    secondaryTypographyProps={{
                                        component: 'span',
                                        style: { whiteSpace: 'pre-line' }
                                    }}
                                />
                                <ListItemSecondaryAction>
                                    <IconButton
                                        edge="end"
                                        onClick={() => handleLoadSchema(schema)}
                                        title="Cargar esquema (reemplaza actual)"
                                        sx={{ mr: 1 }}
                                    >
                                        <EditIcon />
                                    </IconButton>
                                    <IconButton
                                        edge="end"
                                        onClick={() => handleImportSchema(schema)}
                                        title="Importar elementos al esquema actual"
                                        sx={{ mr: 1 }}
                                    >
                                        <MergeTypeIcon />
                                    </IconButton>
                                    <IconButton
                                        edge="end"
                                        onClick={() => handleDuplicateSchema(schema.id!, schema.name)}
                                        title="Duplicar esquema"
                                        sx={{ mr: 1 }}
                                    >
                                        <ContentCopyIcon />
                                    </IconButton>
                                    <IconButton
                                        edge="end"
                                        onClick={() => handleDeleteSchema(schema.id!, schema.name)}
                                        title="Eliminar esquema"
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                </ListItemSecondaryAction>
                            </ListItem>
                        ))}
                        {schemas.length === 0 && (
                            <ListItem>
                                <ListItemText primary="No hay esquemas guardados" />
                            </ListItem>
                        )}
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowSchemasDialog(false)}>Cerrar</Button>
                </DialogActions>
            </Dialog>

                        {/* Diálogo para crear/editar elementos SVG (extraído) */}
                        {/* eslint-disable-next-line react/jsx-props-no-spreading */}
                        <React.Suspense fallback={null}>
                            <SvgEditorDialog
                                open={showSvgDialog}
                                onClose={() => setShowSvgDialog(false)}
                                svgName={svgName}
                                setSvgName={setSvgName}
                                svgDescription={svgDescription}
                                setSvgDescription={setSvgDescription}
                                svgCategory={svgCategory}
                                setSvgCategory={setSvgCategory}
                                categories={svgCategories}
                                svgHandles={svgHandles}
                                setSvgHandles={setSvgHandles}
                                svgMarkup={svgMarkup}
                                setSvgMarkup={setSvgMarkup}
                                useEditor={useEditor}
                                setUseEditor={setUseEditor}
                                sanitizedSvg={sanitizedSvg}
                                svgElements={svgElements}
                                onSaveSvgElement={handleSaveSvgElement}
                                onInsertElement={(el) => {
                                    const desired = { x: 100, y: 100 };
                                    const position = findFreePosition(desired, nodes);
                                    const parseSvgSize = (svgText: string) => {
                                        try {
                                            const parser = new DOMParser();
                                            const doc = parser.parseFromString(svgText, 'image/svg+xml');
                                            const svgEl = doc.querySelector('svg');
                                            if (!svgEl) return undefined;
                                            const vb = svgEl.getAttribute('viewBox');
                                            if (vb) {
                                                const parts = vb.split(/[ ,]+/).map(p => parseFloat(p)).filter(n => !isNaN(n));
                                                if (parts.length === 4) return { w: Math.abs(parts[2]), h: Math.abs(parts[3]) };
                                            }
                                            const wAttr = svgEl.getAttribute('width');
                                            const hAttr = svgEl.getAttribute('height');
                                            if (wAttr && hAttr) {
                                                const pw = parseFloat(wAttr.toString().replace(/[^0-9.\-]/g, ''));
                                                const ph = parseFloat(hAttr.toString().replace(/[^0-9.\-]/g, ''));
                                                if (!isNaN(pw) && !isNaN(ph) && pw > 0 && ph > 0) return { w: pw, h: ph };
                                            }
                                        } catch (e) { /* ignore */ }
                                        return undefined;
                                    };
                                    const inferred = parseSvgSize(el.svg || '');
                                    const newNode: Node<any> = {
                                        id: getId(),
                                        position,
                                        type: 'symbolNode',
                                        data: { symbolKey: `custom_svg_${el.id}`, label: el.name, svg: el.svg, size: inferred }
                                    };
                                    setNodes((nds) => nds.concat(newNode));
                                    setShowSvgDialog(false);
                                }}
                                onDeleteElement={async (el) => {
                                    if (!el.id) return;
                                    try { await deleteSvgElement(el.id); const elems = await getAllSvgElements(); setSvgElements(elems); } catch (e) { console.error(e); }
                                }}
                            />
                        </React.Suspense>
        </Box>
    );
}

export default FlowApp;
