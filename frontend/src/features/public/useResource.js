import { useEffect, useState } from 'react';

// Abort old routes/requests; never retain a previous identity's tracking result.
export default function useResource(loader, key = '') {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ key: null, loading: true, data: null, error: null });
  useEffect(() => {
    const controller = new AbortController();
    setState({ key, loading: true, data: null, error: null });
    Promise.resolve().then(() => loader(controller.signal)).then(
      (data) => { if (!controller.signal.aborted) setState({ key, loading: false, data, error: null }); },
      (error) => { if (!controller.signal.aborted) setState({ key, loading: false, data: null, error }); },
    );
    return () => controller.abort();
  }, [loader, key, attempt]);
  return {
    ...(state.key === key ? state : { loading: true, data: null, error: null }),
    retry: () => setAttempt((value) => value + 1),
  };
}
