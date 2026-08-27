import { NextResponse } from "next/server";

import { prisma } from "@/server/db";

/**
 * Review-request bounce URL. `/r/<request id>` records the click and
 * 302-redirects to the provider URL (Google / Yelp / Facebook / manual).
 * Public — the request id itself is the only credential.
 */
export async function GET(_req: Request, ctx: RouteContext<"/r/[id]">) {
  const { id } = await ctx.params;
  const req = await prisma.reviewRequest.findUnique({ where: { id } });
  if (!req) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!req.clickedAt) {
    await prisma.reviewRequest.update({
      where: { id: req.id },
      data: { clickedAt: new Date() },
    });
  }
  return NextResponse.redirect(req.url, 302);
}
