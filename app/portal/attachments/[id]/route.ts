import { prisma } from "@/lib/prisma";
import { requireClientSession } from "@/lib/rbac";
import { readAttachmentFile, contentDispositionHeader } from "@/lib/storage";

// Nested under /portal (not /api/attachments) so middleware.ts's coarse
// portal-vs-staff gate lets a CLIENT actorType reach this at all. Ownership
// and internal-visibility are enforced in the query itself, not filtered
// after fetching — same discipline as every other portal read in this app
// (e.g. app/portal/tickets/[id]/page.tsx's comment scoping): a wrong
// clientId or an internal-only attachment id is a genuine 404, not a
// fetched-then-hidden row.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireClientSession();

  const { id } = await params;
  const attachment = await prisma.attachment.findFirst({
    where: { id, isInternal: false, ticket: { clientId: user.clientId! } },
  });
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
