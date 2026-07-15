import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { submitCsatResponse } from "../actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const RATING_LABELS: Record<number, string> = {
  1: "Very unsatisfied",
  2: "Unsatisfied",
  3: "Neutral",
  4: "Satisfied",
  5: "Very satisfied",
};

export default async function CsatSurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const csat = await prisma.csatResponse.findUnique({
    where: { id },
    include: { ticket: { select: { id: true, title: true, client: { select: { name: true } } } } },
  });

  if (!csat) notFound();

  const submit = submitCsatResponse.bind(null, csat.id);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 py-12">
      <Card className="w-full max-w-md rounded-2xl p-8">
        {csat.respondedAt ? (
          <div className="flex flex-col items-start gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-fg">Thanks for the feedback!</h1>
            <p className="text-sm text-fg-muted">
              Your response on TKT-{csat.ticket.id}: {csat.ticket.title} has been recorded.
            </p>
            {csat.rating && (
              <p className="text-sm text-fg-muted">
                Rating: <span className="font-semibold text-fg">{csat.rating}/5 — {RATING_LABELS[csat.rating]}</span>
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-fg">How did we do?</h1>
              <p className="mt-1 text-sm text-fg-muted">
                {csat.ticket.client.name} — TKT-{csat.ticket.id}: {csat.ticket.title}
              </p>
            </div>

            <form action={submit} className="flex flex-col gap-4">
              <div className="flex justify-between gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label
                    key={n}
                    className="flex flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-border-strong py-3 text-center hover:bg-surface-2 has-[:checked]:border-accent has-[:checked]:bg-accent-weak"
                  >
                    <input type="radio" name="rating" value={n} required className="sr-only" />
                    <span className="text-[18px] font-bold text-fg">{n}</span>
                    <span className="text-[9.5px] leading-tight text-fg-subtle">{RATING_LABELS[n]}</span>
                  </label>
                ))}
              </div>

              <div>
                <label className="block text-[12.5px] font-medium text-fg-muted">
                  Anything you&apos;d like to add? (optional)
                </label>
                <textarea
                  name="comment"
                  rows={3}
                  className="mt-1.5 w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-[13.5px] text-fg focus:outline-none focus:ring-2 focus:ring-focus"
                />
              </div>

              <Button type="submit" variant="primary" className="w-full">
                Submit feedback
              </Button>
            </form>
          </div>
        )}
      </Card>
    </div>
  );
}
