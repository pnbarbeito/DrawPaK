import React from 'react';

export type SymbolEntry = {
  svg: React.ReactNode;
  size?: { w: number; h: number };
};

export const SYMBOLS: Record<string, SymbolEntry> = {
  trafo: {
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
  trafo_2: {
    svg: (
      <svg viewBox="0 0 150 180" xmlns="http://www.w3.org/2000/svg">
        <circle cx="75" cy="55" r="30" stroke="#000" strokeWidth="2" fill="none" />
        <circle cx="55" cy="90" r="30" stroke="#000" strokeWidth="2" fill="none" />
        <circle cx="95" cy="90" r="30" stroke="#000" strokeWidth="2" fill="none" />
        <path d="M75 0 L75 25" stroke="#000" strokeWidth="2" />
        <path d="M0 90 L25 90" stroke="#000" strokeWidth="2" />
        <path d="M125 90 L150 90" stroke="#000" strokeWidth="2" />
      </svg>
    ),
    size: { w: 120, h: 160 },
  },
  interruptor: {
    svg: (
      <svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="30" width="80" height="40" stroke="#000" strokeWidth="2" fill="none" />
        <path d="M0 50 L35 50" stroke="#000" strokeWidth="2" />
        <path d="M85 50 L120 50" stroke="#000" strokeWidth="2" />
        <path d="M35 38 L85 50" stroke="#000" strokeWidth="2" />
      </svg>
    ),
    size: { w: 120, h: 80 },
  },
  disconnector: {
    svg: (
      <svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="25" width="80" height="50" stroke="#000" strokeWidth="2" fill="none" />
        <path d="M0 50 L35 50" stroke="#000" strokeWidth="2" />
        <path d="M85 50 L120 50" stroke="#000" strokeWidth="2" />
        <path d="M35 35 L85 50" stroke="#000" strokeWidth="2" />
      </svg>
    ),
    size: { w: 56, h: 56 },
  },
  barras: {
    svg: (
      <svg viewBox="0 0 100 200" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="4" height="200" fill="#000" />
        <path d="M0 50 L100 50" stroke="#000" strokeWidth="2" />
        <rect x="30" y="0" width="4" height="200" fill="#000" />
        <path d="M30 150 L100 150" stroke="#000" strokeWidth="2" />
      </svg>
    ),
    size: { w: 100, h: 200 },
  },
  tierra: {
    svg: (
      <svg viewBox="0 0 30 36" xmlns="http://www.w3.org/2000/svg">
        <g>
          <path d="M0 25 L30 25" fill="none" stroke="#000" strokeWidth={1} strokeLinecap="butt" strokeLinejoin="miter" />
          <path d="M5 28 L25 28" fill="none" stroke="#000" strokeWidth={1} strokeLinecap="butt" strokeLinejoin="miter" />
          <path d="M10 31 L20 31" fill="none" stroke="#000" strokeWidth={1} strokeLinecap="butt" strokeLinejoin="miter" />
          <path d="M13 34 L17 34" fill="none" stroke="#000" strokeWidth={1} strokeLinecap="butt" strokeLinejoin="miter" />
          <path d="M15 25 L15 0" fill="none" stroke="#000" strokeWidth={2} strokeLinecap="butt" strokeLinejoin="miter" />
        </g>
      </svg>
    ),
    size: { w: 40, h: 40 },
  },
  candado: {
    svg: (
      <svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
        {/* shackle */}
        <path d="M30 50 V34a20 20 0 0 1 40 0 V50" stroke="#0044ffff" strokeWidth={4} fill="none" strokeLinecap="round" />
        {/* body */}
        <rect x="18" y="50" width="64" height="54" rx="6" stroke="#0044ffff" strokeWidth={2} fill="#00aeffff" />
      </svg>
    ),
    size: { w: 60, h: 80 },
  },
};

export default SYMBOLS;
