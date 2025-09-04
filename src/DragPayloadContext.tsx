import React, { createContext, useContext, useState } from 'react';

export type SvgElementOrNull = any | null;
export type DragPayload = { symbolKey: string; svgElement?: SvgElementOrNull } | null;

export type DragContextType = {
  setPayload: (p: DragPayload) => void;
  getPayload: () => DragPayload;
  clearPayload: () => void;
};

export const DragPayloadContext = createContext<DragContextType>({
  setPayload: () => {},
  getPayload: () => null,
  clearPayload: () => {},
});

export const useDragPayload = () => useContext(DragPayloadContext);

export const DragPayloadProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [payload, setPayloadState] = useState<DragPayload>(null);

  const setPayload = (p: DragPayload) => setPayloadState(p);
  const getPayload = () => payload;
  const clearPayload = () => setPayloadState(null);

  return (
    <DragPayloadContext.Provider value={{ setPayload, getPayload, clearPayload }}>
      {children}
    </DragPayloadContext.Provider>
  );
};

export default DragPayloadContext;
