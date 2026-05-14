import * as Sentry from "@sentry/node";

let initialized = false;

function shouldEnableSentry() {
  return Boolean(process.env.SENTRY_DSN);
}

function initSentry() {
  if (initialized || !shouldEnableSentry()) {
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0
  });
  initialized = true;
}

type SafeContext = {
  tags?: Record<string, string | number | boolean>;
  extra?: Record<string, unknown>;
};

export function captureServerException(error: unknown, context: SafeContext = {}) {
  if (!shouldEnableSentry()) {
    return;
  }

  initSentry();
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context.tags ?? {})) {
      scope.setTag(key, String(value));
    }

    for (const [key, value] of Object.entries(context.extra ?? {})) {
      scope.setExtra(key, value);
    }

    scope.setLevel("error");
    Sentry.captureException(error instanceof Error ? error : new Error("Unknown server error"));
  });
}
