/**
 * Typed Redux hooks.
 *
 * Pre-typed `useSelector`/`useDispatch` so components never have to annotate
 * the store shape themselves.
 */

import { useDispatch, useSelector } from "react-redux";
import type { TypedUseSelectorHook } from "react-redux";
import type { RootState, AppDispatch } from "./store";

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
