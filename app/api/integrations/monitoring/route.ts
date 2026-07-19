import { TicketPriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyApiKey } from "@/lib/api-keys";

// Webhook a monitoring/RMM tool calls to auto-file a ticket off an alert.
// Exempted from middleware.ts's session gate the same way /api/inbound-email
// and /api/cron/* are — a monitoring tool has no browser session. Here the
// `X-API-Key` header (checked against ApiKey.keyHash, see lib/api-keys.ts) is
// the authorization boundary, playing the same role the query-string secret
// plays for inbound-email and the bearer token plays for the cron routes.
export async function POST(request: Request) {
  const rawKey = request.headers.get("x-api-key");
  if (!rawKey) {
    return Response.json({ error: "Missing X-API-Key header" }, { status: 401 });
  }

  const apiKey = await verifyApiKey(rawKey);
  if (!apiKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    clientId?: unknown;
    title?: unknown;
    description?: unknown;
    priority?: unknown;
    assetId?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const assetId = typeof body.assetId === "string" && body.assetId.trim() ? body.assetId.trim() : null;

  if (!clientId || !title || !description) {
    return Response.json(
      { error: "clientId, title, and description are required" },
      { status: 400 }
    );
  }

  const priority =
    typeof body.priority === "string" &&
    (Object.values(TicketPriority) as string[]).includes(body.priority)
      ? (body.priority as TicketPriority)
      : TicketPriority.MEDIUM;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    return Response.json({ error: `Unknown clientId: ${clientId}` }, { status: 404 });
  }

  if (assetId) {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset || asset.clientId !== clientId) {
      return Response.json(
        { error: `assetId ${assetId} does not belong to client ${clientId}` },
        { status: 404 }
      );
    }
  }

  // Same default-board resolution as lib/inbound-email.ts: prefer the
  // "Support" board, otherwise the first active board alphabetically.
  const board =
    (await prisma.board.findFirst({ where: { name: "Support" } })) ??
    (await prisma.board.findFirst({ where: { isActive: true }, orderBy: { name: "asc" } }));
  if (!board) {
    return Response.json({ error: "No board available to file the ticket against" }, { status: 400 });
  }

  const ticket = await prisma.ticket.create({
    data: {
      title,
      description,
      priority,
      source: "MONITORING",
      boardId: board.id,
      clientId,
    },
  });

  if (assetId) {
    // Mirror the upsert pattern used by linkAsset() in app/tickets/actions.ts
    // — a no-op on retry rather than a unique-constraint error.
    await prisma.ticketAsset.upsert({
      where: { ticketId_assetId: { ticketId: ticket.id, assetId } },
      update: {},
      create: { ticketId: ticket.id, assetId },
    });
  }

  return Response.json({ id: ticket.id }, { status: 201 });
}
