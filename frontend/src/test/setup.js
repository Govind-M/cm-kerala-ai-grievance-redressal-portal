import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
// Tests must mock transports: never reach a running backend/provider by accident.
beforeEach(() => {
  let queue = Promise.resolve();
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: vi.fn((_name, action) => {
      const next = queue.then(() => action());
      queue = next.catch(() => {});
      return next;
    }),
  } });
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network disabled in automated tests; mock the transport'));
  vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(() => {
    throw new Error('Network disabled in automated tests; mock the transport');
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
