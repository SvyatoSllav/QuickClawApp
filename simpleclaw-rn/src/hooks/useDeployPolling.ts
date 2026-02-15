import { useEffect } from 'react';
import { useDeployStore } from '../stores/deployStore';

export function useDeployPolling() {
  const startPolling = useDeployStore((s) => s.startPolling);
  const stopPolling = useDeployStore((s) => s.stopPolling);

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);
}
