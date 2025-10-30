"use client";
import ThemeWrapper from "@/wrappers/ThemeWrapper";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ReactNode } from "react";
import { Provider } from "react-redux";
import { ToastContainer } from "react-toastify";
import { PersistGate } from "redux-persist/integration/react";
import { queryClient } from "@/lib/queryClient";
import { persistor, store } from "./store";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <ThemeWrapper>{children}</ThemeWrapper>
          <ToastContainer autoClose={3000} />
        </PersistGate>
      </Provider>
      {/* React Query Devtools - only shows in development */}
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
