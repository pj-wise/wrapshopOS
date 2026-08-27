import "server-only";

import { headers } from "next/headers";

import { appRouter } from "@/server/trpc/root";
import { createTRPCContext } from "@/server/trpc/context";
import { createCallerFactory } from "@/server/trpc/init";

/**
 * Server-side caller for tRPC. Use inside Server Components / Server Actions
 * to invoke routers without an HTTP round-trip:
 *
 *   const api = await getServerApi();
 *   const me = await api.health.whoami();
 */
export async function getServerApi() {
  const h = await headers();
  const req = new Request("http://internal/", { headers: h });
  const ctx = await createTRPCContext({ req: req as unknown as import("next/server").NextRequest });
  return createCallerFactory(appRouter)(ctx);
}
