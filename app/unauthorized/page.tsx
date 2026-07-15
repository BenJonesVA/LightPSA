import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 py-12">
      <Card className="w-full max-w-md rounded-2xl p-8">
        <div className="flex flex-col items-start gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-fg">Access denied</h1>
          <p className="text-sm text-fg-muted">
            Your account doesn&apos;t have permission to view that page.
          </p>
          <Link href="/" className="mt-2">
            <Button variant="secondary">Back to dashboard</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
