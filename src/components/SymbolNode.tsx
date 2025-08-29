import React, { useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals } from 'reactflow';
import SYMBOLS, { SymbolEntry } from './symbols';

type SymbolNodeProps = {
  id: string;
  data: { symbolKey: string; rotation?: number; scale?: number; flipX?: boolean; flipY?: boolean };
};

const SymbolNode: React.FC<SymbolNodeProps> = ({ id, data }) => {
  const { symbolKey } = data;
  const entry = (SYMBOLS as Record<string, SymbolEntry | undefined>)[symbolKey];
  const symbol = entry?.svg ?? null;
  const size = entry?.size ?? { w: 48, h: 48 };
  const rotation = data.rotation ?? 0;
  const scale = data.scale ?? 1;
  const flipX = data.flipX ?? false;
  const flipY = data.flipY ?? false;

  // Ensure React Flow recalculates handle positions when rotation/scale changes
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
  if (!id || !updateNodeInternals) return;
  // schedule update after two frames so DOM transforms and layout have applied
  requestAnimationFrame(() => requestAnimationFrame(() => updateNodeInternals(id)));
  }, [id, rotation, scale, flipX, flipY, updateNodeInternals]);

  // Define connection points per symbol type
  // now supports an optional `offset` (px number or percentage string) to precisely position multiple handles on the same side
  const handles: { id: string; position: Position; type: 'source' | 'target'; offset?: number | string }[] = [];
  switch (symbolKey) {
    case 'bus':
      handles.push({ id: 'left', position: Position.Left, type: 'source' });
      handles.push({ id: 'right', position: Position.Right, type: 'source' });
      break;
    case 'trafo':
      handles.push({ id: 'top', position: Position.Top, type: 'source' });
      handles.push({ id: 'bottom', position: Position.Bottom, type: 'target' });
      break;
    case 'trafo_2':
      handles.push({ id: 'top', position: Position.Top, type: 'source' });
      handles.push({ id: 'left', position: Position.Left, type: 'target' });
      handles.push({ id: 'right', position: Position.Right, type: 'target' });
      break;
    case 'interruptor':
      handles.push({ id: 'left', position: Position.Left, type: 'source' });
      handles.push({ id: 'right', position: Position.Right, type: 'target' });
      break;
    case 'barras':
      handles.push({ id: 'r_top', position: Position.Right, type: 'target', offset: '22.5%' });
      handles.push({ id: 'r_bottom', position: Position.Right, type: 'target', offset: '77.5%' });
      break;
    case 'disconnector':
      handles.push({ id: 'left', position: Position.Left, type: 'source' });
      handles.push({ id: 'right', position: Position.Right, type: 'source' });
      break;
    case 'tierra':
      handles.push({ id: 'top', position: Position.Top, type: 'source' });
      break;
  }

  return (
      <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        // apply uniform positive scale to the wrapper; rotation will be applied to the inner symbol
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
      }}
    >
      {handles.map((h) => {
        const baseStyle: React.CSSProperties = {
          position: 'absolute',
          background: '#555',
          width: 8,
          height: 8,
          borderRadius: 4,
          zIndex: 10,
        };

        const posStyle: React.CSSProperties = {};
        // Determine effective position after rotation and flip
        let effectivePos = h.position;
        // Normalize rotation to [0,360)
        const rotNorm = ((rotation % 360) + 360) % 360;
        const rotSteps = Math.round(rotNorm / 90) % 4; // number of 90deg clockwise steps
        // rotate position clockwise rotSteps times
        for (let i = 0; i < rotSteps; i++) {
          if (effectivePos === Position.Right) effectivePos = Position.Bottom;
          else if (effectivePos === Position.Bottom) effectivePos = Position.Left;
          else if (effectivePos === Position.Left) effectivePos = Position.Top;
          else if (effectivePos === Position.Top) effectivePos = Position.Right;
        }
        // apply flips (after rotation)
        if (flipX) {
          if (effectivePos === Position.Left) effectivePos = Position.Right;
          else if (effectivePos === Position.Right) effectivePos = Position.Left;
        }
        if (flipY) {
          if (effectivePos === Position.Top) effectivePos = Position.Bottom;
          else if (effectivePos === Position.Bottom) effectivePos = Position.Top;
        }

        // offset: number => pixels, string => percent (e.g. '30%') or px with unit
        let offsetValue = typeof h.offset === 'number' ? `${h.offset}px` : h.offset ?? '50%';

        // Mirror offsets when flipped along the relevant axis
        const mirrorPercent = (s: string) => {
          const num = parseFloat(s.replace('%', '')) || 0;
          return `${100 - num}%`;
        };
  // When rotated by 90/270 the symbol width/height are effectively swapped for offset calculations
  const rotatedSize = (rotSteps % 2 === 0) ? { w: size.w, h: size.h } : { w: size.h, h: size.w };
  const mirrorPx = (n: number, dim: number) => `${Math.max(0, dim - n)}px`;

        // For Left/Right handles, offset is a 'top' percentage/px relative to height
        if (effectivePos === Position.Left || effectivePos === Position.Right) {
          if (flipY) {
            if (typeof h.offset === 'number') offsetValue = mirrorPx(h.offset, rotatedSize.h ?? 0);
            else if (typeof h.offset === 'string' && h.offset.trim().endsWith('%')) offsetValue = mirrorPercent(h.offset);
          }
        }
        // For Top/Bottom handles, offset is a 'left' percentage/px relative to width
        if (effectivePos === Position.Top || effectivePos === Position.Bottom) {
          if (flipX) {
            if (typeof h.offset === 'number') offsetValue = mirrorPx(h.offset, rotatedSize.w ?? 0);
            else if (typeof h.offset === 'string' && h.offset.trim().endsWith('%')) offsetValue = mirrorPercent(h.offset);
          }
        }

        // Use percent-based placement with margins so handles are consistently outside the node
        if (effectivePos === Position.Right) {
          posStyle.left = '100%';
          posStyle.marginLeft = '0px';
          posStyle.top = offsetValue;
          posStyle.transform = 'translateY(-50%)';
        } else if (effectivePos === Position.Left) {
          posStyle.left = '0%';
          // push leftwards by handle size + gap (8px handle + 6px gap = 14px)
          posStyle.marginLeft = '-6px';
          posStyle.top = offsetValue;
          posStyle.transform = 'translateY(-50%)';
        } else if (effectivePos === Position.Top) {
          posStyle.top = '0%';
          posStyle.marginTop = '-6px';
          posStyle.left = offsetValue;
          posStyle.transform = 'translateX(-50%)';
        } else if (effectivePos === Position.Bottom) {
          posStyle.top = '100%';
          posStyle.marginTop = '0px';
          posStyle.left = offsetValue;
          posStyle.transform = 'translateX(-50%)';
        }

        return (
          <Handle
            key={h.id}
            id={h.id}
            type={h.type}
            position={effectivePos}
            style={{ ...baseStyle, ...posStyle }}
          />
        );
      })}

      <div
        style={{
          width: size.w,
          height: size.h,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // apply rotation and flip to the inner symbol so the visual rotates but handles remain in wrapper coordinates
          transform: `rotate(${rotation}deg) scaleX(${flipX ? -1 : 1}) scaleY(${flipY ? -1 : 1})`,
          transformOrigin: 'center center',
        }}
      >
        {symbol}
      </div>
    </div>
  );
};

export default SymbolNode;
