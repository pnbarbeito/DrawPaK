import React from 'react';
import { Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControlLabel, Checkbox, Typography, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import SvgShapeEditor from './SvgShapeEditor';

type Props = {
  open: boolean;
  onClose: () => void;
  svgName: string;
  setSvgName: (v: string) => void;
  svgDescription: string;
  setSvgDescription: (v: string) => void;
  svgCategory: string;
  setSvgCategory: (v: string) => void;
  categories: string[];
  svgHandles: string;
  setSvgHandles: (v: string) => void;
  svgMarkup: string;
  setSvgMarkup: (v: string) => void;
  useEditor: boolean;
  setUseEditor: (v: boolean) => void;
  sanitizedSvg: string;
  svgElements: any[];
  onSaveSvgElement: () => void;
  onDeleteElement: (el: any) => void;
};

const SvgEditorDialog: React.FC<Props> = ({
  open, onClose, svgName, setSvgName, svgDescription, setSvgDescription,
  svgCategory, setSvgCategory, categories,
  svgHandles, setSvgHandles, svgMarkup, setSvgMarkup, useEditor, setUseEditor,
  sanitizedSvg, svgElements, onSaveSvgElement, onDeleteElement
}) => {
  const [editorReloadKey, setEditorReloadKey] = React.useState<number>(Date.now());

  const STORAGE_KEY = 'svgShapeEditor.draft.v1';

  const copyElementToEditor = (el: any) => {
    // build a minimal draft payload compatible with SvgShapeEditor
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(el.svg || '', 'image/svg+xml');
      const svgEl = doc.querySelector('svg');
      let w = 120, h = 120;
      if (svgEl) {
        const vb = svgEl.getAttribute('viewBox');
        if (vb) {
          const parts = vb.split(/[ ,]+/).map((p) => parseFloat(p)).filter(n => !isNaN(n));
          if (parts.length === 4) { w = Math.abs(parts[2]) || w; h = Math.abs(parts[3]) || h; }
        } else {
          const wa = svgEl.getAttribute('width');
          const ha = svgEl.getAttribute('height');
          const pw = wa ? parseFloat(wa.toString().replace(/[^0-9.\-]/g, '')) : NaN;
          const ph = ha ? parseFloat(ha.toString().replace(/[^0-9.\-]/g, '')) : NaN;
          if (!isNaN(pw) && !isNaN(ph)) { w = pw; h = ph; }
        }
      }

      // parse handles (may be stored as stringified JSON)
      let handles: any[] = [];
      try { handles = el.handles ? (typeof el.handles === 'string' ? JSON.parse(el.handles) : el.handles) : []; } catch (e) { handles = []; }

      // normalize handles to expected shape: { id, x, y, type }
      handles = Array.isArray(handles) ? handles.map((h, idx) => ({ id: h.id || `h_${idx}`, x: (typeof h.x === 'number' ? h.x : (h.x ? parseFloat(h.x) : 0)), y: (typeof h.y === 'number' ? h.y : (h.y ? parseFloat(h.y) : 0)), type: h.type || 'source' })) : [];

      // Try to parse SVG child elements into editable shapes (rect/circle/line)
      const shapes: any[] = [];

      const parseTransformRotation = (el: Element | null) => {
        if (!el) return 0;
        const t = el.getAttribute('transform') || '';
        const m = t.match(/rotate\(([^)]+)\)/);
        if (!m) return 0;
        const parts = m[1].split(/[ ,]+/).map(p => parseFloat(p)).filter(n => !isNaN(n));
        return parts[0] || 0;
      };

      // rects
      Array.from(doc.querySelectorAll('rect')).forEach((rEl, idx) => {
        const x = parseFloat(rEl.getAttribute('x') || '0');
        const y = parseFloat(rEl.getAttribute('y') || '0');
        const wAttr = parseFloat(rEl.getAttribute('width') || '0');
        const hAttr = parseFloat(rEl.getAttribute('height') || '0');
        const fillAttr = rEl.getAttribute('fill');
        const stroke = rEl.getAttribute('stroke') || '#000';
        const strokeW = parseFloat(rEl.getAttribute('stroke-width') || '1');
        const rotation = parseTransformRotation(rEl);
        shapes.push({ id: `shape_import_rect_${el.id}_${idx}_${Date.now()}`, type: 'rect', x, y, w: wAttr, h: hAttr, fill: !!(fillAttr && fillAttr !== 'none'), fillColor: fillAttr || 'rgba(255,255,255,0)', strokeColor: stroke, strokeWidth: strokeW || 1, rotation: rotation || 0, handles: [] });
      });

      // circles
      Array.from(doc.querySelectorAll('circle')).forEach((cEl, idx) => {
        const cx = parseFloat(cEl.getAttribute('cx') || '0');
        const cy = parseFloat(cEl.getAttribute('cy') || '0');
        const r = parseFloat(cEl.getAttribute('r') || '0');
        const fillAttr = cEl.getAttribute('fill');
        const stroke = cEl.getAttribute('stroke') || '#000';
        const strokeW = parseFloat(cEl.getAttribute('stroke-width') || '1');
        const rotation = parseTransformRotation(cEl);
        shapes.push({ id: `shape_import_circle_${el.id}_${idx}_${Date.now()}`, type: 'circle', x: cx, y: cy, r, fill: !!(fillAttr && fillAttr !== 'none'), fillColor: fillAttr || 'rgba(255,255,255,0)', strokeColor: stroke, strokeWidth: strokeW || 1, rotation: rotation || 0, handles: [] });
      });

      // lines
      Array.from(doc.querySelectorAll('line')).forEach((lEl, idx) => {
        const x1 = parseFloat(lEl.getAttribute('x1') || '0');
        const y1 = parseFloat(lEl.getAttribute('y1') || '0');
        const x2 = parseFloat(lEl.getAttribute('x2') || '0');
        const y2 = parseFloat(lEl.getAttribute('y2') || '0');
        const stroke = lEl.getAttribute('stroke') || '#000';
        const strokeW = parseFloat(lEl.getAttribute('stroke-width') || '1');
        const rotation = parseTransformRotation(lEl);
        shapes.push({ id: `shape_import_line_${el.id}_${idx}_${Date.now()}`, type: 'line', x1, y1, x2, y2, fill: false, fillColor: 'none', strokeColor: stroke, strokeWidth: strokeW || 1, rotation: rotation || 0, handles: [] });
      });

      // If we parsed at least one supported shape, assign handles to nearest shape center
      if (shapes.length > 0) {
        const distSq = (x1: number, y1: number, x2: number, y2: number) => (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
        const shapeCenter = (s: any) => {
          if (s.type === 'rect') return { x: s.x + (s.w || 0) / 2, y: s.y + (s.h || 0) / 2 };
          if (s.type === 'circle') return { x: s.x, y: s.y };
          if (s.type === 'line') return { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 };
          return { x: 0, y: 0 };
        };

        handles.forEach((h, idx) => {
          let bestIdx = 0;
          let bestDist = Infinity;
          for (let i = 0; i < shapes.length; i++) {
            const c = shapeCenter(shapes[i]);
            const d = distSq(h.x || 0, h.y || 0, c.x, c.y);
            if (d < bestDist) { bestDist = d; bestIdx = i; }
          }
          const target = shapes[bestIdx];
          target.handles = target.handles || [];
          target.handles.push({ id: h.id || `h_${idx}`, x: h.x || 0, y: h.y || 0, type: h.type || 'source' });
        });

        const payload = { shapes, canvasWidth: w, canvasHeight: h };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } else {
        // fallback: create a non-visible placeholder shape (w=0,h=0, no stroke) so handles are copied
        const shape = {
          id: `shape_import_${el.id}_${Date.now()}`,
          type: 'rect',
          x: 0,
          y: 0,
          w: 0,
          h: 0,
          fill: false,
          fillColor: 'rgba(255,255,255,0)',
          strokeColor: 'none',
          strokeWidth: 0,
          rotation: 0,
          handles
        };

        const payload = { shapes: [shape], canvasWidth: w, canvasHeight: h };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      }
  // ensure editor is active and remount it so it reads from storage on mount
  setUseEditor(true);
  setEditorReloadKey(Date.now());
    } catch (e) {
      console.error('Error copiando elemento al editor', e);
      alert('Error copiando elemento al editor');
    }
  };
  // Normalize SVG string for preview/thumbnail: ensure viewBox, remove width/height, set requested display size
  const normalizeSvgForPreview = (svgStr: string | undefined, targetW: number, targetH: number) => {
    if (!svgStr) return '';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgStr, 'image/svg+xml');
      const root = doc.documentElement as unknown as HTMLElement | null;
      if (!root || root.nodeName.toLowerCase() !== 'svg') return svgStr;
      const svgEl = root as unknown as SVGElement;

      // If no viewBox but width/height exist, derive viewBox
      const vb = svgEl.getAttribute('viewBox');
      const wAttr = svgEl.getAttribute('width');
      const hAttr = svgEl.getAttribute('height');
      if (!vb && wAttr && hAttr) {
        const pw = parseFloat(wAttr as string);
        const ph = parseFloat(hAttr as string);
        if (!isNaN(pw) && !isNaN(ph) && pw > 0 && ph > 0) {
          svgEl.setAttribute('viewBox', `0 0 ${pw} ${ph}`);
        }
      }

      // Remove existing width/height so the SVG is flexible, then set explicit thumbnail attributes
      svgEl.removeAttribute('width');
      svgEl.removeAttribute('height');
      svgEl.setAttribute('width', String(targetW));
      svgEl.setAttribute('height', String(targetH));
      svgEl.setAttribute('style', `width:${targetW}px;height:${targetH}px;display:block`);

      const serializer = new XMLSerializer();
      return serializer.serializeToString(svgEl);
    } catch (e) {
      return svgStr;
    }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle>Crear/Editar Elemento SVG</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Nombre"
          fullWidth
          variant="outlined"
          value={svgName}
          onChange={(e) => setSvgName(e.target.value)}
        />
        <TextField
          margin="dense"
          label="Descripción (opcional)"
          fullWidth
          variant="outlined"
          value={svgDescription}
          onChange={(e) => setSvgDescription(e.target.value)}
        />

        <FormControl margin="dense" fullWidth variant="outlined">
          <InputLabel>Categoría</InputLabel>
          <Select
            value={svgCategory}
            onChange={(e) => setSvgCategory(e.target.value)}
            label="Categoría"
          >
            <MenuItem value="custom">Personalizado</MenuItem>
            <MenuItem value="basic">Básico</MenuItem>
            <MenuItem value="flowchart">Diagrama de flujo</MenuItem>
            <MenuItem value="network">Red</MenuItem>
            <MenuItem value="uml">UML</MenuItem>
            {categories.filter(cat => !['custom', 'basic', 'flowchart', 'network', 'uml'].includes(cat)).map(cat => (
              <MenuItem key={cat} value={cat}>{cat}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {useEditor ? (
          <>
            <Box style={{ marginTop: 8, border: '1px solid #ddd', padding: 8 }}>
              <SvgShapeEditor
                key={editorReloadKey}
                width={120}
                height={120}
                onChange={(res) => {
                  setSvgMarkup(typeof res.svg === 'string' ? res.svg : '');
                  try { setSvgHandles(JSON.stringify(res.handles || [])); } catch (e) { setSvgHandles('[]'); }
                }}
              />
            </Box>
          </>
        ) : (
          <>
            <TextField
              margin="dense"
              label="Handles (JSON)"
              fullWidth
              variant="outlined"
              value={svgHandles}
              onChange={(e) => setSvgHandles(e.target.value)}
              helperText='Ej: [{"id":"left","position":"left","offset":"50%","type":"source"}]'
            />
            <TextField
              margin="dense"
              label="SVG markup"
              fullWidth
              variant="outlined"
              multiline
              rows={8}
              value={svgMarkup}
              onChange={(e) => setSvgMarkup(e.target.value)}
            />
            <Box style={{ marginTop: 8 }}>
              <Typography variant="subtitle2">Previsualización</Typography>
              <div style={{ border: '1px solid #ddd', padding: 8, borderRadius: 4, background: '#fff' }}>
                {sanitizedSvg ? (
                  <div dangerouslySetInnerHTML={{ __html: normalizeSvgForPreview(sanitizedSvg, 160, 160) }} />
                ) : svgMarkup ? (
                  <div dangerouslySetInnerHTML={{ __html: normalizeSvgForPreview(svgMarkup, 160, 160) }} />
                ) : (
                  <div style={{ color: '#888' }}>Sin contenido</div>
                )}
              </div>
            </Box>
          </>
        )}

        <Box style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <FormControlLabel
            control={<Checkbox checked={useEditor} onChange={(e) => setUseEditor(e.target.checked)} />}
            label="Usar editor gráfico"
          />
        </Box>

        <Box style={{ marginTop: 12 }}>
          <Typography variant="subtitle2">Elementos guardados</Typography>
          <Box style={{ marginTop: 8 }}>
            {svgElements.length === 0 ? (
              <Typography variant="body2" style={{ color: '#666' }}>No hay elementos guardados</Typography>
            ) : svgElements.map((el) => (
              <Box key={el.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 6, borderBottom: '1px solid #eee' }}>
                <div style={{ width: 112, height: 112, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #f0f0f0', padding: 8, boxSizing: 'border-box', background: '#fff' }}>
                  <div dangerouslySetInnerHTML={{ __html: normalizeSvgForPreview(el.svg || '', 96, 96) }} />
                </div>
                <div style={{ flex: 1 }}>
                  <Typography variant="body2" style={{ fontWeight: 600 }}>{el.name}</Typography>
                  <Typography variant="caption" style={{ color: '#666' }}>{el.description}</Typography>
                </div>
                <Box style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Button size="small" onClick={() => copyElementToEditor(el)}>Copiar al editor</Button>
                  <Button size="small" color="error" onClick={() => onDeleteElement(el)}>Eliminar</Button>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={onSaveSvgElement} variant="contained">Guardar elemento SVG</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SvgEditorDialog;
