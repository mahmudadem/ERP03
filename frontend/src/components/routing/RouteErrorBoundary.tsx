import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';

const CHUNK_RELOAD_KEY = 'erp03:chunk-load-reload-attempted';

function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : String((error as { message?: unknown } | null)?.message ?? '');

  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('ChunkLoadError')
  );
}

export function RouteErrorBoundary() {
  const error = useRouteError();
  const isChunkError = isChunkLoadError(error);

  useEffect(() => {
    if (!isChunkError) return;

    const reloadKey = `${CHUNK_RELOAD_KEY}:${window.location.pathname}${window.location.hash}`;
    if (sessionStorage.getItem(reloadKey)) return;

    sessionStorage.setItem(reloadKey, '1');
    window.location.reload();
  }, [isChunkError]);

  if (isChunkError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-center text-slate-800">
        <div>
          <h1 className="text-lg font-semibold">Updating the app...</h1>
          <p className="mt-2 text-sm text-slate-600">Refreshing this page to load the latest version.</p>
        </div>
      </div>
    );
  }

  throw error;
}
