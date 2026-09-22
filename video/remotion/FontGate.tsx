import {useEffect, useState} from 'react';
import {cancelRender, continueRender, delayRender} from 'remotion';
import {FONT_FAMILY_NAME} from './theme';

/**
 * Holds the render (delayRender) until the self-hosted "Noto Sans JP Local"
 * face is loaded in this tab, then mounts its children.
 */
export const FontGate: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender('fonts', {timeoutInMilliseconds: 60_000}));

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      await Promise.all([
        document.fonts.load(`400 36px "${FONT_FAMILY_NAME}"`),
        document.fonts.load(`700 36px "${FONT_FAMILY_NAME}"`),
      ]);
      await document.fonts.ready;
      if (!document.fonts.check(`400 36px "${FONT_FAMILY_NAME}"`)) {
        throw new Error(`"${FONT_FAMILY_NAME}" did not load – is public/fonts/NotoSansJP.ttf present? Run \`node fonts.mjs\`.`);
      }
    };
    load()
      .then(() => {
        if (cancelled) {
          return;
        }
        setReady(true);
        continueRender(handle);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          cancelRender(err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [handle]);

  if (!ready) {
    return null;
  }
  return <>{children}</>;
};
