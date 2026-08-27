/**
 * RBAC catalog — source of truth for permissions + built-in role assignments.
 *
 * All server-side authorization goes through `requirePermission(ctx, "quotes:approve")`.
 * The seed script upserts these Permission rows and RolePermission mappings.
 * Custom org-defined roles clone from a system role and can toggle individual permissions.
 */

export const PERMISSION_CATEGORIES = [
  "admin",
  "crm",
  "quotes",
  "jobs",
  "scheduling",
  "inventory",
  "invoices",
  "payments",
  "reports",
  "messaging",
  "settings",
] as const;

export type PermissionCategory = (typeof PERMISSION_CATEGORIES)[number];

export type PermissionDef = {
  key: string;
  category: PermissionCategory;
  description: string;
};

export const PERMISSIONS = [
  // admin
  { key: "admin:team", category: "admin", description: "Manage team members + invites" },
  { key: "admin:roles", category: "admin", description: "Create/edit custom roles + permissions" },
  { key: "admin:integrations", category: "admin", description: "Connect/disconnect external integrations" },
  { key: "admin:flags", category: "admin", description: "Toggle feature flags for the organization" },
  { key: "admin:billing", category: "admin", description: "Manage the shop's own subscription + billing" },
  { key: "admin:audit", category: "admin", description: "View the audit log" },

  // CRM
  { key: "crm:read", category: "crm", description: "View customers, leads, vehicles" },
  { key: "crm:write", category: "crm", description: "Create/edit customers, leads, vehicles" },
  { key: "crm:delete", category: "crm", description: "Delete customers, leads, vehicles (soft)" },

  // Quotes
  { key: "quotes:read", category: "quotes", description: "View quotes" },
  { key: "quotes:write", category: "quotes", description: "Create/edit quotes" },
  { key: "quotes:send", category: "quotes", description: "Send quotes to customers" },
  { key: "quotes:approve", category: "quotes", description: "Approve/decline on customer's behalf" },
  { key: "quotes:discount", category: "quotes", description: "Apply discounts beyond default limits" },

  // Jobs / Production
  { key: "jobs:read", category: "jobs", description: "View jobs + work orders" },
  { key: "jobs:write", category: "jobs", description: "Create/edit jobs" },
  { key: "jobs:assign", category: "jobs", description: "Assign jobs to technicians / bays" },
  { key: "jobs:checkin", category: "jobs", description: "Perform vehicle check-in + condition report" },
  { key: "jobs:complete", category: "jobs", description: "Mark jobs complete, run QC, deliver" },

  // Scheduling
  { key: "scheduling:read", category: "scheduling", description: "View schedule + capacity" },
  { key: "scheduling:write", category: "scheduling", description: "Create/edit schedule blocks" },

  // Inventory
  { key: "inventory:read", category: "inventory", description: "View materials + rolls" },
  { key: "inventory:write", category: "inventory", description: "Add/adjust materials + rolls" },
  { key: "inventory:consume", category: "inventory", description: "Deduct material against a job" },

  // Invoices
  { key: "invoices:read", category: "invoices", description: "View invoices" },
  { key: "invoices:write", category: "invoices", description: "Create/edit invoices" },
  { key: "invoices:void", category: "invoices", description: "Void invoices" },
  { key: "invoices:refund", category: "invoices", description: "Issue refunds" },

  // Payments
  { key: "payments:read", category: "payments", description: "View payments" },
  { key: "payments:record", category: "payments", description: "Record manual payments" },

  // Reports
  { key: "reports:read", category: "reports", description: "View reports + dashboards" },
  { key: "reports:financial", category: "reports", description: "View financial + margin reports" },

  // Messaging
  { key: "messaging:read", category: "messaging", description: "View inbox + threads" },
  { key: "messaging:write", category: "messaging", description: "Send messages + reply" },
  { key: "messaging:templates", category: "messaging", description: "Manage message templates" },

  // Settings
  { key: "settings:read", category: "settings", description: "View shop settings" },
  { key: "settings:write", category: "settings", description: "Edit shop settings, catalog, checklists" },
] as const satisfies readonly PermissionDef[];

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const PERMISSION_KEYS: PermissionKey[] = PERMISSIONS.map((p) => p.key);

// ------------------------------------------------------------------
// Built-in roles
// ------------------------------------------------------------------

export type SystemRoleKey =
  | "owner"
  | "admin"
  | "manager"
  | "estimator"
  | "front_desk"
  | "technician"
  | "accountant"
  | "read_only";

export type SystemRoleDef = {
  key: SystemRoleKey;
  name: string;
  description: string;
  permissions: PermissionKey[] | "*"; // "*" = all
};

export const SYSTEM_ROLES: readonly SystemRoleDef[] = [
  {
    key: "owner",
    name: "Owner",
    description: "Full access. There must always be at least one Owner.",
    permissions: "*",
  },
  {
    key: "admin",
    name: "Administrator",
    description: "Full access except billing.",
    permissions: PERMISSION_KEYS.filter((p) => p !== "admin:billing"),
  },
  {
    key: "manager",
    name: "Manager",
    description: "Runs day-to-day shop operations.",
    permissions: [
      "crm:read", "crm:write",
      "quotes:read", "quotes:write", "quotes:send", "quotes:approve", "quotes:discount",
      "jobs:read", "jobs:write", "jobs:assign", "jobs:checkin", "jobs:complete",
      "scheduling:read", "scheduling:write",
      "inventory:read", "inventory:write", "inventory:consume",
      "invoices:read", "invoices:write",
      "payments:read", "payments:record",
      "reports:read", "reports:financial",
      "messaging:read", "messaging:write", "messaging:templates",
      "settings:read",
    ],
  },
  {
    key: "estimator",
    name: "Estimator / Sales",
    description: "Builds quotes, manages leads, follows up.",
    permissions: [
      "crm:read", "crm:write",
      "quotes:read", "quotes:write", "quotes:send",
      "jobs:read",
      "scheduling:read",
      "inventory:read",
      "messaging:read", "messaging:write",
      "reports:read",
    ],
  },
  {
    key: "front_desk",
    name: "Front Desk",
    description: "Greets customers, checks vehicles in, handles messages.",
    permissions: [
      "crm:read", "crm:write",
      "quotes:read", "quotes:send",
      "jobs:read", "jobs:checkin",
      "scheduling:read",
      "messaging:read", "messaging:write",
      "invoices:read",
      "payments:read", "payments:record",
    ],
  },
  {
    key: "technician",
    name: "Technician",
    description: "Installer working from the shop floor. Phone-first.",
    permissions: [
      "crm:read",
      "jobs:read", "jobs:checkin", "jobs:complete",
      "scheduling:read",
      "inventory:read", "inventory:consume",
      "messaging:read",
    ],
  },
  {
    key: "accountant",
    name: "Accountant",
    description: "Financial visibility, invoice/payment access, no operational writes.",
    permissions: [
      "crm:read",
      "jobs:read",
      "invoices:read", "invoices:write", "invoices:void", "invoices:refund",
      "payments:read", "payments:record",
      "reports:read", "reports:financial",
    ],
  },
  {
    key: "read_only",
    name: "Read Only",
    description: "View-only access for observers.",
    permissions: [
      "crm:read", "quotes:read", "jobs:read", "scheduling:read",
      "inventory:read", "invoices:read", "payments:read",
      "reports:read", "messaging:read",
    ],
  },
];

export function permissionsForSystemRole(key: SystemRoleKey): PermissionKey[] {
  const role = SYSTEM_ROLES.find((r) => r.key === key);
  if (!role) throw new Error(`Unknown system role: ${key}`);
  return role.permissions === "*" ? [...PERMISSION_KEYS] : [...role.permissions];
}
