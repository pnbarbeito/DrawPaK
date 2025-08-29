// Ambient declarations for Tauri JS modules used via dynamic import in the app
declare module '@tauri-apps/api/dialog' {
  export function save(options?: any): Promise<string | null>;
  export const open: any;
}

declare module '@tauri-apps/api/fs' {
  export function writeBinaryFile(options: { path: string; contents: Uint8Array | number[] | Buffer | ArrayBuffer }): Promise<void>;
  export function readBinaryFile(path: string): Promise<Uint8Array>;
}
