import { QueryClient } from '@tanstack/react-query';

// Single QueryClient for the whole app. Imported by both the provider
// (providers/QueryProvider.tsx) and by contexts/services that need to do
// imperative cache work (prefetch / invalidate / setQueryData). Keeping
// one instance means imperative operations and component reads share the
// same cache.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,           // fresh for 1 minute
      gcTime: 300_000,             // unused data kept for 5 minutes
      retry: 1,
      refetchOnWindowFocus: false, // off — noisy during dev, rarely useful
    },
  },
});
