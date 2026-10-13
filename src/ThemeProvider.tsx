/**
 * Applies the selected theme from the config store to the document as CSS
 * custom properties. Mounted just inside the Redux Provider, above the DnD
 * context, so every descendant (and the body background) picks it up.
 */

import {useEffect, type ReactNode} from 'react';
import {useConfig} from './hooks/useConfig';
import {applyThemeVars} from './themes';

export function ThemeProvider({children}: {children: ReactNode}) {
  const {config} = useConfig();

  useEffect(() => {
    applyThemeVars(config.theme);
    // A `system` theme must track OS appearance changes live.
    if (config.theme !== 'system' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyThemeVars('system');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [config.theme]);

  return <>{children}</>;
}
