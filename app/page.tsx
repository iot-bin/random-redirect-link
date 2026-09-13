import { ConsoleLoader } from '@/app/components/ConsoleLoader';
import { managementFetch } from '@/lib/management-api';
import { AuthError } from '@/lib/session';
import type { ConsoleContext } from '@/app/components/ConsoleLoader';

export default async function HomePage() {
  let initialData: ConsoleContext | null = null;
  let initialError = '';
  try {
    // Rendering can read cookies; token renewal must use the browser's route handler.
    const response = await managementFetch('/me', 'GET', undefined, false);
    if (response.ok) initialData = await response.json();
    else {
      await response.body?.cancel();
      if (response.status !== 401) initialError = 'UPSTREAM_UNAVAILABLE';
    }
  } catch (error) {
    if (!(error instanceof AuthError && error.status === 401)) initialError = 'UPSTREAM_UNAVAILABLE';
  }
  return <ConsoleLoader initialData={initialData} initialError={initialError} />;
}
