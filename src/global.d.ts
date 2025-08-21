// global.d.ts
export {};

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    JF: any; // or a more specific type if available
  }
}
