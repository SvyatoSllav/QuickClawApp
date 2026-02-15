import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

export function useInitAuth() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);
}
