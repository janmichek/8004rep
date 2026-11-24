import type { ReputationReport } from '../../../lib/explorer/data/reputation/report';
import type { Feedback } from '../../../lib/explorer/data/types';
import { MethodsAlternatives } from './MethodsAlternatives';
import { MethodsDownload } from './MethodsDownload';
import { MethodsFunnel } from './MethodsFunnel';
import { MethodsKinds } from './MethodsKinds';
import { MethodsParameters } from './MethodsParameters';
import { MethodsResponsiveness } from './MethodsResponsiveness';

export function MethodsTab({ rep, feedback }: { rep: ReputationReport; feedback: Feedback[] }) {
  return (
    <>
      <MethodsAlternatives rep={rep} />
      <MethodsFunnel rep={rep} />
      <MethodsKinds rep={rep} />
      <MethodsResponsiveness rep={rep} />
      <MethodsParameters rep={rep} />
      <MethodsDownload rep={rep} feedback={feedback} />
    </>
  );
}
