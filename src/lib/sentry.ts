import * as Sentry from "@sentry/react";

let initialized = false;

/** Initialise Sentry uniquement si un DSN est configuré (VITE_SENTRY_DSN). */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn || initialized) return;
  Sentry.init({
    dsn,
    tracesSampleRate: 0, // pas de tracing perf : uniquement les crashs
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    environment: import.meta.env.DEV ? "development" : "production",
  });
  initialized = true;
}

export function isSentryEnabled() {
  return initialized;
}

/** Remonte une erreur à Sentry si actif (no-op sinon). */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (!initialized) return;
  if (context) {
    Sentry.withScope((scope) => {
      scope.setExtras(context);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}
