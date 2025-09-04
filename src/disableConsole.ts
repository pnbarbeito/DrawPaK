// Silence console output app-wide by replacing methods with no-ops.
// This avoids editing many files and accomplishes the "remove logs" goal.
const noop = () => {};
try {
  if (typeof console !== 'undefined') {
    // preserve original references in case some code depends on them being functions
    // but replace implementations with a no-op
    (console as any).log = noop;
    (console as any).info = noop;
    (console as any).warn = noop;
    (console as any).error = noop;
    (console as any).debug = noop;
  }
} catch (e) {
  // ignore failures to patch console in restricted environments
}

export {};
