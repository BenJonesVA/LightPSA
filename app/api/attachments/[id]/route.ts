import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/rbac";
import { readAttachmentFile, contentDispositionHeader } from "@/lib/storage";

// Staff can see every attachment on a ticket, including internal-only ones —
// same visibility rule as TicketComment.isInternal for staff. Portal
// contacts use the separate app/portal/attachments/[id]/route.ts instead,
// which additionally scopes by clientId and excludes internal attachments —
// this route intentionally does neither, since staff-side ticket access
// isn't otherwise client-scoped (see app/tickets/[id]/page.tsx).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff();

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) return new Response("Not found", { status: 404 });

  const data = await readAttachmentFile(attachment.id);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": contentDispositionHeader(attachment.fileName),
      "Content-Length": String(attachment.sizeBytes),
    },
  });
}
