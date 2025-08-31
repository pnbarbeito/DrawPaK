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
  onInsertElement: (el: any) => void;
  onDeleteElement: (el: any) => void;
};

const SvgEditorDialog: React.FC<Props> = ({
  open, onClose, svgName, setSvgName, svgDescription, setSvgDescription,
  svgCategory, setSvgCategory, categories,
  svgHandles, setSvgHandles, svgMarkup, setSvgMarkup, useEditor, setUseEditor,
  sanitizedSvg, svgElements, onSaveSvgElement, onInsertElement, onDeleteElement
}) => {
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
                width={200}
                height={200}
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
                  <div dangerouslySetInnerHTML={{ __html: sanitizedSvg }} />
                ) : svgMarkup ? (
                  <div dangerouslySetInnerHTML={{ __html: svgMarkup }} />
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
          <Box style={{  marginTop: 8 }}>
            {svgElements.length === 0 ? (
              <Typography variant="body2" style={{ color: '#666' }}>No hay elementos guardados</Typography>
            ) : svgElements.map((el) => (
              <Box key={el.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 6, borderBottom: '1px solid #eee' }}>
                <div style={{ width: 112, height: 112, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #f0f0f0', padding: 8, boxSizing: 'border-box', background: '#fff' }}>
                  <div dangerouslySetInnerHTML={{ __html: el.svg || '' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <Typography variant="body2" style={{ fontWeight: 600 }}>{el.name}</Typography>
                  <Typography variant="caption" style={{ color: '#666' }}>{el.description}</Typography>
                </div>
                <Box style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Button size="small" onClick={() => onInsertElement(el)}>Insertar</Button>
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
