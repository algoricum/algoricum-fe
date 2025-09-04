// global.d.ts
export {};

declare global {
  interface Window {
    JF: any; // or a more specific type if available
  }
}
