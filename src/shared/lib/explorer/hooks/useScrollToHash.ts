import { useEffect } from 'react';
import { useRouterState } from '@tanstack/react-router';

/** Restores the old router scroll behaviour: hash target offset, otherwise top. */
export function useScrollToHash() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const hash = useRouterState({ select: (state) => state.location.hash });

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.replace(/^#/, ''));

      if (target)
        window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 84 });

      return;
    }

    window.scrollTo({ top: 0 });
  }, [pathname, hash]);
}
