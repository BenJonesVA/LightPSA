import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { createAutomationRule } from "@/app/automation/actions";
import { IdleMinutesField } from "@/app/automation/new/idle-minutes-field";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const INPUT_CLASS =
  "mt-1.5 block w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-[13.5px] text-fg focus:outline-none focus:ring-2 focus:ring-focus";
const LABEL_CLASS = "block text-[12.5px] font-medium text-fg-muted";
const SUB_LABEL_CLASS = "block text-[11.5px] font-medium text-fg-subtle";

export default async function NewAutomationRulePage() {
  await requireRole(UserRole.ADMIN, UserRole.MANAGER);

  const [boards, clients, users] = await Promise.all([
    prisma.board.findMany({ orderBy: { name: "asc" } }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-[24px] font-bold tracking-tight text-fg">New Automation Rule</h1>

      <Card className="p-5">
        <form action={createAutomationRule} className="flex flex-col gap-6">
          <div>
            <label htmlFor="name" className={LABEL_CLASS}>
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className={INPUT_CLASS}
              placeholder="e.g. Auto-assign Emergency tickets to Alice"
            />
          </div>

          <IdleMinutesField />

          <fieldset className="rounded-lg border border-border p-4">
            <legend className="px-1 text-[12.5px] font-medium text-fg-muted">
              Conditions (leave any as &quot;Any&quot; to match all)
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="conditionBoardId" className={SUB_LABEL_CLASS}>
                  Board
                </label>
                <select id="conditionBoardId" name="conditionBoardId" className={INPUT_CLASS}>
                  <option value="">Any board</option>
                  {boards.map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="conditionPriority" className={SUB_LABEL_CLASS}>
                  Priority
                </label>
                <select id="conditionPriority" name="conditionPriority" className={INPUT_CLASS}>
                  <option value="">Any priority</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="EMERGENCY">Emergency</option>
                </select>
              </div>
              <div>
                <label htmlFor="conditionClientId" className={SUB_LABEL_CLASS}>
                  Client
                </label>
                <select id="conditionClientId" name="conditionClientId" className={INPUT_CLASS}>
                  <option value="">Any client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          <div>
            <label htmlFor="actionType" className={LABEL_CLASS}>
              Action
            </label>
            <select id="actionType" name="actionType" required className={INPUT_CLASS}>
              <option value="ASSIGN_TECHNICIAN">Assign technician</option>
              <option value="SEND_EMAIL_NOTIFICATION">Send email notification</option>
              <option value="CHANGE_STATUS">Change status</option>
              <option value="CHANGE_PRIORITY">Change priority</option>
            </select>
          </div>

          <fieldset className="rounded-lg border border-border p-4">
            <legend className="px-1 text-[12.5px] font-medium text-fg-muted">
              Action target (only the field matching your chosen action above is used)
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="actionAssigneeId" className={SUB_LABEL_CLASS}>
                  Assign to (for &quot;Assign technician&quot;)
                </label>
                <select id="actionAssigneeId" name="actionAssigneeId" className={INPUT_CLASS}>
                  <option value="">—</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="actionStatus" className={SUB_LABEL_CLASS}>
                  New status (for &quot;Change status&quot;)
                </label>
                <select id="actionStatus" name="actionStatus" className={INPUT_CLASS}>
                  <option value="">—</option>
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="WAITING_ON_CLIENT">Waiting on client</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
              <div>
                <label htmlFor="actionPriority" className={SUB_LABEL_CLASS}>
                  New priority (for &quot;Change priority&quot;)
                </label>
                <select id="actionPriority" name="actionPriority" className={INPUT_CLASS}>
                  <option value="">—</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="EMERGENCY">Emergency</option>
                </select>
              </div>
            </div>
          </fieldset>

          <div className="flex justify-end gap-3">
            <a href="/automation">
              <Button variant="secondary" type="button">
                Cancel
              </Button>
            </a>
            <Button type="submit" variant="primary">
              Create Rule
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
