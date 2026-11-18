import { useCallback, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import useResource from '../public/useResource.js';

// Stable request key includes the current identity. No previous user's data survives a change.
export function usePortalResource(loader, key) {
  const { user } = useAuth();
  return useResource(loader, `${user?.id ?? 'anonymous'}:${key}`);
}
export function useMutation() {
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const run = useCallback(async (action) => {
    if (lock.current) return;
    lock.current = true; setPending(true);
    try { return await action(); } finally { lock.current = false; setPending(false); }
  }, []);
  return { pending, run };
}
