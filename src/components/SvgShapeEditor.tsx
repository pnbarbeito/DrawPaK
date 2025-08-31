import React, { useRef, useState, useEffect } from 'react';
import { Box, Button, TextField, Checkbox, FormControlLabel, Slider, Typography } from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import DeleteIcon from '@mui/icons-material/Delete';

type Handle = { id: string; x: number; y: number; type?: 'source' | 'target' };
type BaseShape = {
  id: string;
  type: 'rect' | 'circle' | 'line';
  fill?: boolean;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  rotation?: number; // degrees
  handles: Handle[];
};

type RectShape = BaseShape & { type: 'rect'; x: number; y: number; w: number; h: number };
type CircleShape = BaseShape & { type: 'circle'; x: number; y: number; r: number };
type LineShape = BaseShape & { type: 'line'; x1: number; y1: number; x2: number; y2: number };
type Shape = RectShape | CircleShape | LineShape;

type Props = {
  width?: number;
  height?: number;
  onChange?: (result: { svg: string; handles: (Handle & { shapeId?: string })[] }) => void;
};

const GRID = 8;

const defaultRect = (id: string): RectShape => ({ id, type: 'rect', x: 80, y: 60, w: 120, h: 80, fill: true, fillColor: '#e6f2ff', strokeColor: '#000', strokeWidth: 2, rotation: 0, handles: [] });
const defaultCircle = (id: string): CircleShape => ({ id, type: 'circle', x: 150, y: 90, r: 40, fill: true, fillColor: '#e6f2ff', strokeColor: '#000', strokeWidth: 2, rotation: 0, handles: [] });
const defaultLine = (id: string): LineShape => ({ id, type: 'line', x1: 40, y1: 40, x2: 160, y2: 40, fill: false, fillColor: '#000000', strokeColor: '#000', strokeWidth: 2, rotation: 0, handles: [] });

const DISPLAY_SCALE = 2;

const SvgShapeEditor: React.FC<Props> = ({ width = 200, height = 200, onChange }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const dragStartTime = useRef<number>(0);
  const justFinishedDrag = useRef<boolean>(false);
  const windowListenersAttached = useRef<boolean>(false);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [canvasWidth, setCanvasWidth] = useState<number>(width);
  const [canvasHeight, setCanvasHeight] = useState<number>(height);
  // Ref to keep an up-to-date dragState for global event handlers (avoid stale closures)
  const dragStateRef = useRef<null | {
    mode: 'move' | 'handle' | 'resize';
    shapeId: string;
    handleId?: string;
    corner?: 'nw' | 'ne' | 'se' | 'sw';
    offsetX?: number;
    offsetY?: number;
  }>(null);

  const updateDragState = (v: null | {
    mode: 'move' | 'handle' | 'resize';
    shapeId: string;
    handleId?: string;
    corner?: 'nw' | 'ne' | 'se' | 'sw';
    offsetX?: number;
    offsetY?: number;
  }) => {
    dragStateRef.current = v;
  };

  const snap = (v: number) => Math.round(v / GRID) * GRID;

  useEffect(() => {
    if (!onChange) return;
    if (!svgRef.current) return;
    // Clone and normalize export so width/height are logical (not the visual scaled ones)
    try {
      const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('viewBox', `0 0 ${canvasWidth} ${canvasHeight}`);
      clone.setAttribute('width', String(canvasWidth));
      clone.setAttribute('height', String(canvasHeight));
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(clone);
      const handles = shapes.flatMap(s => s.handles.map(h => ({ ...h, shapeId: s.id })));
      onChange({ svg: svgStr, handles });
    } catch (e) {
      const svgStr = svgRef.current.outerHTML;
      const handles = shapes.flatMap(s => s.handles.map(h => ({ ...h, shapeId: s.id })));
      onChange({ svg: svgStr, handles });
    }
  }, [shapes, onChange, canvasWidth, canvasHeight]);

  const addRect = () => {
    const id = `shape_${Date.now()}`;
    setShapes(prev => [...prev, defaultRect(id)]);
    setSelected(id);
  };

  const addCircle = () => {
    const id = `shape_${Date.now()}`;
    setShapes(prev => [...prev, defaultCircle(id)]);
    setSelected(id);
  };

  const addLine = () => {
    const id = `shape_${Date.now()}`;
    const ln = defaultLine(id);
    // add handles at endpoints
    ln.handles = [ { id: `${id}_h1`, x: ln.x1, y: ln.y1, type: 'source' }, { id: `${id}_h2`, x: ln.x2, y: ln.y2, type: 'target' } ];
    setShapes(prev => [...prev, ln]);
    setSelected(id);
  };

  const deleteSelectedShape = () => {
    if (!selected) return;
    setShapes(prev => prev.filter(s => s.id !== selected));
    setSelected(null);
  };

  const addHandleToSelected = () => {
    if (!selected) return;
    setShapes(prev => prev.map(s => {
      if (s.id !== selected) return s;
      const hid = `h_${Date.now()}`;
      let hx = 0, hy = 0;
      if (s.type === 'rect') { hx = snap(s.x + s.w / 2); hy = snap(s.y + s.h / 2); }
      else if (s.type === 'circle') { hx = snap(s.x); hy = snap(s.y); }
      else if (s.type === 'line') { hx = snap((s.x1 + s.x2)/2); hy = snap((s.y1 + s.y2)/2); }
      return { ...s, handles: [...(s.handles || []), { id: hid, x: hx, y: hy, type: 'source' }] };
    }));
  };

  // mouse helpers
  const clientToSvgPoint = (clientX: number, clientY: number) => {
    if (!svgRef.current) return null;
    const pt = svgRef.current.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return null;
    return pt.matrixTransform(ctm.inverse());
  };

  const onMouseDownShape = (e: React.MouseEvent, shape: Shape) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const svgP = clientToSvgPoint(e.clientX, e.clientY);
    if (!svgP) return;
    
    // Resetear bandera al iniciar nuevo drag
    justFinishedDrag.current = false;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragStartTime.current = Date.now();
    
    setSelected(shape.id);
    // offset for move
    if (shape.type === 'rect') updateDragState({ mode: 'move', shapeId: shape.id, offsetX: svgP.x - shape.x, offsetY: svgP.y - shape.y });
    else if (shape.type === 'circle') updateDragState({ mode: 'move', shapeId: shape.id, offsetX: svgP.x - shape.x, offsetY: svgP.y - shape.y });
    else if (shape.type === 'line') {
      // For lines, we need a reference point. Let's use x1, y1 as the anchor for the offset.
      updateDragState({ mode: 'move', shapeId: shape.id, offsetX: svgP.x - shape.x1, offsetY: svgP.y - shape.y1 });
    }

            console.debug('[SvgEditor] onMouseDownShape', { id: shape.id, clientX: e.clientX, clientY: e.clientY, svgX: svgP.x, svgY: svgP.y, justFinishedDrag: justFinishedDrag.current });
            console.debug('[SvgEditor] onMouseDownShape', { id: shape.id, clientX: e.clientX, clientY: e.clientY, svgX: svgP.x, svgY: svgP.y, justFinishedDrag: justFinishedDrag.current });
    // attach global listeners so dragging keeps working even if pointer leaves the svg
    if (!windowListenersAttached.current) {
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
      windowListenersAttached.current = true;
    }
  };

  const onMouseDownHandle = (e: React.MouseEvent, shapeId: string, handleId: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;
  console.debug('[SvgEditor] onMouseDownHandle', { shapeId, handleId });
  updateDragState({ mode: 'handle', shapeId, handleId });
    if (!windowListenersAttached.current) {
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
      windowListenersAttached.current = true;
    }
  };

  const onMouseDownResizeCorner = (e: React.MouseEvent, shape: RectShape, corner: 'nw' | 'ne' | 'se' | 'sw') => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setSelected(shape.id);
  console.debug('[SvgEditor] onMouseDownResizeCorner', { shapeId: shape.id, corner });
  updateDragState({ mode: 'resize', shapeId: shape.id, corner, offsetX: 0, offsetY: 0 });
    if (!windowListenersAttached.current) {
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
      windowListenersAttached.current = true;
    }
  };

  // Global mouse handlers (used while dragging so we don't lose events when pointer leaves svg)
  const handleWindowMouseMove = (e: MouseEvent) => {
    const svgP = clientToSvgPoint(e.clientX, e.clientY);
    if (!svgP) return;

    // Marcar que hubo movimiento real para prevenir clicks que deseleccionen
    justFinishedDrag.current = true;
  console.debug('[SvgEditor] handleWindowMouseMove', { clientX: e.clientX, clientY: e.clientY, svgX: svgP.x, svgY: svgP.y, dragState: dragStateRef.current });

    setShapes(prev => prev.map(s => {
      const currentDrag = dragStateRef.current;
      if (s.id !== (currentDrag && currentDrag.shapeId)) return s;

      if (currentDrag?.mode === 'handle' && currentDrag.handleId) {
        return { ...s, handles: s.handles.map(h => h.id === currentDrag.handleId ? { ...h, x: snap(svgP.x), y: snap(svgP.y) } : h) };
      }

      if (currentDrag?.mode === 'move') {
        if (s.type === 'rect') {
          const newX = snap(svgP.x - (currentDrag.offsetX || 0));
          const newY = snap(svgP.y - (currentDrag.offsetY || 0));
          return { ...s, x: newX, y: newY } as RectShape;
        }
        if (s.type === 'circle') {
          const newX = snap(svgP.x - (currentDrag.offsetX || 0));
          const newY = snap(svgP.y - (currentDrag.offsetY || 0));
          return { ...s, x: newX, y: newY } as CircleShape;
        }
        if (s.type === 'line') {
          const dx = s.x2 - s.x1;
          const dy = s.y2 - s.y1;
          const newX1 = snap(svgP.x - (currentDrag.offsetX || 0));
          const newY1 = snap(svgP.y - (currentDrag.offsetY || 0));
          return { ...s, x1: newX1, y1: newY1, x2: newX1 + dx, y2: newY1 + dy } as LineShape;
        }
      }

      if (currentDrag?.mode === 'resize' && s.type === 'rect') {
        const x1 = s.x;
        const y1 = s.y;
        const x2 = s.x + s.w;
        const y2 = s.y + s.h;
        let nx1 = x1, ny1 = y1, nx2 = x2, ny2 = y2;
        if (currentDrag.corner === 'nw') { nx1 = snap(svgP.x); ny1 = snap(svgP.y); }
        if (currentDrag.corner === 'ne') { nx2 = snap(svgP.x); ny1 = snap(svgP.y); }
        if (currentDrag.corner === 'se') { nx2 = snap(svgP.x); ny2 = snap(svgP.y); }
        if (currentDrag.corner === 'sw') { nx1 = snap(svgP.x); ny2 = snap(svgP.y); }
        const nw = Math.max(8, nx2 - nx1);
        const nh = Math.max(8, ny2 - ny1);
        const nx = Math.min(nx1, nx2);
        const ny = Math.min(ny1, ny2);
        return { ...s, x: nx, y: ny, w: nw, h: nh } as RectShape;
      }

      return s;
    }));
  };

  const handleWindowMouseUp = (_e: MouseEvent) => {
    // If drag already cleared, ignore this event (prevents double-up handling)
    if (!dragStateRef.current) return;
    const draggedShapeId = dragStateRef.current?.shapeId;
    updateDragState(null);
    dragStartPos.current = null;

    // cleanup global listeners
    if (windowListenersAttached.current) {
      try { window.removeEventListener('mousemove', handleWindowMouseMove); } catch (e) { /* ignore */ }
      try { window.removeEventListener('mouseup', handleWindowMouseUp); } catch (e) { /* ignore */ }
      windowListenersAttached.current = false;
    }

    // If we were dragging, ensure the item remains selected
    if (draggedShapeId && justFinishedDrag.current) {
      setSelected(draggedShapeId);
      setTimeout(() => { justFinishedDrag.current = false; }, 100);
    } else {
      justFinishedDrag.current = false;
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
  if (!dragStateRef.current) return;
    const svgP = clientToSvgPoint(e.clientX, e.clientY);
    if (!svgP) return;

  // Marcar que hubo movimiento real para prevenir clicks que deseleccionen
  justFinishedDrag.current = true;
  console.debug('[SvgEditor] onMouseMove', { mode: dragStateRef.current?.mode, shapeId: dragStateRef.current?.shapeId, clientX: e.clientX, clientY: e.clientY, svgX: svgP.x, svgY: svgP.y, justFinishedDrag: justFinishedDrag.current });

    setShapes(prev => prev.map(s => {
      const currentDrag = dragStateRef.current;
      if (s.id !== currentDrag?.shapeId) return s;
      if (currentDrag?.mode === 'handle' && currentDrag.handleId) {
        return { ...s, handles: s.handles.map(h => h.id === currentDrag.handleId ? { ...h, x: snap(svgP.x), y: snap(svgP.y) } : h) };
      }

      if (currentDrag?.mode === 'move') {
        if (s.type === 'rect') {
          const newX = snap(svgP.x - (currentDrag.offsetX || 0));
          const newY = snap(svgP.y - (currentDrag.offsetY || 0));
          return { ...s, x: newX, y: newY } as RectShape;
        }
        if (s.type === 'circle') {
          const newX = snap(svgP.x - (currentDrag.offsetX || 0));
          const newY = snap(svgP.y - (currentDrag.offsetY || 0));
          return { ...s, x: newX, y: newY } as CircleShape;
        }
        if (s.type === 'line') {
          const dx = s.x2 - s.x1;
          const dy = s.y2 - s.y1;
          const newX1 = snap(svgP.x - (currentDrag.offsetX || 0));
          const newY1 = snap(svgP.y - (currentDrag.offsetY || 0));
          return { ...s, x1: newX1, y1: newY1, x2: newX1 + dx, y2: newY1 + dy } as LineShape;
        }
      }

      if (currentDrag?.mode === 'resize' && s.type === 'rect') {
        const x1 = s.x;
        const y1 = s.y;
        const x2 = s.x + s.w;
        const y2 = s.y + s.h;
        let nx1 = x1, ny1 = y1, nx2 = x2, ny2 = y2;
        if (currentDrag.corner === 'nw') { nx1 = snap(svgP.x); ny1 = snap(svgP.y); }
        if (currentDrag.corner === 'ne') { nx2 = snap(svgP.x); ny1 = snap(svgP.y); }
        if (currentDrag.corner === 'se') { nx2 = snap(svgP.x); ny2 = snap(svgP.y); }
        if (currentDrag.corner === 'sw') { nx1 = snap(svgP.x); ny2 = snap(svgP.y); }
        const nw = Math.max(8, nx2 - nx1);
        const nh = Math.max(8, ny2 - ny1);
        const nx = Math.min(nx1, nx2);
        const ny = Math.min(ny1, ny2);
        return { ...s, x: nx, y: ny, w: nw, h: nh } as RectShape;
      }

      return s;
    }));
  };

  const onMouseUp = () => {
    const draggedShapeId = dragStateRef.current?.shapeId;
    updateDragState(null);
    dragStartPos.current = null;
    console.debug('[SvgEditor] onMouseUp', { draggedShapeId, justFinishedDrag: justFinishedDrag.current });

    // cleanup global listeners immediately to avoid window handlers running after SVG up
    if (windowListenersAttached.current) {
      try { window.removeEventListener('mousemove', handleWindowMouseMove); } catch (e) { /* ignore */ }
      try { window.removeEventListener('mouseup', handleWindowMouseUp); } catch (e) { /* ignore */ }
      windowListenersAttached.current = false;
    }

    // Si estábamos arrastrando algo, asegurar que siga seleccionado
    if (draggedShapeId && justFinishedDrag.current) {
      // Forzar que el elemento siga seleccionado después del drag
      setSelected(draggedShapeId);
      setTimeout(() => { justFinishedDrag.current = false; }, 100);
    } else {
      justFinishedDrag.current = false;
    }
  };

  const toggleHandleType = (shapeId: string, handleId: string) => {
    setShapes(prev => prev.map(s => {
      if (s.id !== shapeId) return s;
      return { ...s, handles: s.handles.map(h => h.id === handleId ? { ...h, type: h.type === 'source' ? 'target' : 'source' } : h) };
    }));
  };

  const deleteHandle = (shapeId: string, handleId: string) => {
    setShapes(prev => prev.map(s => s.id === shapeId ? { ...s, handles: s.handles.filter(h => h.id !== handleId) } : s));
  };

  const updateSelectedProp = (patch: Partial<Shape>) => {
    if (!selected) return;
    setShapes(prev => prev.map(s => s.id === selected ? ({ ...s, ...(patch as any) }) : s));
  };

  const exportSvg = () => {
    if (!svgRef.current) return;
    const outer = svgRef.current.outerHTML;
    const handles = shapes.flatMap(s => s.handles.map(h => ({ ...h, shapeId: s.id })));
    if (onChange) onChange({ svg: outer, handles });
  };

  const selectedShape = shapes.find(s => s.id === selected) as Shape | undefined;

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
        <Box>
          <Button variant="contained" startIcon={<AddBoxIcon />} onClick={addRect}>Rect</Button>
        </Box>
        <Box>
          <Button variant="contained" startIcon={<RadioButtonUncheckedIcon />} onClick={addCircle}>Circle</Button>
        </Box>
        <Box>
          <Button variant="contained" onClick={addLine}>Line</Button>
        </Box>
        <Box>
          <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={deleteSelectedShape} disabled={!selected}>Borrar</Button>
        </Box>
        <Box>
          <Button variant="outlined" onClick={addHandleToSelected} disabled={!selected}>Añadir handle</Button>
        </Box>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          <TextField label="Width" type="number" size="small" value={canvasWidth} onChange={(e) => setCanvasWidth(Number(e.target.value) || 100)} sx={{ width: 100, mr: 1 }} />
          <TextField label="Height" type="number" size="small" value={canvasHeight} onChange={(e) => setCanvasHeight(Number(e.target.value) || 100)} sx={{ width: 100 }} />
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Box sx={{ border: '1px solid #ddd', width: canvasWidth * DISPLAY_SCALE + 5, height: canvasHeight * DISPLAY_SCALE + 5, overflow: 'auto' }}>
          <svg
            ref={svgRef}
            // visual size is scaled, user draws in logical coordinates via viewBox
            width={canvasWidth * DISPLAY_SCALE}
            height={canvasHeight * DISPLAY_SCALE}
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            style={{ background: 'rgba(255, 255, 255, 0.0)' }}
            onMouseDown={(e) => {
              const target = e.target as Element;
              if (target === svgRef.current) {
                console.debug('[SvgEditor] svg background onMouseDown', { justFinishedDrag: justFinishedDrag.current });
                setTimeout(() => {
                  console.debug('[SvgEditor] svg background timeout fired', { justFinishedDrag: justFinishedDrag.current });
                  if (!justFinishedDrag.current) {
                    setSelected(null);
                    updateDragState(null);
                  }
                }, 10);
              }
            }}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            {shapes.map(s => (
              <g key={s.id}>
                {s.type === 'rect' && (() => {
                  const rs = s as RectShape;
                  const cx = rs.x + rs.w / 2;
                  const cy = rs.y + rs.h / 2;
                  return (
                    <g transform={`rotate(${rs.rotation || 0}, ${cx}, ${cy})`}>
                      <rect
                        x={rs.x}
                        y={rs.y}
                        width={rs.w}
                        height={rs.h}
                        fill={rs.fill ? rs.fillColor : 'none'}
                        stroke={rs.strokeColor}
                        strokeWidth={rs.strokeWidth}
                        onMouseDown={(e) => onMouseDownShape(e, rs)}
                      />
                      {selected === rs.id && (
                        <g>
                          <rect x={rs.x - 6} y={rs.y - 6} width={12} height={12} fill="#fff" stroke="#666" onMouseDown={(e) => onMouseDownResizeCorner(e, rs, 'nw')} />
                          <rect x={rs.x + rs.w - 6} y={rs.y - 6} width={12} height={12} fill="#fff" stroke="#666" onMouseDown={(e) => onMouseDownResizeCorner(e, rs, 'ne')} />
                          <rect x={rs.x + rs.w - 6} y={rs.y + rs.h - 6} width={12} height={12} fill="#fff" stroke="#666" onMouseDown={(e) => onMouseDownResizeCorner(e, rs, 'se')} />
                          <rect x={rs.x - 6} y={rs.y + rs.h - 6} width={12} height={12} fill="#fff" stroke="#666" onMouseDown={(e) => onMouseDownResizeCorner(e, rs, 'sw')} />
                        </g>
                      )}
                    </g>
                  );
                })()}

                {s.type === 'circle' && (() => {
                  const cs = s as CircleShape;
                  const cx = cs.x;
                  const cy = cs.y;
                  return (
                    <g transform={`rotate(${cs.rotation || 0}, ${cx}, ${cy})`}>
                      <circle
                        cx={cs.x}
                        cy={cs.y}
                        r={cs.r}
                        fill={cs.fill ? cs.fillColor : 'none'}
                        stroke={cs.strokeColor}
                        strokeWidth={cs.strokeWidth}
                        onMouseDown={(e) => onMouseDownShape(e, cs)}
                      />
                    </g>
                  );
                })()}

                {s.type === 'line' && (() => {
                  const ls = s as LineShape;
                  return (
                    <line
                      x1={ls.x1}
                      y1={ls.y1}
                      x2={ls.x2}
                      y2={ls.y2}
                      stroke={ls.strokeColor}
                      strokeWidth={ls.strokeWidth}
                      onMouseDown={(e) => onMouseDownShape(e, ls)}
                    />
                  );
                })()}

                {s.handles.map(h => (
                  <circle
                    key={h.id}
                    cx={h.x}
                    cy={h.y}
                    r={6}
                    fill={h.type === 'source' ? '#22c55e' : '#ef4444'}
                    stroke="#111"
                    onMouseDown={(e) => onMouseDownHandle(e, s.id, h.id)}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => { e.stopPropagation(); toggleHandleType(s.id, h.id); }}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); deleteHandle(s.id, h.id); }}
                    style={{ cursor: 'grab' }}
                  />
                ))}
              </g>
            ))}
          </svg>
        </Box>

        <Box sx={{ width: 300 }}>
          <Typography variant="subtitle1">Propiedades</Typography>
          {!selected && <Typography variant="body2" color="text.secondary">Selecciona una forma para editar sus propiedades</Typography>}
          {selected && selectedShape && (
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="caption">Tipo: {selectedShape.type}</Typography>
              {/* Fill toggle and color */}
              <FormControlLabel control={<Checkbox checked={!!selectedShape.fill} onChange={(e) => updateSelectedProp({ fill: e.target.checked } as any)} />} label="Fill" />
              <TextField type="color" label="Fill color" value={selectedShape.fillColor || '#000000'} onChange={(e) => updateSelectedProp({ fillColor: e.target.value } as any)} />
              <Box>
                <Typography variant="caption">Stroke color</Typography>
                <TextField type="color" value={selectedShape.strokeColor || '#000000'} onChange={(e) => updateSelectedProp({ strokeColor: e.target.value } as any)} />
              </Box>
              <Box>
                <Typography variant="caption">Stroke width</Typography>
                <Slider min={0} max={10} value={selectedShape.strokeWidth ?? 1} onChange={(_, v) => updateSelectedProp({ strokeWidth: Array.isArray(v) ? v[0] : v } as any)} />
              </Box>
              <Box>
                <Typography variant="caption">Rotación (deg)</Typography>
                <TextField type="number" value={selectedShape.rotation ?? 0} onChange={(e) => updateSelectedProp({ rotation: Number(e.target.value) || 0 } as any)} />
              </Box>

              {/* Position / size fields */}
              {selectedShape.type === 'rect' && (
                <>
                  <TextField label="X" type="number" size="small" value={(selectedShape as RectShape).x} onChange={(e) => updateSelectedProp({ x: Number(e.target.value) } as any)} />
                  <TextField label="Y" type="number" size="small" value={(selectedShape as RectShape).y} onChange={(e) => updateSelectedProp({ y: Number(e.target.value) } as any)} />
                  <TextField label="W" type="number" size="small" value={(selectedShape as RectShape).w} onChange={(e) => updateSelectedProp({ w: Number(e.target.value) } as any)} />
                  <TextField label="H" type="number" size="small" value={(selectedShape as RectShape).h} onChange={(e) => updateSelectedProp({ h: Number(e.target.value) } as any)} />
                </>
              )}

              {selectedShape.type === 'circle' && (
                <>
                  <TextField label="CX" type="number" size="small" value={(selectedShape as CircleShape).x} onChange={(e) => updateSelectedProp({ x: Number(e.target.value) } as any)} />
                  <TextField label="CY" type="number" size="small" value={(selectedShape as CircleShape).y} onChange={(e) => updateSelectedProp({ y: Number(e.target.value) } as any)} />
                  <TextField label="R" type="number" size="small" value={(selectedShape as CircleShape).r} onChange={(e) => updateSelectedProp({ r: Number(e.target.value) } as any)} />
                </>
              )}

              {selectedShape.type === 'line' && (
                <>
                  <TextField label="X1" type="number" size="small" value={(selectedShape as LineShape).x1} onChange={(e) => updateSelectedProp({ x1: Number(e.target.value) } as any)} />
                  <TextField label="Y1" type="number" size="small" value={(selectedShape as LineShape).y1} onChange={(e) => updateSelectedProp({ y1: Number(e.target.value) } as any)} />
                  <TextField label="X2" type="number" size="small" value={(selectedShape as LineShape).x2} onChange={(e) => updateSelectedProp({ x2: Number(e.target.value) } as any)} />
                  <TextField label="Y2" type="number" size="small" value={(selectedShape as LineShape).y2} onChange={(e) => updateSelectedProp({ y2: Number(e.target.value) } as any)} />
                </>
              )}

              <Button variant="contained" sx={{ mt: 1 }} onClick={exportSvg}>Aplicar / Exportar</Button>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default SvgShapeEditor;
