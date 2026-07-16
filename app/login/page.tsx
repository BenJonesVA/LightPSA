import { LoginForm } from "@/components/login-form";
import { getSettings } from "@/lib/settings";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;
  const settings = await getSettings();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 py-12">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="text-center">
          {settings.logoMimeType && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/branding/logo?v=${settings.updatedAt.getTime()}`}
              alt=""
              className="mx-auto mb-3 h-10 w-10 object-contain"
            />
          )}
          <h1 className="text-2xl font-bold tracking-tight text-fg">Sign in</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {settings.tagline || "PSA — Professional Services Automation"}
          </p>
        </div>
        <LoginForm callbackUrl={callbackUrl} error={error} />
      </div>
    </div>
  );
}
