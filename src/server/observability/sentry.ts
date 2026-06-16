let initialized = false;
let sentryModulePromise: Promise<SentryModule | null> | null = null;

type SentryScope = {
  setTag: (key: string, value: string) => void;
  setExtra: (key: string, value: unknown) => void;
  setLevel: (level: "error") => void;
};

type SentryModule = {
  init: (options: {
    dsn: string | undefined;
    environment: string;
    tracesSampleRate: number;
  }) => void;
  withScope: (callback: (scope: SentryScope) => void) => void;
  captureException: (error: Error) => void;
};

function shouldEnableSentry() {
  return Boolean(process.env.SENTRY_DSN);
}

async function loadSentryModule() {
  if (!sentryModulePromise) {
    const importModule = new Function("specifier", "return import(specifier)") as (
      specifier: string,
    ) => Promise<SentryModule>;

    sentryModulePromise = importModule("@sentry/node").catch((error: unknown) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn(error instanceof Error ? error.message : "Failed to load Sentry.");
      }

      return null;
    });
  }

  return sentryModulePromise;
}

async function initSentry() {
  if (initialized || !shouldEnableSentry()) {
    return null;
  }

  const Sentry = await loadSentryModule();

  if (!Sentry) {
    return null;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0,
  });
  initialized = true;

  return Sentry;
}

type SafeContext = {
  tags?: Record<string, string | number | boolean>;
  extra?: Record<string, unknown>;
};

export function captureServerException(error: unknown, context: SafeContext = {}) {
  if (!shouldEnableSentry()) {
    return;
  }

  void captureServerExceptionAsync(error, context);
}

async function captureServerExceptionAsync(error: unknown, context: SafeContext) {
  const Sentry = await initSentry();

  if (!Sentry) {
    return;
  }

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
