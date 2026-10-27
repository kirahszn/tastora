"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during server render and hydration, true after. Lets a page read browser storage on
 * its first client render without a hydration mismatch (and without setState in an effect).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
