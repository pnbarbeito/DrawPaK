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
import { Box, AppBar, Toolbar, IconButton, Typography } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
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
    type ElectNodeData = { label: string };
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
                    <IconButton color="inherit" onClick={exportDiagram} title="Exportar">
                        <SaveIcon />
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
                        connectionLineType={ConnectionLineType.Straight}
                        defaultEdgeOptions={{ type: 'step' }}
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
        </Box>
    );
}

export default FlowApp;
