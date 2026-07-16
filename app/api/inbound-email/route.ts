import { processInboundEmail, type PostmarkInboundPayload } from "@/lib/inbound-email";

// Exempted from middleware.ts's session gate, same as the /api/cron/* sweeps
// and /csat/{id} — a mail provider has no browser session. The secret query
// param on the configured webhook URL is the authorization boundary here,
// the same role CRON_SECRET's bearer header plays for the cron routes.
export async function POST(request: Request) {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  const token = new URL(request.url).searchParams.get("token");
  if (!secret || token !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: PostmarkInboundPayload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await processInboundEmail(payload);

  if (!result.handled) {
    // Always 200 here: this is an application-level outcome (unrecognized
    // sender, bad ticket reference), not a delivery failure. Returning a
    // non-2xx would make Postmark retry the same email repeatedly, which
    // can't fix an unrecognized-sender problem no matter how many times it
    // retries. Log server-side so it's visible in `docker logs`.
    console.error(`[inbound-email] not handled: ${result.reason}`);
  }

  return Response.json(result);
}
