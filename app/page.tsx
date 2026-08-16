import { ConsoleDashboard } from '@/app/components/ConsoleDashboard';
import {
  getDefaultTargetId,
  getPublicApiTargets,
} from '@/lib/api-targets';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <ConsoleDashboard
      targets={getPublicApiTargets()}
      defaultTargetId={getDefaultTargetId()}
    />
  );
}
