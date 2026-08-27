import "server-only";

import { z } from "zod";

import { JOB_STAGE_KEYS } from "@/lib/production-catalog";
import {
  readWorkflowOverrides,
  resolveWorkflow,
  type WorkflowOverride,
} from "@/lib/workflow";
import { prisma } from "@/server/db";
import {
  createTRPCRouter,
  orgProcedure,
  requirePermission,
} from "../init";

const stageOverrideInput = z.object({
  key: z.enum(JOB_STAGE_KEYS as [string, ...string[]]),
  label: z.string().trim().max(60).optional(),
  hidden: z.boolean().optional(),
});

const saveStagesInput = z.object({
  stages: z.array(stageOverrideInput).min(1),
});

export const workflowRouter = createTRPCRouter({
  /**
   * Returns the resolved ordered stage list — an array of every stage the
   * platform knows about, in the org's chosen order, with the org's labels
   * applied. Any stage the org hasn't explicitly ordered gets appended at
   * the end in default catalog order.
   */
  getStages: orgProcedure.query(async ({ ctx }) => {
    const org = await prisma.organization.findUnique({
      where: { id: ctx.session.organizationId },
      select: { settings: true },
    });
    const overrides = readWorkflowOverrides(org?.settings);
    const resolved = resolveWorkflow(overrides);
    return { stages: resolved, hasOverride: overrides !== null };
  }),

  /** Save the org's stage order + labels. Clears prior overrides atomically. */
  saveStages: orgProcedure
    .use(requirePermission("settings:write"))
    .meta({ audit: { entity: "workflow", action: "save" } })
    .input(saveStagesInput)
    .mutation(async ({ ctx, input }) => {
      const org = await prisma.organization.findUnique({
        where: { id: ctx.session.organizationId },
        select: { settings: true },
      });
      const currentSettings = (org?.settings ?? {}) as Record<string, unknown>;
      // Dedupe by key while preserving order — first occurrence wins.
      const seen = new Set<string>();
      const clean: WorkflowOverride[] = [];
      for (const s of input.stages) {
        if (seen.has(s.key)) continue;
        seen.add(s.key);
        clean.push({
          key: s.key as WorkflowOverride["key"],
          label: s.label,
          hidden: s.hidden,
        });
      }
      const next = {
        ...currentSettings,
        workflow: {
          ...((currentSettings.workflow as Record<string, unknown>) ?? {}),
          jobStages: clean,
        },
      };
      await prisma.organization.update({
        where: { id: ctx.session.organizationId },
        data: { settings: next as never },
      });
      return { ok: true };
    }),

  /** Clear org overrides so the platform default order applies again. */
  resetStages: orgProcedure
    .use(requirePermission("settings:write"))
    .meta({ audit: { entity: "workflow", action: "reset" } })
    .mutation(async ({ ctx }) => {
      const org = await prisma.organization.findUnique({
        where: { id: ctx.session.organizationId },
        select: { settings: true },
      });
      const currentSettings = (org?.settings ?? {}) as Record<string, unknown>;
      const wf = (currentSettings.workflow as Record<string, unknown>) ?? {};
      const { jobStages: _, ...restWf } = wf;
      void _;
      await prisma.organization.update({
        where: { id: ctx.session.organizationId },
        data: {
          settings: {
            ...currentSettings,
            workflow: restWf,
          } as never,
        },
      });
      return { ok: true };
    }),
});
