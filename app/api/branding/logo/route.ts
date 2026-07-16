import { getSettings } from "@/lib/settings";
import { readLogoFile } from "@/lib/storage";

// Deliberately unauthenticated — the logo needs to render on the login page
// and client-portal header before any session exists. Not sensitive data.
export async function GET() {
  const settings = await getSettings();
  if (!settings.logoMimeType) return new Response("Not found", { status: 404 });

  const data = await readLogoFile();
  if (!data) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": settings.logoMimeType,
      "Cache-Control": "private, max-age=60",
    },
  });
}
