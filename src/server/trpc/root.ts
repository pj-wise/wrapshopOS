import "server-only";

import { createTRPCRouter } from "./init";
import { healthRouter } from "./routers/health";
import { featuresRouter } from "./routers/features";
import { customersRouter } from "./routers/customers";
import { vehiclesRouter } from "./routers/vehicles";
import { leadsRouter } from "./routers/leads";
import { searchRouter } from "./routers/search";
import { servicesRouter } from "./routers/services";
import { materialsRouter } from "./routers/materials";
import { quotesRouter } from "./routers/quotes";
import { portalRouter } from "./routers/portal";
import { jobsRouter } from "./routers/jobs";
import { scheduleRouter } from "./routers/schedule";
import { timeRouter } from "./routers/time";
import { inboxRouter } from "./routers/inbox";
import { templatesRouter } from "./routers/templates";
import { notificationsRouter } from "./routers/notifications";
import { filesRouter } from "./routers/files";
import { inventoryRouter } from "./routers/inventory";
import { warrantiesRouter } from "./routers/warranties";
import { aftercareRouter } from "./routers/aftercare";
import { reviewsRouter } from "./routers/reviews";
import { reportsRouter } from "./routers/reports";
import { invoicesRouter } from "./routers/invoices";
import { paymentsRouter } from "./routers/payments";
import { accountingRouter } from "./routers/accounting";
import { workflowRouter } from "./routers/workflow";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  features: featuresRouter,
  customers: customersRouter,
  vehicles: vehiclesRouter,
  leads: leadsRouter,
  search: searchRouter,
  services: servicesRouter,
  materials: materialsRouter,
  quotes: quotesRouter,
  portal: portalRouter,
  jobs: jobsRouter,
  schedule: scheduleRouter,
  time: timeRouter,
  inbox: inboxRouter,
  templates: templatesRouter,
  notifications: notificationsRouter,
  files: filesRouter,
  inventory: inventoryRouter,
  warranties: warrantiesRouter,
  aftercare: aftercareRouter,
  reviews: reviewsRouter,
  reports: reportsRouter,
  invoices: invoicesRouter,
  payments: paymentsRouter,
  accounting: accountingRouter,
  workflow: workflowRouter,
});

export type AppRouter = typeof appRouter;
