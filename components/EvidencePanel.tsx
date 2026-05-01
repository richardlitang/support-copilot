"use client";

import { Database, FileSearch, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { InvestigationResult } from "@/lib/types/investigation";

export function EvidencePanel({
  result,
  isInvestigating
}: {
  result: InvestigationResult | null;
  isInvestigating: boolean;
}) {
  const citations = new Set(
    result ? [...result.customerReply.claims, ...result.internalDiagnosis.claims].flatMap((claim) => claim.citations) : []
  );

  return (
    <Card className="surface-shell sidebar-scroll xl:sticky xl:top-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Evidence rail</p>
            <CardTitle className="mt-2 text-lg">Documentation and context</CardTitle>
            <CardDescription className="mt-2 text-xs leading-5">
              {result || isInvestigating
                ? "Retrieved docs, context, and tool-call records stay visible while you review."
                : "This stays quiet until an investigation runs."}
            </CardDescription>
          </div>
          <span className="text-xs font-medium text-zinc-500">
            {(result?.docEvidence.length ?? 0) + (result?.toolEvidence.length ?? 0)} sources
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[calc(100vh-210px)]">
          <div className="space-y-4 pr-3">
            {isInvestigating ? (
              <div className="surface-muted p-4 text-sm leading-6 text-zinc-600">
                Ranking chunks, choosing tools, and assembling evidence…
              </div>
            ) : result ? (
              <>
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <FileSearch className="h-4 w-4 text-zinc-500" />
                      <p className="eyebrow">Documentation</p>
                    </div>
                    <Badge variant="secondary">{result.docEvidence.length} chunk{result.docEvidence.length === 1 ? "" : "s"}</Badge>
                  </div>

                  {result.docEvidence.length ? (
                    result.docEvidence.map((item) => {
                      const cited = citations.has(item.id);

                      return (
                        <div key={item.id} className="surface-muted p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">{item.id}</Badge>
                                {cited ? <Badge variant="success">cited</Badge> : null}
                              </div>
                              <p className="mt-3 text-sm font-medium text-zinc-950">{item.filename}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">
                                {item.sectionTitle ?? "General section"}
                              </p>
                            </div>
                            <Badge variant="secondary">{Math.round(item.score * 100)}% match</Badge>
                          </div>
                          <p className="mt-4 text-sm leading-6 text-zinc-700">{item.excerpt}</p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="surface-muted border-dashed p-4 text-sm text-zinc-500">
                      No documentation evidence was available for this run.
                    </div>
                  )}
                </section>

                <Separator />

                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-zinc-500" />
                      <p className="eyebrow">Context evidence</p>
                    </div>
                    <Badge variant="secondary">
                      {result.toolEvidence.length} tool source{result.toolEvidence.length === 1 ? "" : "s"}
                    </Badge>
                  </div>

                  {result.toolEvidence.length ? (
                    result.toolEvidence.map((item) => {
                      const cited = citations.has(item.id);

                      return (
                        <div key={item.id} className="surface-muted p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">{item.id}</Badge>
                                {cited ? <Badge variant="warn">cited</Badge> : null}
                              </div>
                              <p className="mt-3 text-sm font-medium text-zinc-950">{item.toolName}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">{item.title}</p>
                            </div>
                          </div>
                          <p className="mt-4 text-sm leading-6 text-zinc-700">{item.excerpt}</p>
                          <details className="mt-4">
                            <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                              View raw tool output
                            </summary>
                            <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-6 text-zinc-700">
                              {JSON.stringify(item.raw, null, 2)}
                            </pre>
                          </details>
                        </div>
                      );
                    })
                  ) : (
                    <div className="surface-muted border-dashed p-4 text-sm text-zinc-500">
                      No investigation-context evidence was added for this run.
                    </div>
                  )}
                </section>

                <Separator />

                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-zinc-500" />
                      <p className="eyebrow">Tool call records</p>
                    </div>
                    <Badge variant="secondary">{result.toolCalls.length} call{result.toolCalls.length === 1 ? "" : "s"}</Badge>
                  </div>

                  {result.toolCalls.length ? (
                    result.toolCalls.map((toolCall, index) => (
                      <div key={`${toolCall.toolName}-${index}`} className="surface-muted p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium uppercase tracking-[0.14em] text-zinc-900">{toolCall.toolName}</p>
                          <Badge variant="outline">Call {index + 1}</Badge>
                        </div>
                        <details className="mt-4">
                          <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                            Inspect input and output
                          </summary>
                          <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-6 text-zinc-700">
                            {JSON.stringify(toolCall, null, 2)}
                          </pre>
                        </details>
                      </div>
                    ))
                  ) : (
                    <div className="surface-muted border-dashed p-4 text-sm text-zinc-500">
                      Tool execution records appear here when the router invokes account or product tools.
                    </div>
                  )}
                </section>
              </>
            ) : (
              <div className="surface-muted p-4 text-sm leading-6 text-zinc-600">
                Run an investigation to see retrieved chunks, structured context evidence, and raw tool-call records here.
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
