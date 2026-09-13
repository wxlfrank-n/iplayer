/**
 * App configuration backed by Redux.
 *
 * Thin wrapper over the `config` slice so existing consumers keep the
 * `{ config, updateConfig }` shape while the actual state lives in the store.
 */

import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { updateConfig as updateConfigAction } from "../store/configSlice";

export type { WaveformView } from "../types";

export function useConfig() {
  const config = useAppSelector((s) => s.config);
  const dispatch = useAppDispatch();

  const updateConfig = useCallback(
    (partial: Partial<typeof config>) => {
      dispatch(updateConfigAction(partial));
    },
    [dispatch],
  );

  return { config, updateConfig };
}
