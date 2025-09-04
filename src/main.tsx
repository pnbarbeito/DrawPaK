import React from "react";
import ReactDOM from "react-dom/client";
// disableConsole must be imported first to silence logs globally
import "./disableConsole";
import App from "./App";
import { DragPayloadProvider } from './DragPayloadContext';

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <DragPayloadProvider>
      <App />
    </DragPayloadProvider>
  </React.StrictMode>,
);
