import { requireClientSession } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createPortalTicket } from "../../actions";
import { ActionForm } from "@/components/ui/action-form";

export default async function NewPortalTicketPage() {
  await requireClientSession();

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="text-[26px] font-bold tracking-tight text-fg">New Ticket</h1>

      <Card className="rounded-2xl p-6">
        <ActionForm action={createPortalTicket} className="flex flex-col gap-5">
          <div>
            <label className="block text-[14px] font-medium text-fg-muted">Title</label>
            <input
              type="text"
              name="title"
              required
              className="mt-2 w-full rounded-xl border border-border-strong bg-surface px-4 py-3 text-[15px] text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>

          <div>
            <label className="block text-[14px] font-medium text-fg-muted">Description</label>
            <textarea
              name="description"
              rows={4}
              className="mt-2 w-full rounded-xl border border-border-strong bg-surface px-4 py-3 text-[15px] text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>

          <div>
            <label className="block text-[14px] font-medium text-fg-muted">Priority</label>
            <select
              name="priority"
              defaultValue="MEDIUM"
              className="mt-2 w-full rounded-xl border border-border-strong bg-surface px-4 py-3 text-[15px] text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="EMERGENCY">Emergency</option>
            </select>
          </div>

          <Button type="submit" variant="primary" className="w-full justify-center px-6 py-3 text-[15px]">
            Submit Ticket
          </Button>
        </ActionForm>
      </Card>
    </div>
  );
}
