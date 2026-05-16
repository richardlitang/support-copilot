export type DocumentIngestionJob = {
  documentId: string;
  ingestionJobId: string;
  sessionId?: string;
  tenantId?: string;
  requestedByUserId?: string;
};
