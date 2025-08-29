import React from 'react';
import { Handle, Position } from 'reactflow';
import SYMBOLS, { SymbolEntry } from './symbols';

type SymbolNodeProps = {
  data: { symbolKey: string };
};

const SymbolNode: React.FC<SymbolNodeProps> = ({ data }) => {
  const { symbolKey } = data;
  const entry = (SYMBOLS as Record<string, SymbolEntry | undefined>)[symbolKey];
  const symbol = entry?.svg ?? null;
  const size = entry?.size ?? { w: 48, h: 48 };

  // Define connection points per symbol type
  const handles: { id: string; position: Position; type: 'source' | 'target' }[] = [];
  switch (symbolKey) {
    case 'bus':
      handles.push({ id: 'left', position: Position.Left, type: 'source' });
      handles.push({ id: 'right', position: Position.Right, type: 'source' });
      break;
    case 'trafo':
      handles.push({ id: 'top', position: Position.Top, type: 'source' });
      handles.push({ id: 'bottom', position: Position.Bottom, type: 'target' });
      break;
    case 'breaker':
    case 'disconnector':
      handles.push({ id: 'left', position: Position.Left, type: 'source' });
      handles.push({ id: 'right', position: Position.Right, type: 'source' });
      break;
    case 'tierra':
      handles.push({ id: 'top', position: Position.Top, type: 'source' });
      break;
    default:
      handles.push({ id: 'left', position: Position.Left, type: 'source' });
      handles.push({ id: 'right', position: Position.Right, type: 'source' });
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {handles.map((h) => (
        <Handle
          key={h.id}
          id={h.id}
          type={h.type}
          position={h.position}
          style={{ background: '#555', width: 10, height: 10, borderRadius: 4 }}
        />
      ))}
  <div style={{ width: size.w, height: size.h, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{symbol}</div>
    </div>
  );
};

export default SymbolNode;
