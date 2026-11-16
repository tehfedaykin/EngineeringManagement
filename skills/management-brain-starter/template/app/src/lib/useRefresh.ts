import { useState } from 'react';
import { useRouter } from '@tanstack/react-router';

/** Re-runs the current route's loaders, tracking whether a refresh is in flight. */
export function useRefresh() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await router.invalidate();
    } finally {
      setRefreshing(false);
    }
  }

  return { refresh, refreshing };
}
