// Computes the current billing period for a RETAINER contract purely from its
// `startDate` anchor day — no separate period-tracking table. All math is in
// UTC to avoid ambiguity with timestamptz columns.

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

// Clamp the anchor day to the last real day of a short month (e.g. a
// contract that started on the 31st runs Feb 28/29 -> Mar 31, not Mar 3).
function anchoredDate(year: number, monthIndex: number, anchorDay: number): Date {
  const day = Math.min(anchorDay, daysInMonth(year, monthIndex));
  return new Date(Date.UTC(year, monthIndex, day));
}

export function getCurrentBillingPeriod(
  contractStartDate: Date,
  now: Date = new Date()
): { periodStart: Date; periodEnd: Date } {
  const anchorDay = contractStartDate.getUTCDate();
  const nowYear = now.getUTCFullYear();
  const nowMonth = now.getUTCMonth();

  let periodStart = anchoredDate(nowYear, nowMonth, anchorDay);
  let periodEnd: Date;

  if (periodStart > now) {
    // This month's anchor date hasn't happened yet — the current period
    // started last month and ends on this month's anchor date.
    const prevMonthIndex = nowMonth - 1;
    const prevYear = prevMonthIndex < 0 ? nowYear - 1 : nowYear;
    const normalizedPrevMonth = ((prevMonthIndex % 12) + 12) % 12;
    periodEnd = periodStart;
    periodStart = anchoredDate(prevYear, normalizedPrevMonth, anchorDay);
  } else {
    const nextMonthIndex = nowMonth + 1;
    const nextYear = nowYear + Math.floor(nextMonthIndex / 12);
    const normalizedNextMonth = ((nextMonthIndex % 12) + 12) % 12;
    periodEnd = anchoredDate(nextYear, normalizedNextMonth, anchorDay);
  }

  // Never start before the contract itself began (first partial period).
  if (periodStart < contractStartDate) {
    periodStart = contractStartDate;
  }

  return { periodStart, periodEnd };
}
