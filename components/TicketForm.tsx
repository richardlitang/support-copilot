"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FlaskConical, Pencil, Plus, SearchCheck } from "lucide-react";
import type { DemoScenario } from "@/components/SupportCopilotShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { AccountRecord, InvestigationExecutionMode } from "@/lib/types/investigation";

export function TicketForm({
  accounts,
  demoScenarios,
  selectedAccountId,
  investigationContext,
  ticket,
  isInvestigating,
  isActiveStep,
  ragEnabled,
  executionMode,
  showDebugToggle,
  accountHint,
  focusContextToken,
  isReviewRetryActive,
  isCollapsed,
  onEdit,
  onSelectAccount,
  onInvestigationContextChange,
  onExecutionModeChange,
  onLoadScenario,
  onNewTicket,
  onToggleRag,
  onTicketChange,
  onSubmit
}: {
  accounts: AccountRecord[];
  demoScenarios: DemoScenario[];
  selectedAccountId: string | null;
  investigationContext: string;
  ticket: string;
  isInvestigating: boolean;
  isActiveStep: boolean;
  ragEnabled: boolean;
  executionMode: InvestigationExecutionMode;
  showDebugToggle: boolean;
  accountHint?: string | null;
  focusContextToken: number;
  isReviewRetryActive: boolean;
  isCollapsed: boolean;
  onEdit: () => void;
  onSelectAccount: (value: string | null) => void;
  onInvestigationContextChange: (value: string) => void;
  onExecutionModeChange: (value: InvestigationExecutionMode) => void;
  onLoadScenario: (scenario: DemoScenario) => void;
  onNewTicket: () => void;
  onToggleRag: (value: boolean) => void;
  onTicketChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const [showContext, setShowContext] = useState(false);
  const [showDemos, setShowDemos] = useState(false);
  const contextRef = useRef<HTMLTextAreaElement | null>(null);
  const contextExpanded = showContext || Boolean(investigationContext.trim());
  const lowerTicket = ticket.toLowerCase();
  const likelyNeedsContext = [
    "this customer",
    "workspace",
    "account",
    "plan",
    "tier",
    "limit",
    "missing",
    "not visible",
    "permission",
    "flag",
    "rollout",
    "enabled",
    "disabled",
    "error",
    "failed",
    "failing",
    "stalled",
    "after setup"
  ].some((term) => lowerTicket.includes(term));

  useEffect(() => {
    if (focusContextToken === 0) {
      return;
    }

    window.requestAnimationFrame(() => {
      contextRef.current?.focus();
      contextRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [focusContextToken]);

  if (isCollapsed) {
    return (
      <Card className="surface-shell overflow-hidden">
        <CardContent className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="eyebrow">Case input</p>
                {isInvestigating ? <Badge variant="warn">Investigating</Badge> : <Badge variant="secondary">Submitted</Badge>}
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-800">{ticket}</p>
              {investigationContext.trim() ? (
                <p className="mt-1 text-xs text-zinc-500">Context added</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
          {isInvestigating ? (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              <SearchCheck className="h-4 w-4 animate-pulse" />
              {executionMode === "evidence_only" ? "Finding evidence" : "Drafting answer"}
            </div>
          ) : null}
              {!isInvestigating ? (
                <Button type="button" variant="outline" size="sm" onClick={onNewTicket}>
                  <Plus className="h-4 w-4" />
                  New ticket
                </Button>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            </div>
          </div>
          {isInvestigating ? (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full w-1/2 animate-[case-progress_1.4s_ease-in-out_infinite] rounded-full bg-zinc-950" />
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={`surface-shell ${
        isActiveStep ? "border-zinc-950/40 shadow-[0_18px_42px_rgba(15,23,42,0.11)]" : ""
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="eyebrow">Investigation composer</p>
            <CardTitle className="mt-2 text-2xl tracking-[-0.04em]">New support ticket</CardTitle>
            <CardDescription className="mt-2 text-xs leading-5">
              Paste the customer issue. Add context only when the case depends on plan, feature, or error state.
            </CardDescription>
          </div>
          {ticket.trim() || investigationContext.trim() ? (
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onNewTicket}>
              <Plus className="h-4 w-4" />
              New ticket
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {isReviewRetryActive ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="eyebrow">Review retry staged</p>
                  <p className="mt-1.5 text-sm leading-6 text-amber-800">
                    Add the missing context, then rerun this ticket.
                  </p>
                </div>
                <Badge variant="warn">Needs rerun</Badge>
              </div>
            </div>
          ) : null}

          <div className="surface-muted p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Required</p>
                <p className="mt-1.5 text-xs text-zinc-600">Use the customer’s wording.</p>
              </div>
              <div className="flex items-center gap-2">
                {!contextExpanded ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowContext(true)}>
                    Add context
                  </Button>
                ) : null}
                <span className={ticket.trim() ? "text-xs font-medium text-emerald-700" : "text-xs text-zinc-500"}>
                  {ticket.trim() ? "Ready" : "Empty"}
                </span>
              </div>
            </div>
            <Textarea
              className="mt-3 min-h-[150px] rounded-lg text-base leading-7"
              placeholder="Example: Our export keeps failing after setup. What should I check first?"
              value={ticket}
              onChange={(event) => onTicketChange(event.target.value)}
            />
          </div>

          {likelyNeedsContext && !contextExpanded ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-amber-800">
                  This sounds account or product-state specific. Add plan, feature, or recent-error context if you have it.
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowContext(true)}>
                  Add context
                </Button>
              </div>
            </div>
          ) : null}

          {contextExpanded ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">2 · Investigation context</p>
                  <p className="mt-1.5 text-xs text-zinc-600">
                    Add plan, feature, error, or support-note details when they matter.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="warn">{investigationContext.trim() ? "Context added" : "Optional"}</Badge>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowContext(false)}>
                    Hide
                  </Button>
                </div>
              </div>
              <Textarea
                ref={contextRef}
                className="mt-3 min-h-[96px] rounded-lg bg-white"
                placeholder="Example: Plan: Starter. Exports UI hidden. Recent error: ERR-219 yesterday. Support note: billing setup already completed."
                value={investigationContext}
                onChange={(event) => onInvestigationContextChange(event.target.value)}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {["Plan: Starter", "Exports UI hidden", "Recent error: ERR-219", "Billing setup completed"].map((chip) => (
                  <Button
                    key={chip}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => onInvestigationContextChange(investigationContext.trim() ? `${investigationContext}\n${chip}` : chip)}
                  >
                    + {chip}
                  </Button>
                ))}
              </div>
              {accountHint ? <p className="mt-4 text-sm leading-6 text-amber-700">{accountHint}</p> : null}

              {showDebugToggle ? (
                <details className="mt-4 rounded-xl border border-zinc-200 bg-white/85 p-4">
                  <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                    Debug seeded account
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-zinc-600">
                    Use this only for the seeded demo dataset. The main product flow should rely on pasted investigation context.
                  </p>
                  <select
                    className="mt-3 flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
                    value={selectedAccountId ?? ""}
                    onChange={(event) => onSelectAccount(event.target.value || null)}
                  >
                    <option value="">No seeded account selected</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} · {account.planTier} · {account.status}
                      </option>
                    ))}
                  </select>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white/70">
          <button
            type="button"
            onClick={() => setShowDemos((value) => !value)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <div>
              <p className="text-sm font-medium text-zinc-950">Sample test cases</p>
              <p className="mt-1 text-xs leading-5 text-zinc-600">Run a known case against the seeded docs.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-500">{demoScenarios.length} cases</span>
              <ChevronDown className={`h-4 w-4 text-zinc-500 transition ${showDemos ? "rotate-180" : ""}`} />
            </div>
          </button>

          {showDemos ? (
            <div className="grid gap-2 border-t border-zinc-200 px-4 py-3">
              {demoScenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => onLoadScenario(scenario)}
                  className="surface-muted flex items-start justify-between gap-3 p-3 text-left transition hover:border-zinc-300"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold text-zinc-950">{scenario.label ?? scenario.rawText}</p>
                      <Badge variant="outline">{(scenario.bucket ?? "demo").replaceAll("_", " ")}</Badge>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-zinc-600">{scenario.rawText}</p>
                  </div>
                  <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <Separator />
        <div className="rounded-lg border border-zinc-200 bg-white/70 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="eyebrow">Investigation mode</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Start with inspectable evidence, or draft a cited reply from that evidence.
              </p>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
              <Button
                type="button"
                size="sm"
                variant={executionMode === "evidence_only" ? "default" : "ghost"}
                onClick={() => onExecutionModeChange("evidence_only")}
              >
                Evidence only
              </Button>
              <Button
                type="button"
                size="sm"
                variant={executionMode === "draft_answer" ? "default" : "ghost"}
                onClick={() => onExecutionModeChange("draft_answer")}
              >
                Draft answer
              </Button>
            </div>
          </div>
          <div className="mt-3 rounded-md border border-zinc-100 bg-zinc-50/80 px-3 py-2 text-xs leading-5 text-zinc-600">
            {executionMode === "evidence_only"
              ? "Skips the answer model. Shows retrieved docs, tool context, routing, and every pipeline step."
              : "Runs the answer model after retrieval and validation to produce cited customer and internal claims."}
          </div>
        </div>

        {showDebugToggle ? (
          <details className="rounded-lg border border-zinc-200 bg-white/70 p-3">
            <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
              Retrieval ablation
            </summary>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-sm leading-6 text-zinc-600">Turn retrieval off to verify the fallback path.</p>
              <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 p-1">
                <Button type="button" size="sm" variant={ragEnabled ? "default" : "ghost"} onClick={() => onToggleRag(true)}>
                  On
                </Button>
                <Button type="button" size="sm" variant={!ragEnabled ? "default" : "ghost"} onClick={() => onToggleRag(false)}>
                  Off
                </Button>
              </div>
            </div>
          </details>
        ) : null}

        <Button
          className="h-11 w-full rounded-xl"
          type="button"
          disabled={!ticket.trim() || isInvestigating}
          onClick={() => onSubmit()}
        >
          {isInvestigating
            ? executionMode === "evidence_only"
              ? "Finding evidence…"
              : "Drafting cited answer…"
            : isReviewRetryActive
              ? "Rerun investigation"
              : executionMode === "evidence_only"
                ? "Find evidence"
                : "Investigate"}
        </Button>
      </CardContent>
    </Card>
  );
}
