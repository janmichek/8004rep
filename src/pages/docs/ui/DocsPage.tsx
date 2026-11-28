import { useEffect, useState } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { DocsApi } from './DocsApi';
import { DocsCalibration } from './DocsCalibration';
import { DocsExamples } from './DocsExamples';
import { DocsFooter } from './DocsFooter';
import { DocsGlossary } from './DocsGlossary';
import { DocsHero } from './DocsHero';
import { DocsHow } from './DocsHow';
import { DocsLimits } from './DocsLimits';
import { DocsMetrics } from './DocsMetrics';
import { DocsRules } from './DocsRules';
import { DocsSources } from './DocsSources';

const FLASH_MS = 2200;

// Landing on a section does not scroll (see router scrollBehavior); it just
// flashes the target so the reader's eye finds it.
function flashSection(hash: string): void {
  const id = hash.replace(/^#/, '');

  if (!id) return;

  const el = document.getElementById(id);

  if (!el) return;

  el.classList.remove('docs-flash');
  void el.offsetWidth;
  el.classList.add('docs-flash');
  window.setTimeout(() => el.classList.remove('docs-flash'), FLASH_MS);
}

export function DocsPage() {
  const [hash, setHash] = useState(() => window.location.hash);
  const routerHash = useRouterState({ select: (state) => state.location.hash });

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);

    window.addEventListener('hashchange', onHashChange);

    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    flashSection(routerHash || hash);
  }, [hash, routerHash]);

  return (
    <div className="docs">
      <DocsHero />
      <DocsGlossary />
      <DocsHow />
      <DocsRules />
      <DocsMetrics />
      <DocsExamples />
      <DocsCalibration />
      <DocsApi />
      <DocsLimits />
      <DocsSources />
      <DocsFooter />
    </div>
  );
}
