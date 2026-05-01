import { inferProductArea } from "@/lib/tool-runner";
import type {
  AccountRecord,
  DocEvidenceItem,
  ErrorEventRecord,
  FeatureFlagRecord,
  InvestigationMode
} from "@/lib/types/investigation";

export function findRelevantFlags(flags: FeatureFlagRecord[], productArea: string | null) {
  if (!productArea) {
    return flags;
  }

  const needle = productArea.slice(0, -1);
  return flags.filter((flag) => flag.flagKey.toLowerCase().includes(needle) || flag.flagKey.toLowerCase().includes(productArea));
}

export function accountHasModule(account: AccountRecord | null, productArea: string | null) {
  if (!account || !productArea) {
    return false;
  }

  const candidates = new Set([productArea.toLowerCase(), productArea.slice(0, -1).toLowerCase()]);

  return account.enabledModules.some((module) => candidates.has(module.toLowerCase()));
}

export function detectConflict(input: {
  mode: InvestigationMode;
  ticket: string;
  docEvidence: DocEvidenceItem[];
  account: AccountRecord | null;
  flags: FeatureFlagRecord[];
  errors: ErrorEventRecord[];
  missingRequiredContext: boolean;
}) {
  if (input.missingRequiredContext || input.mode !== "docs_plus_tools") {
    return {
      hasConflict: false,
      reason: null
    };
  }

  const productArea = inferProductArea(input.ticket);
  const relevantFlags = findRelevantFlags(input.flags, productArea);
  const hasDisabledFlag = relevantFlags.some((flag) => !flag.flagValue);
  const hasRecentErrors = input.errors.length > 0;
  const hasModule = accountHasModule(input.account, productArea);
  const accountInactive = input.account ? input.account.status.toLowerCase() !== "active" : false;
  const docsSuggestProcedure = input.docEvidence.length > 0;
  const hasStructuredToolState = Boolean(input.account || input.flags.length || input.errors.length);

  if (!hasStructuredToolState) {
    return {
      hasConflict: false,
      reason: null
    };
  }

  if (accountInactive || hasDisabledFlag || !hasModule || hasRecentErrors) {
    return {
      hasConflict: false,
      reason: null
    };
  }

  if (docsSuggestProcedure) {
    return {
      hasConflict: true,
      reason: "Docs and current tool state do not explain the reported issue."
    };
  }

  return {
    hasConflict: false,
    reason: null
  };
}
