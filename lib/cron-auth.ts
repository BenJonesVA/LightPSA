// Shared bearer-token check for scheduled route handlers under app/api/cron/*.
// Convention matches Vercel Cron's built-in behavior (it sends
// `Authorization: Bearer $CRON_SECRET` automatically when that env var is
// set), but nothing here is Vercel-specific — any scheduler that can send a
// bearer header (GitHub Actions cron, cron-job.org, a plain crontab + curl)
// works identically. If CRON_SECRET isn't configured, every request is
// rejected rather than leaving the endpoint open by default.
export function assertCronAuthorized(request: Request): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    throw new CronAuthError(503, "CRON_SECRET is not configured");
  }
  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    throw new CronAuthError(401, "Unauthorized");
  }
}

export class CronAuthError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
