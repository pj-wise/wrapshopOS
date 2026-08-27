import { getAppSession } from "@/server/auth/session";
import { dbFor } from "@/server/db-scoped";

export default async function AuditPage() {
  const session = await getAppSession();
  const db = dbFor(session.organizationId);

  const logs = await db.auditLog.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: {
      actor: { select: { name: true, email: true } },
    },
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Every mutation across your shop, most recent first. Sensitive fields
          (tokens, secrets) are redacted before storage.
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-12 text-center dark:border-neutral-700 dark:bg-neutral-950">
          <p className="text-sm text-neutral-500">
            No audit entries yet. Every write through tRPC that opts in via
            <code className="mx-1 rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-900">
              .meta({"{ audit: { entity, action } }"})
            </code>
            will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-widest text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-2 text-left font-medium">When</th>
                <th className="px-4 py-2 text-left font-medium">Actor</th>
                <th className="px-4 py-2 text-left font-medium">Action</th>
                <th className="px-4 py-2 text-left font-medium">Entity</th>
                <th className="px-4 py-2 text-left font-medium">ID</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-neutral-100 last:border-0 dark:border-neutral-900"
                >
                  <td className="px-4 py-2 text-neutral-500">
                    {formatDate(log.createdAt)}
                  </td>
                  <td className="px-4 py-2">
                    {log.actor?.name ?? log.actor?.email ?? (
                      <span className="text-neutral-500">system</span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{log.action}</td>
                  <td className="px-4 py-2">{log.entityType}</td>
                  <td className="max-w-[240px] truncate px-4 py-2 font-mono text-xs text-neutral-500">
                    {log.entityId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
