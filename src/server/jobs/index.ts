import "server-only";

import { inngest } from "./client";
import { sendEmail } from "./functions/email-send";
import { processImage } from "./functions/image-process";
import { healthCheckIntegrations } from "./functions/integration-health-check";
import { createJobFromQuote } from "./functions/job-create-from-quote";
import { jobDeliveredAftermath } from "./functions/job-delivered-aftermath";
import { invoiceFromDeliveredJob } from "./functions/invoice-from-delivered-job";
import { invoiceEmailSend } from "./functions/invoice-email-send";
import { qboSyncInvoice } from "./functions/qbo-sync-invoice";
import { qboWebhookReceived } from "./functions/qbo-webhook-received";
import { qboTokenRefresh } from "./functions/qbo-token-refresh";

export const functions = [
  sendEmail,
  processImage,
  healthCheckIntegrations,
  createJobFromQuote,
  jobDeliveredAftermath,
  invoiceFromDeliveredJob,
  invoiceEmailSend,
  qboSyncInvoice,
  qboWebhookReceived,
  qboTokenRefresh,
] as const;
export { inngest };
