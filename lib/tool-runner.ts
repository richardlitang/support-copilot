import { formatToolCitationLabel } from "@/lib/citations";
import type {
  AccountRecord,
  ErrorEventRecord,
  FeatureFlagRecord,
  ToolCallRecord,
  ToolEvidenceItem,
  ToolName,
} from "@/lib/types/investigation";

export type ToolRunnerDependencies = {
  getAccountContext: (accountId: string) => Promise<AccountRecord | null>;
  getFeatureFlags: (accountId: string) => Promise<FeatureFlagRecord[]>;
  getRecentErrors: (input: {
    accountId: string;
    productArea: string | null;
  }) => Promise<ErrorEventRecord[]>;
};

export function inferProductArea(ticket: string) {
  const normalized = ticket.toLowerCase();

  if (normalized.includes("export")) {
    return "exports";
  }

  if (normalized.includes("import") || normalized.includes("csv")) {
    return "imports";
  }

  if (normalized.includes("billing")) {
    return "billing";
  }

  if (normalized.includes("integration") || normalized.includes("install")) {
    return "integrations";
  }

  return null;
}

function formatLimits(limits: Record<string, unknown>) {
  const entries = Object.entries(limits);

  if (!entries.length) {
    return "no specific limits recorded";
  }

  return entries
    .map(
      ([key, value]) =>
        `${key}=${typeof value === "string" || typeof value === "number" ? value : JSON.stringify(value)}`,
    )
    .join(", ");
}

function summarizeAccountContext(account: AccountRecord | null) {
  if (!account) {
    return {
      title: "Account not found",
      excerpt: "No matching account record was found for the selected account id.",
      raw: { status: "not_found" },
    };
  }

  return {
    title: account.name,
    excerpt:
      `Plan: ${account.planTier}. Status: ${account.status}. ` +
      `Enabled modules: ${account.enabledModules.join(", ") || "none"}. ` +
      `Limits: ${formatLimits(account.limits)}.`,
    raw: account,
  };
}

function summarizeFeatureFlags(flags: FeatureFlagRecord[]) {
  if (!flags.length) {
    return {
      title: "No feature flags found",
      excerpt: "No feature flags were returned for this account.",
      raw: [],
    };
  }

  return {
    title: "Feature flags",
    excerpt: flags
      .map(
        (flag) =>
          `${flag.flagKey}=${flag.flagValue}${flag.description ? ` (${flag.description})` : ""}`,
      )
      .join("; "),
    raw: flags,
  };
}

function summarizeRecentErrors(errors: ErrorEventRecord[], productArea: string | null) {
  if (!errors.length) {
    return {
      title: "No recent errors found",
      excerpt: `No recent ${productArea ?? "product"} errors were returned for this account.`,
      raw: [],
    };
  }

  return {
    title: "Recent errors",
    excerpt: errors
      .map((error) => `${error.errorCode}: ${error.summary} (${error.occurredAt})`)
      .join("; "),
    raw: errors,
  };
}

export function createSyntheticToolEvidence(input: {
  toolName: ToolName;
  rank: number;
  title: string;
  excerpt: string;
  raw: unknown;
}) {
  return {
    evidence: {
      id: formatToolCitationLabel(input.rank),
      sourceType: "tool",
      toolName: input.toolName,
      title: input.title,
      excerpt: input.excerpt,
      raw: input.raw,
    } satisfies ToolEvidenceItem,
    call: {
      toolName: input.toolName,
      input: {},
      output: input.raw,
    } satisfies ToolCallRecord,
  };
}

type FetchedToolData = {
  account: AccountRecord | null;
  flags: FeatureFlagRecord[];
  errors: ErrorEventRecord[];
};

async function fetchDbTools(
  requiredTools: ToolName[],
  accountId: string,
  productArea: string | null,
  dependencies: ToolRunnerDependencies,
): Promise<FetchedToolData> {
  const needed = new Set(requiredTools);

  const [account, flags, errors] = await Promise.all([
    needed.has("getAccountContext")
      ? dependencies.getAccountContext(accountId)
      : Promise.resolve(null),
    needed.has("getFeatureFlags") ? dependencies.getFeatureFlags(accountId) : Promise.resolve([]),
    needed.has("getRecentErrors")
      ? dependencies.getRecentErrors({ accountId, productArea })
      : Promise.resolve([]),
  ]);

  return { account, flags, errors };
}

export async function collectToolArtifacts(input: {
  requiredTools: ToolName[];
  selectedAccountId?: string | null;
  investigationContext?: string | null;
  ticket: string;
  dependencies: ToolRunnerDependencies;
}) {
  const toolCalls: ToolCallRecord[] = [];
  const toolEvidence: ToolEvidenceItem[] = [];
  const productArea = inferProductArea(input.ticket);
  let toolRank = 1;

  // Fetch all DB-backed tools in parallel when an account is selected
  const fetched: FetchedToolData = input.selectedAccountId
    ? await fetchDbTools(
        input.requiredTools,
        input.selectedAccountId,
        productArea,
        input.dependencies,
      )
    : { account: null, flags: [], errors: [] };

  for (const toolName of input.requiredTools) {
    if (toolName === "getProvidedContext") {
      const contextText = input.investigationContext?.trim() ?? "";
      const synthetic = createSyntheticToolEvidence({
        toolName,
        rank: toolRank,
        title: "Provided investigation context",
        excerpt: contextText || "No investigation context was provided.",
        raw: {
          context: contextText || null,
        },
      });
      toolEvidence.push(synthetic.evidence);
      toolCalls.push({
        ...synthetic.call,
        input: {
          context: contextText || null,
        },
      });
      toolRank += 1;
      continue;
    }

    if (!input.selectedAccountId) {
      const synthetic = createSyntheticToolEvidence({
        toolName,
        rank: toolRank,
        title: "Tool not run",
        excerpt:
          "Seeded account context is required for this tool, but no debug account was selected for this investigation.",
        raw: {
          status: "not_run",
          reason: "missing_seeded_account",
        },
      });
      toolEvidence.push(synthetic.evidence);
      toolCalls.push({
        ...synthetic.call,
        input: {
          accountId: null,
        },
      });
      toolRank += 1;
      continue;
    }

    if (toolName === "getAccountContext") {
      const summary = summarizeAccountContext(fetched.account);
      toolEvidence.push({
        id: formatToolCitationLabel(toolRank),
        sourceType: "tool",
        toolName,
        title: summary.title,
        excerpt: summary.excerpt,
        raw: summary.raw,
      });
      toolCalls.push({
        toolName,
        input: { accountId: input.selectedAccountId },
        output: summary.raw,
      });
      toolRank += 1;
      continue;
    }

    if (toolName === "getFeatureFlags") {
      const summary = summarizeFeatureFlags(fetched.flags);
      toolEvidence.push({
        id: formatToolCitationLabel(toolRank),
        sourceType: "tool",
        toolName,
        title: summary.title,
        excerpt: summary.excerpt,
        raw: summary.raw,
      });
      toolCalls.push({
        toolName,
        input: { accountId: input.selectedAccountId },
        output: summary.raw,
      });
      toolRank += 1;
      continue;
    }

    const summary = summarizeRecentErrors(fetched.errors, productArea);
    toolEvidence.push({
      id: formatToolCitationLabel(toolRank),
      sourceType: "tool",
      toolName,
      title: summary.title,
      excerpt: summary.excerpt,
      raw: summary.raw,
    });
    toolCalls.push({
      toolName,
      input: { accountId: input.selectedAccountId, productArea },
      output: summary.raw,
    });
    toolRank += 1;
  }

  return {
    toolCalls,
    toolEvidence,
    account: fetched.account,
    flags: fetched.flags,
    errors: fetched.errors,
    productArea,
  };
}
