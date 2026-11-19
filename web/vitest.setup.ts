import { cleanup, configure } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach } from 'vitest';
import { MotionGlobalConfig } from 'motion/react';
import { server } from '@/test/server';

// A loaded machine running many files at once can take over a second to settle a request.
configure({ asyncUtilTimeout: 3000 });

// Tests must not wait on animation frames or exit animations.
MotionGlobalConfig.skipAnimations = true;

// Node's Request rejects relative URLs; browsers resolve them against the page origin.
const NativeRequest = globalThis.Request;
if (typeof location !== 'undefined') {
  globalThis.Request = class extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(typeof input === 'string' ? new URL(input, location.href) : input, init);
    }
  };
}

// Listening at import time patches fetch before openapi-fetch captures it.
server.listen({ onUnhandledFrame: 'error' });
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});
