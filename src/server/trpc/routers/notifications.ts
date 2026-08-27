import "server-only";

import { z } from "zod";

import { createTRPCRouter, orgProcedure } from "../init";

export const notificationsRouter = createTRPCRouter({
  list: orgProcedure
    .input(
      z
        .object({
          unreadOnly: z.boolean().default(false),
          limit: z.number().int().min(1).max(100).default(20),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.notification.findMany({
        where: {
          userId: ctx.session.userId,
          ...(input?.unreadOnly ? { readAt: null } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 20,
      });
      const unread = await ctx.db.notification.count({
        where: { userId: ctx.session.userId, readAt: null },
      });
      return { items, unread };
    }),

  markRead: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      ctx.db.notification.update({
        where: { id: input.id },
        data: { readAt: new Date() },
      }),
    ),

  markAllRead: orgProcedure.mutation(async ({ ctx }) => {
    const res = await ctx.db.notification.updateMany({
      where: { userId: ctx.session.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { count: res.count };
  }),
});
