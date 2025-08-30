import React, { useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals } from 'reactflow';
import SYMBOLS, { SymbolEntry } from './symbols';

type SymbolNodeProps = {
  id: string;
  data: { symbolKey: string; rotation?: number; scale?: number; flipX?: boolean; flipY?: boolean; invertHandles?: boolean };
  selected?: boolean;
};

const SymbolNode: React.FC<SymbolNodeProps> = ({ id, data, selected }) => {
  const { symbolKey } = data;
  const entry = (SYMBOLS as Record<string, SymbolEntry | undefined>)[symbolKey];
  const symbol = entry?.svg ?? null;
  const size = entry?.size ?? { w: 48, h: 48 };
  const rotation = data.rotation ?? 0;
  const scale = data.scale ?? 1;
  const flipX = data.flipX ?? false;
  const flipY = data.flipY ?? false;
  const invertHandles = data.invertHandles ?? false;

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
      handles.push({ id: 'r_top', position: Position.Right, type: 'target', offset: '20%' });
      handles.push({ id: 'r_bottom', position: Position.Right, type: 'target', offset: '80%' });
      handles.push({ id: 't_left', position: Position.Top, type: 'source', offset: '20%' });
      handles.push({ id: 't_right', position: Position.Top, type: 'source', offset: '40%' });
      handles.push({ id: 'b_left', position: Position.Bottom, type: 'target', offset: '20%' });
      handles.push({ id: 'b_right', position: Position.Bottom, type: 'target', offset: '40%' });
      break;
    case 'disconnector':
      handles.push({ id: 'left', position: Position.Left, type: 'source' });
      handles.push({ id: 'right', position: Position.Right, type: 'source' });
      break;
    case 'tierra':
      handles.push({ id: 'top', position: Position.Top, type: 'source' });
      break;
  }

  // Grid alignment constant (should match App.tsx GRID_SIZE)
  const GRID_SIZE = 1;

  // Helper function to snap to grid
  const snapToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;

  // Helper function to rotate a point around the center
  const rotatePoint = (x: number, y: number, centerX: number, centerY: number, angleDeg: number) => {
    const angleRad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const dx = x - centerX;
    const dy = y - centerY;
    return {
      x: centerX + dx * cos - dy * sin,
      y: centerY + dx * sin + dy * cos,
    };
  };

  // Helper function to rotate handle direction
  const rotateHandlePosition = (originalPosition: Position, angleDeg: number): Position => {
    const normalizedAngle = ((angleDeg % 360) + 360) % 360;
    
    switch (originalPosition) {
      case Position.Top:
        if (normalizedAngle === 90) return Position.Right;
        if (normalizedAngle === 180) return Position.Bottom;
        if (normalizedAngle === 270) return Position.Left;
        return Position.Top;
      case Position.Right:
        if (normalizedAngle === 90) return Position.Bottom;
        if (normalizedAngle === 180) return Position.Left;
        if (normalizedAngle === 270) return Position.Top;
        return Position.Right;
      case Position.Bottom:
        if (normalizedAngle === 90) return Position.Left;
        if (normalizedAngle === 180) return Position.Top;
        if (normalizedAngle === 270) return Position.Right;
        return Position.Bottom;
      case Position.Left:
        if (normalizedAngle === 90) return Position.Top;
        if (normalizedAngle === 180) return Position.Right;
        if (normalizedAngle === 270) return Position.Bottom;
        return Position.Left;
      default:
        return originalPosition;
    }
  };

  // Helper function to apply flip transformations to handle direction
  const applyFlipToPosition = (position: Position, flipX: boolean, flipY: boolean): Position => {
    let result = position;
    
    // Apply flipX (horizontal flip)
    if (flipX) {
      switch (result) {
        case Position.Left:
          result = Position.Right;
          break;
        case Position.Right:
          result = Position.Left;
          break;
        // Top and Bottom remain the same for horizontal flip
      }
    }
    
    // Apply flipY (vertical flip)
    if (flipY) {
      switch (result) {
        case Position.Top:
          result = Position.Bottom;
          break;
        case Position.Bottom:
          result = Position.Top;
          break;
        // Left and Right remain the same for vertical flip
      }
    }
    
    return result;
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        // Keep the container size fixed to original size
        width: size.w,
        height: size.h,
        // apply uniform positive scale to the wrapper; rotation will be applied to the inner symbol
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        padding: 0,
      }}
    >
      {handles.map((h) => {
        // Invertir el tipo de handle si invertHandles está activo
        const handleType = invertHandles ? (h.type === 'source' ? 'target' : 'source') : h.type;
        
        const HANDLE_SIZE = 8;
        const HANDLE_GAP = 0; // gap between node edge and handle
        const baseStyle: React.CSSProperties = {
          position: 'absolute',
          background: handleType === 'source' ? '#22c55e' : '#ef4444', // verde para source, rojo para target
          width: HANDLE_SIZE,
          height: HANDLE_SIZE,
          borderRadius: HANDLE_SIZE / 2,
          borderColor: '#111111',
          zIndex: 10,
        };

        const posStyle: React.CSSProperties = {};

        // Calculate handle position based on original position and rotation
        const centerX = size.w / 2;
        const centerY = size.h / 2;
        const outerOffsetPx =0* HANDLE_SIZE + HANDLE_GAP;

        // Original position coordinates (before rotation) - align to grid
        let originalX: number, originalY: number;

        if (h.position === Position.Right) {
          originalX = snapToGrid(size.w + HANDLE_GAP);
          originalY = h.offset ?
            (typeof h.offset === 'number' ? snapToGrid(h.offset) : snapToGrid((parseFloat(h.offset) / 100) * size.h)) :
            snapToGrid(size.h / 2);
        } else if (h.position === Position.Left) {
          originalX = snapToGrid(-outerOffsetPx);
          originalY = h.offset ?
            (typeof h.offset === 'number' ? snapToGrid(h.offset) : snapToGrid((parseFloat(h.offset) / 100) * size.h)) :
            snapToGrid(size.h / 2);
        } else if (h.position === Position.Top) {
          originalX = h.offset ?
            (typeof h.offset === 'number' ? snapToGrid(h.offset) : snapToGrid((parseFloat(h.offset) / 100) * size.w)) :
            snapToGrid(size.w / 2);
          originalY = snapToGrid(-outerOffsetPx);
        } else { // Position.Bottom
          originalX = h.offset ?
            (typeof h.offset === 'number' ? snapToGrid(h.offset) : snapToGrid((parseFloat(h.offset) / 100) * size.w)) :
            snapToGrid(size.w / 2);
          originalY = snapToGrid(size.h + HANDLE_GAP);
        }

        // Start with original coordinates
        let finalX = originalX;
        let finalY = originalY;

        // Apply flips first to match the CSS transform order (rotate then flip)
        if (flipX) {
          finalX = size.w - finalX;
        }
        if (flipY) {
          finalY = size.h - finalY;
        }

        // Apply rotation after flips
        if (rotation !== 0) {
          const rotated = rotatePoint(finalX, finalY, centerX, centerY, rotation);
          finalX = rotated.x;
          finalY = rotated.y;
        }

        // Snap final positions to grid for better alignment
        finalX = snapToGrid(finalX);
        finalY = snapToGrid(finalY);

        // Set final position
        posStyle.left = `${finalX}px`;
        posStyle.top = `${finalY}px`;
        posStyle.transform = 'translate(-50%, -50%)';

        // Calculate handle position with all transformations applied in the same order as CSS
        // Order: original -> flip -> rotate (to match CSS: rotate(angle) scaleX() scaleY())
        let transformedPosition = h.position;
        
        // Apply flips first
        transformedPosition = applyFlipToPosition(transformedPosition, flipX, flipY);
        
        // Then apply rotation
        if (rotation !== 0) {
          transformedPosition = rotateHandlePosition(transformedPosition, rotation);
        }

        return (
          <Handle
            key={h.id}
            id={h.id}
            type={handleType}
            position={transformedPosition}
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
          // Add dotted border when selected (now it rotates with the symbol)
          border: selected ? '2px dashed #0078d4' : 'none',
          borderRadius: selected ? '4px' : '0',
          boxSizing: 'border-box',
        }}
      >
        {symbol}
      </div>
    </div>
  );
};

export default React.memo(SymbolNode);
