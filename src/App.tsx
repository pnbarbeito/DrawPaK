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
import SYMBOLS from './components/symbols';
import SymbolNode from './components/SymbolNode';
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
import { Box, AppBar, Toolbar, IconButton, Typography } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import SaveIcon from '@mui/icons-material/Save';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
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
function FlowApp(): React.ReactElement {
    // Tipado específico para los datos de nodo/edge en esta app
    type ElectNodeData = { label: string; rotation?: number; scale?: number; flipX?: boolean; flipY?: boolean };
    type ElectEdgeData = Record<string, unknown>;

    const reactFlowWrapper = useRef<HTMLDivElement | null>(null);
    // Memoize nodeTypes so React Flow doesn't warn about recreated objects
    const NODE_TYPES = React.useMemo(() => ({ symbolNode: SymbolNode }), []);
    const [nodes, setNodes, onNodesChange] = useNodesState<ElectNodeData>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<ElectEdgeData>([]);

    const onConnect: OnConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    const handleDelete = useCallback(() => {
        // Remove selected nodes and edges. Also remove edges connected to removed nodes.
        let removedNodeIds: string[] = [];
        setNodes((nds) => {
            removedNodeIds = nds.filter((n) => n.selected).map((n) => n.id);
            return nds.filter((n) => !n.selected);
        });

        setEdges((eds) => eds.filter((e) => !e.selected && !removedNodeIds.includes(e.source) && !removedNodeIds.includes(e.target)));
    }, [setNodes, setEdges]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            // Delete or Backspace
            if (event.key === 'Delete' || event.key === 'Backspace') {
                // Prevent navigation on Backspace
                event.preventDefault();
                handleDelete();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [handleDelete]);

    const addNode = useCallback(() => {
        const rawPos = { x: Math.random() * 400, y: Math.random() * 200 };
        const pos = snapToGridPos(rawPos);
        const newNode: Node<ElectNodeData> = {
            id: getId(),
            position: pos,
            data: { label: 'Nuevo nodo' },
            style: { padding: 10, borderRadius: 6, border: '1px solid #222' },
        };
        setNodes((nds) => nds.concat(newNode));
    }, [setNodes]);

    // Drag handlers for palette items
    const onDragStart = (event: React.DragEvent, symbolKey: string) => {
        event.dataTransfer.setData('application/reactflow', symbolKey);
        event.dataTransfer.effectAllowed = 'move';
    };

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();
            if (!reactFlowWrapper.current) return;

            const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
            const symbolKey = event.dataTransfer.getData('application/reactflow');
            if (!symbolKey) return;

            const position = snapToGridPos({
                x: event.clientX - reactFlowBounds.left,
                y: event.clientY - reactFlowBounds.top,
            });

            const newNode: Node<any> = {
                id: getId(),
                position,
                type: 'symbolNode',
                data: { symbolKey, label: symbolKey },
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [setNodes],
    );

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onNodeDragStop = useCallback((_: React.MouseEvent, node: Node<ElectNodeData>) => {
        // Snap node to grid when dragging stops
        const snapped = snapToGridPos(node.position as { x: number; y: number });
        setNodes((nds) => nds.map((n) => (n.id === node.id ? { ...n, position: snapped } : n)));
    }, [setNodes]);

    const exportDiagram = useCallback(() => {
        const payload = {
            nodes,
            edges,
        };
        const json = JSON.stringify(payload, null, 2);
        // For now, log to console. Later: send to backend to save in DB
        console.log('Export diagram JSON:', json);
        alert('Diagram exported to console (JSON).');
    }, [nodes, edges]);

    // Save/load to localStorage
    const saveToLocal = useCallback(() => {
        try {
            const payload = JSON.stringify({ nodes, edges });
            localStorage.setItem('drawpak-diagram', payload);
            alert('Diagrama guardado en localStorage.');
        } catch (e) {
            console.error('saveToLocal failed', e);
            alert('Error al guardar en localStorage');
        }
    }, [nodes, edges]);

    const loadFromLocal = useCallback(() => {
        try {
            const raw = localStorage.getItem('drawpak-diagram');
            if (!raw) { alert('No hay diagrama guardado en localStorage'); return; }
            const parsed = JSON.parse(raw) as { nodes: any[]; edges: any[] };
            setNodes(parsed.nodes || []);
            setEdges(parsed.edges || []);
            // ensure id generator does not collide with loaded nodes
            let maxId = 0;
            for (const n of (parsed.nodes || [])) {
                const m = n.id?.toString().match(/node_(\d+)/);
                if (m) maxId = Math.max(maxId, Number(m[1]));
            }
            id = maxId + 1;
            alert('Diagrama cargado desde localStorage.');
        } catch (e) {
            console.error('loadFromLocal failed', e);
            alert('Error al cargar desde localStorage');
        }
    }, [setNodes, setEdges]);

    const dataUrlToUint8Array = (dataUrl: string) => {
        const base64 = dataUrl.split(',')[1];
        const binary = atob(base64);
        const len = binary.length;
        const arr = new Uint8Array(len);
        for (let i = 0; i < len; i++) arr[i] = binary.charCodeAt(i);
        return arr;
    };

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
            } catch (e) {}

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
            const dataUrl = await toPng(clone as HTMLElement, { cacheBust: true });
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
            const nodesOnlyDataUrl = await toPng(clone as HTMLElement, { cacheBust: true });
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
                    const imgDataUrl = await toPng(nodeEl as HTMLElement, { cacheBust: true });
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

    const exportPNG = async () => {
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
        const bytes = dataUrlToUint8Array(dataUrl);

        // Try Tauri save
        if (tauriDialog && tauriFs) {
            try {
                const path = await tauriDialog.save({ defaultPath: 'diagram.png' });
                    if (path) {
                    // plugin-fs exports writeFile for binary data: writeFile(path, Uint8Array|ArrayBuffer|...)
                    await tauriFs.writeFile(path, bytes);
                    return;
                }
            } catch (err) {
                console.error('Tauri save failed', err);
            }
        }

        // fallback browser download
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'diagram.png';
        a.click();
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
        setNodes((nds) => nds.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, ...(patch) } } : n)));
    };

    return (
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <AppBar position="static">
                <Toolbar variant="dense">
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>Editor de esquemas — React Flow</Typography>
                    <IconButton color="inherit" onClick={addNode} title="Agregar nodo">
                        <AddBoxIcon />
                    </IconButton>
                    <IconButton color="inherit" onClick={handleDelete} title="Borrar seleccionado">
                        <DeleteIcon />
                    </IconButton>
                            <IconButton color="inherit" onClick={exportDiagram} title="Exportar JSON">
                                <SaveIcon />
                            </IconButton>
                            <IconButton color="inherit" onClick={() => saveToLocal && saveToLocal()} title="Guardar en localStorage">
                                <SaveIcon />
                            </IconButton>
                            <IconButton color="inherit" onClick={() => loadFromLocal && loadFromLocal()} title="Cargar desde localStorage">
                                <FolderOpenIcon />
                            </IconButton>
                    <IconButton color="inherit" onClick={exportPNG} title="Exportar PNG">
                        <ImageIcon />
                    </IconButton>
                    <IconButton color="inherit" onClick={exportPDF} title="Exportar PDF">
                        <PictureAsPdfIcon />
                    </IconButton>
                </Toolbar>
            </AppBar>
            <Box ref={reactFlowWrapper} style={{ flex: 1 }}>
                <ReactFlowProvider>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeDragStop={onNodeDragStop}
                        snapToGrid={true}
                        snapGrid={[GRID_SIZE, GRID_SIZE]}
                        connectionLineType={ConnectionLineType.SmoothStep}
                        defaultEdgeOptions={{ type: 'smoothstep' }}
                        nodeTypes={NODE_TYPES}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        fitView
                        attributionPosition="bottom-left"
                    >
                        <MiniMap />
                        <Controls />
                        <Background gap={GRID_SIZE} />
                    </ReactFlow>
                </ReactFlowProvider>
            </Box>
                <Box style={{ position: 'absolute', left: 12, top: 72, width: 160, background: '#f5f5f5', padding: 8, borderRadius: 6, zIndex: 1200 }}>
                    <strong>Paleta</strong>
                    <Box style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                            {Object.keys(SYMBOLS).map((key) => {
                                const entry = SYMBOLS[key];
                                const thumbW = Math.min(entry.size?.w ?? 48, 56);
                                const thumbH = Math.min(entry.size?.h ?? 48, 56);
                                // If svg is a React element, clone it to force responsive sizing
                                let thumb: React.ReactNode = entry.svg;
                                if (React.isValidElement(entry.svg) && typeof entry.svg.type === 'string') {
                                    // clone SVG element and override width/height to fill container
                                    thumb = React.cloneElement(entry.svg as React.ReactElement, ({ width: '100%', height: '100%', preserveAspectRatio: 'xMidYMid meet' } as any));
                                }
                                return (
                                <Box key={key} draggable onDragStart={(e) => onDragStart(e, key)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'grab', padding: 6, border: '1px solid #ddd', borderRadius: 4, background: '#fff' }}>
                                    <Box style={{ width: thumbW, height: thumbH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{thumb}</Box>
                                    <Box style={{ fontSize: 12 }}>{key}</Box>
                                </Box>
                                );
                            })}
                    </Box>
                </Box>
                {selectedNode ? (
                    <Box style={{ position: 'absolute', right: 12, top: 72, padding: 8, background: '#fff', border: '1px solid #ddd', borderRadius: 6, zIndex: 1300 }}>
                        <div style={{ fontWeight: 600, marginBottom: 6 }}>Edición</div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                            <button onClick={() => updateSelectedNodeData({ rotation: (selectedNode.data?.rotation ?? 0) - 90 })}>⤺ 90°</button>
                            <button onClick={() => updateSelectedNodeData({ rotation: (selectedNode.data?.rotation ?? 0) + 90 })}>90° ⤻</button>
                            <button onClick={() => updateSelectedNodeData({ flipX: !(selectedNode.data?.flipX ?? false) })}>↔ Flip X</button>
                            <button onClick={() => updateSelectedNodeData({ flipY: !(selectedNode.data?.flipY ?? false) })}>↕ Flip Y</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: 12 }}>Escala (num)</label>
                            <input type="number" min="0.5" max="2" step="0.05" value={(selectedNode.data?.scale ?? 1)} style={{ width: 100 }} onChange={(e) => {
                                const v = Number(e.target.value);
                                if (isNaN(v)) return;
                                updateSelectedNodeData({ scale: v });
                            }} />
                        </div>
                    </Box>
                ) : null}
        </Box>
    );
}

export default FlowApp;
