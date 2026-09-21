/**
 * Toast system — disabled.
 * For minimal UI, we suppress all toasts.
 * Replace this file to re-enable.
 */
import { createContext, useContext } from "react";

const noop = () => {};
const api = { success: noop, error: noop, info: noop };
const ToastContext = createContext(api);

export function ToastProvider({ children }) {
  return <ToastContext.Provider value={api}>{children}</ToastContext.Provider>;
}

export function useToast() {
  return useContext(ToastContext) || api;
}
