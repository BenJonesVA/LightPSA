import { Resend } from "resend";

// Lazily constructed — importing this module must not throw when
// RESEND_API_KEY isn't set (e.g. local dev, CI, or a fresh checkout before
// the user has created a Resend account). Every caller checks isEmailConfigured()
// (or just reads the returned {sent:false} result) before treating a send as
// having actually gone out — this file never fabricates success.
let client: Resend | null = null;

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

function getClient(): Resend {
  if (!client) {
    client = new Resend(process.env.RESEND_API_KEY);
  }
  return client;
}

export type SendEmailResult = { sent: true } | { sent: false; reason: string };

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<SendEmailResult> {
  if (!isEmailConfigured()) {
    return { sent: false, reason: "RESEND_API_KEY / EMAIL_FROM not configured" };
  }

  try {
    const result = await getClient().emails.send({
      from: process.env.EMAIL_FROM!,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    if (result.error) {
      return { sent: false, reason: result.error.message };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : "unknown error" };
  }
}
