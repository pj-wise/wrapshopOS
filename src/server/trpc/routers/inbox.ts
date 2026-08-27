import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  assignThreadInput,
  composeMessageInput,
  sendReplyInput,
} from "@/lib/schemas/comms";
import {
  createTRPCRouter,
  orgProcedure,
  requirePermission,
} from "../init";
import { inngest } from "@/server/jobs/client";
import { recordTimelineEvent } from "@/server/audit/timeline";
import { renderTemplate } from "@/lib/template-render";
import { buildMessageContext } from "@/server/services/context-builder";

export const inboxRouter = createTRPCRouter({
  listThreads: orgProcedure
    .use(requirePermission("messaging:read"))
    .input(
      z
        .object({
          status: z.enum(["open", "closed"]).optional(),
          customerId: z.string().uuid().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.messageThread.findMany({
        take: 100,
        orderBy: { lastMessageAt: "desc" },
        where: {
          status: input?.status ?? undefined,
          customerId: input?.customerId ?? undefined,
        },
        include: {
          customer: { select: { id: true, name: true, email: true } },
        },
      });
      return { items };
    }),

  getThread: orgProcedure
    .use(requirePermission("messaging:read"))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const thread = await ctx.db.messageThread.findFirst({
        where: { id: input.id },
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true } },
          messages: { orderBy: { createdAt: "asc" } },
        },
      });
      if (!thread) throw new TRPCError({ code: "NOT_FOUND" });
      return thread;
    }),

  markRead: orgProcedure
    .use(requirePermission("messaging:write"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.messageThread.update({
        where: { id: input.id },
        data: { unreadCount: 0 },
      });
    }),

  assign: orgProcedure
    .use(requirePermission("messaging:write"))
    .meta({ audit: { entity: "message_thread", action: "assign" } })
    .input(assignThreadInput)
    .mutation(({ ctx, input }) =>
      ctx.db.messageThread.update({
        where: { id: input.id },
        data: { assignedToUserId: input.assignedToUserId },
      }),
    ),

  closeThread: orgProcedure
    .use(requirePermission("messaging:write"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      ctx.db.messageThread.update({
        where: { id: input.id },
        data: { status: "closed" },
      }),
    ),

  reopenThread: orgProcedure
    .use(requirePermission("messaging:write"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      ctx.db.messageThread.update({
        where: { id: input.id },
        data: { status: "open" },
      }),
    ),

  reply: orgProcedure
    .use(requirePermission("messaging:write"))
    .meta({ audit: { entity: "message", action: "send" } })
    .input(sendReplyInput)
    .mutation(async ({ ctx, input }) => {
      const thread = await ctx.db.messageThread.findFirst({
        where: { id: input.threadId },
        include: { customer: { select: { email: true, phone: true } } },
      });
      if (!thread) throw new TRPCError({ code: "NOT_FOUND" });

      const message = await ctx.db.$transaction(async (tx) => {
        const msg = await tx.message.create({
          data: {
            organizationId: ctx.session.organizationId,
            threadId: thread.id,
            direction: "out",
            channel: thread.channel,
            fromAddress: null,
            toAddress:
              thread.channel === "email"
                ? thread.customer?.email ?? null
                : thread.customer?.phone ?? null,
            subject: input.subject ?? thread.subject ?? null,
            bodyText: input.bodyText,
            bodyHtml: input.bodyHtml ?? null,
            attachmentFileIds: input.attachmentFileIds,
            sentByUserId: ctx.session.userId,
          },
        });
        await tx.messageThread.update({
          where: { id: thread.id },
          data: {
            lastMessageAt: new Date(),
            lastMessagePreview: input.bodyText.slice(0, 200),
            status: "open",
          },
        });
        return msg;
      });

      if (thread.channel === "email" && thread.customer?.email) {
        await inngest.send({
          name: "email.send",
          data: {
            orgId: ctx.session.organizationId,
            to: thread.customer.email,
            subject: input.subject ?? thread.subject ?? "Update from your shop",
            html: input.bodyHtml,
            text: input.bodyText,
            idempotencyKey: `msg:${message.id}`,
          },
        });
      }

      if (thread.customerId) {
        await recordTimelineEvent(ctx.session.organizationId, {
          entityType: "customer",
          entityId: thread.customerId,
          kind: "message.sent",
          actorUserId: ctx.session.userId,
          data: { threadId: thread.id, channel: thread.channel, subject: input.subject },
        });
      }

      return message;
    }),

  compose: orgProcedure
    .use(requirePermission("messaging:write"))
    .meta({ audit: { entity: "message", action: "compose" } })
    .input(composeMessageInput)
    .mutation(async ({ ctx, input }) => {
      // Find or create an open thread for (customer, channel).
      let thread = await ctx.db.messageThread.findFirst({
        where: {
          customerId: input.customerId,
          channel: input.channel,
          status: "open",
        },
        orderBy: { lastMessageAt: "desc" },
      });
      if (!thread) {
        thread = await ctx.db.messageThread.create({
          data: {
            organizationId: ctx.session.organizationId,
            customerId: input.customerId,
            channel: input.channel,
            subject: input.subject ?? null,
            lastMessageAt: new Date(),
          },
        });
      }

      // Reuse the reply path so the same delivery logic runs.
      const customer = await ctx.db.customer.findFirst({
        where: { id: input.customerId },
        select: { email: true, phone: true },
      });

      const message = await ctx.db.$transaction(async (tx) => {
        const msg = await tx.message.create({
          data: {
            organizationId: ctx.session.organizationId,
            threadId: thread!.id,
            direction: "out",
            channel: input.channel,
            toAddress:
              input.channel === "email" ? customer?.email ?? null : customer?.phone ?? null,
            subject: input.subject ?? null,
            bodyText: input.bodyText,
            bodyHtml: input.bodyHtml ?? null,
            attachmentFileIds: input.attachmentFileIds,
            sentByUserId: ctx.session.userId,
          },
        });
        await tx.messageThread.update({
          where: { id: thread!.id },
          data: {
            lastMessageAt: new Date(),
            lastMessagePreview: input.bodyText.slice(0, 200),
            status: "open",
          },
        });
        return msg;
      });

      if (input.channel === "email" && customer?.email) {
        await inngest.send({
          name: "email.send",
          data: {
            orgId: ctx.session.organizationId,
            to: customer.email,
            subject: input.subject ?? "Message from your shop",
            html: input.bodyHtml,
            text: input.bodyText,
            idempotencyKey: `msg:${message.id}`,
          },
        });
      }

      return { thread, message };
    }),

  /**
   * Render a template against a customer/quote/job context for the compose UI's
   * live preview. Kept as a query so the client can debounce it.
   */
  renderTemplateFor: orgProcedure
    .use(requirePermission("messaging:read"))
    .input(
      z.object({
        templateId: z.string().uuid(),
        customerId: z.string().uuid().optional(),
        quoteId: z.string().uuid().optional(),
        jobId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const template = await ctx.db.messageTemplate.findFirst({
        where: { id: input.templateId, deletedAt: null },
      });
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });
      const context = await buildMessageContext({
        organizationId: ctx.session.organizationId,
        customerId: input.customerId,
        quoteId: input.quoteId,
        jobId: input.jobId,
      });
      return {
        subject: template.subject ? renderTemplate(template.subject, context) : null,
        body: renderTemplate(template.body, context),
      };
    }),
});
