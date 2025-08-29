import React from 'react';

export type SymbolEntry = {
  svg: React.ReactNode;
  size?: { w: number; h: number };
};

export const SYMBOLS: Record<string, SymbolEntry> = {
  transformer: {
    svg: (
      <svg viewBox="0 0 100 150" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="55" r="30" stroke="#000" strokeWidth="2" fill="none" />
        <circle cx="50" cy="90" r="30" stroke="#000" strokeWidth="2" fill="none" />
        <path d="M50 0 L50 25" stroke="#000" strokeWidth="2" />
        <path d="M50 120 L50 150" stroke="#000" strokeWidth="2" />
      </svg>
    ),
    size: { w: 80, h: 120 },
  },
  breaker: {
    svg: (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="35" width="60" height="30" stroke="#000" strokeWidth="4" fill="none" />
        <path d="M30 50 L70 50" stroke="#000" strokeWidth="4" />
        <circle cx="50" cy="50" r="6" stroke="#000" strokeWidth="4" fill="#fff" />
      </svg>
    ),
    size: { w: 48, h: 48 },
  },
  disconnector: {
    svg: (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 50 L80 50" stroke="#000" strokeWidth="6" />
        <path d="M35 35 L65 65" stroke="#000" strokeWidth="6" />
      </svg>
    ),
    size: { w: 56, h: 56 },
  },
  bus: {
    svg: (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <rect x="15" y="40" width="70" height="8" fill="#000" />
      </svg>
    ),
    size: { w: 80, h: 24 },
  },
  earth: {
    svg: (
      <svg viewBox="0 0 25 35" xmlns="http://www.w3.org/2000/svg">
        <g>
          <path d="M0.5 24.5 L24.5 24.5" fill="none" stroke="#000" strokeWidth={1} strokeLinecap="butt" strokeLinejoin="miter" />
          <path d="M4.5 27.5 L20.5 27.5" fill="none" stroke="#000" strokeWidth={1} strokeLinecap="butt" strokeLinejoin="miter" />
          <path d="M16.5 30.5 L8.5 30.5" fill="none" stroke="#000" strokeWidth={1} strokeLinecap="butt" strokeLinejoin="miter" />
          <path d="M12.5 24.5 L12.5 4.5" fill="none" stroke="#000" strokeWidth={1} strokeLinecap="butt" strokeLinejoin="miter" />
        </g>
      </svg>
    ),
    size: { w: 32, h: 48 },
  },
};

export default SYMBOLS;
