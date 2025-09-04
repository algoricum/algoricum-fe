import { type AnyAction } from "@reduxjs/toolkit";

export function ensureMutators<T>(obj: {
  // to typecheck and make sure all actions have a mutator
  [key in keyof T]: (payload?: any) => AnyAction;
}) {
  if (!obj) throw new Error("need mutators");
}
