import { PrismaClient, UserRole, TicketStatus, TicketPriority, TicketSource, WorkType, ExpenseType, ContractType, FlatRateUnit } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Dev-only seed password for every seeded account (staff + portal contacts).
const DEV_PASSWORD = "password123";

async function main() {
  const alreadySeeded = await prisma.client.count();
  if (alreadySeeded > 0) {
    console.log("Database already has Client rows — skipping seed to avoid duplicates.");
    return;
  }

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  // ── Users ──────────────────────────────────────────────
  const [admin, manager, techAlice, techBen] = await Promise.all([
    prisma.user.upsert({
      where: { email: "priya.admin@ourmsp.com" },
      update: {},
      create: { email: "priya.admin@ourmsp.com", name: "Priya Shah", title: "System Administrator", role: UserRole.ADMIN, passwordHash },
    }),
    prisma.user.upsert({
      where: { email: "marcus.manager@ourmsp.com" },
      update: {},
      create: { email: "marcus.manager@ourmsp.com", name: "Marcus Webb", title: "Service Delivery Manager", role: UserRole.MANAGER, passwordHash },
    }),
    prisma.user.upsert({
      where: { email: "alice.tech@ourmsp.com" },
      update: {},
      create: { email: "alice.tech@ourmsp.com", name: "Alice Nguyen", title: "Senior Technician", role: UserRole.TECHNICIAN, passwordHash },
    }),
    prisma.user.upsert({
      where: { email: "ben.tech@ourmsp.com" },
      update: {},
      create: { email: "ben.tech@ourmsp.com", name: "Ben Torres", title: "Field Technician", role: UserRole.TECHNICIAN, passwordHash },
    }),
  ]);

  // ── Boards ─────────────────────────────────────────────
  const [supportBoard, installBoard, helpdesk1, helpdesk2] = await Promise.all([
    prisma.board.upsert({ where: { name: "Support" }, update: {}, create: { name: "Support", description: "General break/fix support tickets" } }),
    prisma.board.upsert({ where: { name: "Physical Install" }, update: {}, create: { name: "Physical Install", description: "On-site hardware installs and wiring" } }),
    prisma.board.upsert({ where: { name: "Help Desk 1" }, update: {}, create: { name: "Help Desk 1", description: "Tier 1 help desk queue" } }),
    prisma.board.upsert({ where: { name: "Help Desk 2" }, update: {}, create: { name: "Help Desk 2", description: "Tier 2 escalations" } }),
  ]);

  // ── Categories (with sub-categories) ──────────────────
  const networkCat = await prisma.category.create({ data: { name: "Network" } });
  const [wifiCat, vpnCat] = await Promise.all([
    prisma.category.create({ data: { name: "Wi-Fi", parentId: networkCat.id } }),
    prisma.category.create({ data: { name: "VPN", parentId: networkCat.id } }),
  ]);

  const hardwareCat = await prisma.category.create({ data: { name: "Hardware" } });
  const [desktopCat, printerCat] = await Promise.all([
    prisma.category.create({ data: { name: "Desktop", parentId: hardwareCat.id } }),
    prisma.category.create({ data: { name: "Printer", parentId: hardwareCat.id } }),
  ]);

  const softwareCat = await prisma.category.create({ data: { name: "Software" } });
  const [emailCat, licensingCat] = await Promise.all([
    prisma.category.create({ data: { name: "Email", parentId: softwareCat.id } }),
    prisma.category.create({ data: { name: "Licensing", parentId: softwareCat.id } }),
  ]);

  // ── Clients (Acme Corp has a child location) ──────────
  const acme = await prisma.client.create({
    data: { name: "Acme Corp", billingAddress: "100 Industrial Pkwy, Springfield, IL" },
  });
  const acmeDowntown = await prisma.client.create({
    data: { name: "Acme Corp — Downtown Branch", parentId: acme.id, billingAddress: "22 Main St, Springfield, IL" },
  });
  const brightPath = await prisma.client.create({
    data: { name: "BrightPath Dental", billingAddress: "455 Willow Ave, Rockford, IL" },
  });
  const summit = await prisma.client.create({
    data: { name: "Summit Legal Group", billingAddress: "9 Courthouse Sq, Peoria, IL" },
  });

  // ── Contacts ───────────────────────────────────────────
  const [acmeCEO, acmeIT, acmeBilling] = await Promise.all([
    prisma.contact.create({ data: { clientId: acme.id, firstName: "Diane", lastName: "Cross", email: "diane.cross@acmecorp.com", title: "CEO", isPrimary: true, portalAccess: true, passwordHash } }),
    prisma.contact.create({ data: { clientId: acme.id, firstName: "Kevin", lastName: "Ortiz", email: "kevin.ortiz@acmecorp.com", title: "IT Coordinator", portalAccess: true, passwordHash } }),
    prisma.contact.create({ data: { clientId: acme.id, firstName: "Renee", lastName: "Fields", email: "renee.fields@acmecorp.com", title: "Accounts Payable", isBilling: true } }),
  ]);
  const acmeDowntownContact = await prisma.contact.create({
    data: { clientId: acmeDowntown.id, firstName: "Sam", lastName: "Patel", email: "sam.patel@acmecorp.com", title: "Branch Manager", isPrimary: true, portalAccess: true, passwordHash },
  });
  const [brightPathOwner, brightPathOffice] = await Promise.all([
    prisma.contact.create({ data: { clientId: brightPath.id, firstName: "Dr. Lauren", lastName: "Hayes", email: "lauren.hayes@brightpathdental.com", title: "Owner/Dentist", isPrimary: true, isBilling: true, portalAccess: true, passwordHash } }),
    prisma.contact.create({ data: { clientId: brightPath.id, firstName: "Nina", lastName: "Alvarez", email: "nina.alvarez@brightpathdental.com", title: "Office Manager", portalAccess: true, passwordHash } }),
  ]);
  const [summitPartner, summitIT] = await Promise.all([
    prisma.contact.create({ data: { clientId: summit.id, firstName: "Harold", lastName: "Reyes", email: "harold.reyes@summitlegal.com", title: "Managing Partner", isPrimary: true, isBilling: true } }),
    prisma.contact.create({ data: { clientId: summit.id, firstName: "Ivy", lastName: "Chen", email: "ivy.chen@summitlegal.com", title: "Office Administrator", portalAccess: true, passwordHash } }),
  ]);

  // ── Contracts (one of each type) ──────────────────────
  const acmeRetainer = await prisma.contract.create({
    data: {
      clientId: acme.id,
      name: "Acme Corp — Monthly Retainer",
      type: ContractType.RETAINER,
      startDate: new Date("2025-01-01T00:00:00Z"),
      blockHoursPerPeriod: 20,
      rolloverHours: false,
    },
  });
  const brightPathFlatRate = await prisma.contract.create({
    data: {
      clientId: brightPath.id,
      name: "BrightPath Dental — Managed Flat Rate",
      type: ContractType.MSP_FLAT_RATE,
      startDate: new Date("2025-03-01T00:00:00Z"),
      flatRateAmount: 45.0,
      flatRateUnit: FlatRateUnit.PER_DEVICE,
      unitCount: 18,
    },
  });
  const summitTM = await prisma.contract.create({
    data: {
      clientId: summit.id,
      name: "Summit Legal Group — Time & Materials",
      type: ContractType.TIME_AND_MATERIALS,
      startDate: new Date("2025-06-01T00:00:00Z"),
      defaultHourlyRate: 150.0,
    },
  });
  await prisma.contractRate.create({
    data: { contractId: summitTM.id, workType: WorkType.ONSITE, hourlyRate: 185.0 },
  });

  // ── Tickets ────────────────────────────────────────────
  const ticketDefs = [
    { title: "VPN drops intermittently for remote staff", description: "Multiple users report VPN disconnects every 20-30 minutes since Monday.", board: supportBoard, client: acme, contact: acmeIT, category: vpnCat, status: TicketStatus.IN_PROGRESS, priority: TicketPriority.HIGH, source: TicketSource.EMAIL, assignee: techAlice },
    { title: "New hire laptop setup — Downtown Branch", description: "Provision a new laptop for incoming branch associate starting next Monday.", board: installBoard, client: acmeDowntown, contact: acmeDowntownContact, category: desktopCat, status: TicketStatus.OPEN, priority: TicketPriority.MEDIUM, source: TicketSource.PORTAL, assignee: techBen },
    { title: "Printer offline in accounting", description: "Front-desk printer shows offline; accounting can't print invoices.", board: helpdesk1, client: acme, contact: acmeBilling, category: printerCat, status: TicketStatus.WAITING_ON_CLIENT, priority: TicketPriority.MEDIUM, source: TicketSource.PORTAL, assignee: techBen },
    { title: "Wi-Fi dead zone in waiting room", description: "Guest Wi-Fi barely reaches the patient waiting area.", board: supportBoard, client: brightPath, contact: brightPathOffice, category: wifiCat, status: TicketStatus.OPEN, priority: TicketPriority.LOW, source: TicketSource.EMAIL, assignee: null },
    { title: "Email bouncing for new associate", description: "New associate's mailbox not receiving external mail, NDRs since setup.", board: helpdesk1, client: summit, contact: summitIT, category: emailCat, status: TicketStatus.IN_PROGRESS, priority: TicketPriority.HIGH, source: TicketSource.PORTAL, assignee: techAlice },
    { title: "Server room AC alarm — investigate", description: "RMM alert for elevated temperature in Acme server closet.", board: supportBoard, client: acme, contact: null, category: null, status: TicketStatus.OPEN, priority: TicketPriority.EMERGENCY, source: TicketSource.MANUAL, assignee: techAlice },
    { title: "Practice management software license renewal", description: "Annual license for dental practice software is expiring in 2 weeks.", board: helpdesk2, client: brightPath, contact: brightPathOwner, category: licensingCat, status: TicketStatus.OPEN, priority: TicketPriority.MEDIUM, source: TicketSource.EMAIL, assignee: null },
    { title: "Conference room display won't pair", description: "Wireless presentation dongle won't connect to the new display.", board: installBoard, client: summit, contact: summitIT, category: desktopCat, status: TicketStatus.RESOLVED, priority: TicketPriority.LOW, source: TicketSource.PORTAL, assignee: techBen },
    { title: "Password reset — locked out of email", description: "Owner locked out of mailbox after too many failed attempts.", board: helpdesk1, client: brightPath, contact: brightPathOwner, category: emailCat, status: TicketStatus.CLOSED, priority: TicketPriority.MEDIUM, source: TicketSource.PHONE, assignee: techAlice },
    { title: "Firewall rule request for new billing vendor", description: "Need outbound access opened for a new billing/clearinghouse integration.", board: supportBoard, client: summit, contact: summitPartner, category: vpnCat, status: TicketStatus.IN_PROGRESS, priority: TicketPriority.HIGH, source: TicketSource.MANUAL, assignee: techAlice },
    { title: "Desktop won't boot past login screen", description: "Front office desktop hangs on Windows login spinner.", board: helpdesk2, client: acme, contact: acmeIT, category: desktopCat, status: TicketStatus.OPEN, priority: TicketPriority.HIGH, source: TicketSource.PORTAL, assignee: techBen },
    { title: "Install new network switch — Downtown Branch", description: "Replace aging 8-port switch with managed 24-port unit.", board: installBoard, client: acmeDowntown, contact: acmeDowntownContact, category: networkCat, status: TicketStatus.OPEN, priority: TicketPriority.MEDIUM, source: TicketSource.MANUAL, assignee: techBen },
    { title: "Recurring Wi-Fi disconnects on iPads", description: "Front desk iPads randomly drop Wi-Fi and require manual reconnect.", board: helpdesk1, client: brightPath, contact: brightPathOffice, category: wifiCat, status: TicketStatus.WAITING_ON_CLIENT, priority: TicketPriority.LOW, source: TicketSource.EMAIL, assignee: techAlice },
  ];

  const tickets = [];
  for (const t of ticketDefs) {
    const ticket = await prisma.ticket.create({
      data: {
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        source: t.source,
        boardId: t.board.id,
        clientId: t.client.id,
        contactId: t.contact?.id ?? null,
        assigneeId: t.assignee?.id ?? null,
        categoryId: t.category?.id ?? null,
        resolvedAt: t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED ? new Date() : null,
        closedAt: t.status === TicketStatus.CLOSED ? new Date() : null,
      },
    });
    tickets.push(ticket);
  }

  // ── Ticket Comments ────────────────────────────────────
  await prisma.ticketComment.createMany({
    data: [
      { ticketId: tickets[0].id, authorUserId: techAlice.id, body: "Pulled logs from the VPN concentrator, checking for a firmware issue.", isInternal: true },
      { ticketId: tickets[0].id, authorContactId: acmeIT.id, body: "Thanks for looking into this — it's happening to at least 5 of our remote staff." },
      { ticketId: tickets[2].id, authorUserId: techBen.id, body: "Confirmed printer needs a new fuser unit, ordering part.", isInternal: true },
      { ticketId: tickets[4].id, authorUserId: techAlice.id, body: "Mail flow rule was misconfigured on the new mailbox, corrected and monitoring." },
      { ticketId: tickets[8].id, authorContactId: brightPathOwner.id, body: "All set, I'm back in — thank you for the quick turnaround!" },
    ],
  });

  // ── CSAT Response ──────────────────────────────────────
  // tickets[8] is the one seeded CLOSED ticket — a real app close would
  // trigger this via lib/csat.ts; seeded directly here since seed data
  // bypasses the Server Action entirely.
  await prisma.csatResponse.create({
    data: {
      ticketId: tickets[8].id,
      rating: 5,
      comment: "Fast response, walked me through it clearly. Thanks!",
      sentAt: new Date(),
      respondedAt: new Date(),
    },
  });

  // ── Time Logs ──────────────────────────────────────────
  await prisma.timeLog.createMany({
    data: [
      { ticketId: tickets[0].id, userId: techAlice.id, contractId: acmeRetainer.id, startTime: new Date("2025-07-08T14:00:00Z"), endTime: new Date("2025-07-08T15:30:00Z"), durationMinutes: 90, billable: true, workType: WorkType.REMOTE, notesInternal: "Investigated VPN concentrator logs, updated firmware." },
      { ticketId: tickets[5].id, userId: techAlice.id, contractId: acmeRetainer.id, startTime: new Date("2025-07-09T09:00:00Z"), endTime: new Date("2025-07-09T09:45:00Z"), durationMinutes: 45, billable: true, workType: WorkType.ONSITE, notesInternal: "Checked server room AC unit, reset alarm threshold." },
      { ticketId: tickets[9].id, userId: techAlice.id, contractId: summitTM.id, startTime: new Date("2025-07-10T11:00:00Z"), endTime: new Date("2025-07-10T12:00:00Z"), durationMinutes: 60, billable: true, workType: WorkType.REMOTE, notesInternal: "Configured firewall rule for new billing vendor endpoint." },
      { ticketId: tickets[8].id, userId: techAlice.id, startTime: new Date("2025-07-05T16:00:00Z"), endTime: new Date("2025-07-05T16:15:00Z"), durationMinutes: 15, billable: false, workType: WorkType.ADMIN, notesInternal: "Quick password reset, no contract hours consumed." },
    ],
  });

  // ── Expenses ───────────────────────────────────────────
  await prisma.expense.createMany({
    data: [
      { ticketId: tickets[1].id, userId: techBen.id, type: ExpenseType.MILEAGE, description: "Round trip to Acme Downtown Branch for laptop drop-off", amount: 18.4, miles: 32, billable: true },
      { ticketId: tickets[2].id, userId: techBen.id, type: ExpenseType.MATERIAL, description: "Replacement fuser unit for accounting printer", amount: 89.99, billable: true },
    ],
  });

  // ── Assets ───────────────────────────────────────────────
  // Default categories are seeded by the asset_categories migration itself
  // (one per the old fixed AssetType enum value) — look them up by name
  // rather than hardcoding the migration's ids here.
  const assetCategories = await prisma.assetCategory.findMany();
  const assetCategoryId = (name: string) => {
    const category = assetCategories.find((c) => c.name === name);
    if (!category) throw new Error(`Asset category "${name}" not found — did migrations run?`);
    return category.id;
  };

  const [acmeServer, acmeFirewall, brightPathWorkstation] = await Promise.all([
    prisma.asset.create({
      data: { clientId: acme.id, categoryId: assetCategoryId("Server"), name: "ACME-FS01 (File Server)", serialNumber: "SN-88213" },
    }),
    prisma.asset.create({
      data: { clientId: acme.id, categoryId: assetCategoryId("Network Device"), name: "Acme HQ Firewall", serialNumber: "SN-77102" },
    }),
    prisma.asset.create({
      data: { clientId: brightPath.id, categoryId: assetCategoryId("Workstation"), name: "Front Desk PC", serialNumber: "SN-55901" },
    }),
  ]);

  await prisma.ticketAsset.createMany({
    data: [
      { ticketId: tickets[0].id, assetId: acmeFirewall.id }, // "VPN drops intermittently for remote staff"
      { ticketId: tickets[5].id, assetId: acmeServer.id }, // "Server room AC alarm — investigate"
      { ticketId: tickets[8].id, assetId: brightPathWorkstation.id }, // "Password reset — locked out of email"
    ],
  });

  // ── Scheduled Visits ─────────────────────────────────────
  // Relative to seed-run time, not fixed 2025 dates like TimeLogs — a
  // scheduled visit is forward-looking, so a freshly seeded DB should show
  // something in the current/next week no matter when seed runs.
  const seedNow = new Date();
  const addHours = (base: Date, hours: number) => new Date(base.getTime() + hours * 60 * 60 * 1000);

  await prisma.scheduledVisit.createMany({
    data: [
      {
        ticketId: tickets[5].id, // "Server room AC alarm — investigate"
        technicianId: techAlice.id,
        startTime: addHours(seedNow, 4),
        endTime: addHours(seedNow, 5),
        location: "Acme Corp — Server Room",
      },
      {
        ticketId: tickets[6].id, // "Install new network switch — Downtown Branch"
        technicianId: techBen.id,
        startTime: addHours(seedNow, 26),
        endTime: addHours(seedNow, 28),
        location: "Acme Downtown Branch",
      },
    ],
  });

  // ── Canned Responses ───────────────────────────────────
  await prisma.cannedResponse.createMany({
    data: [
      {
        title: "Ticket Received Acknowledgement",
        body: "Hi {{client_name}}, thanks for reaching out. We've logged your request as ticket {{ticket_id}} and a technician will be in touch shortly.",
        boardId: null,
        createdById: manager.id,
      },
      {
        title: "Resolution Follow-up",
        body: "Hi {{client_name}}, we've marked ticket {{ticket_id}} as resolved. Please let us know if the issue resurfaces and we'll reopen it right away.",
        boardId: supportBoard.id,
        createdById: manager.id,
      },
    ],
  });

  // ── KB Articles ─────────────────────────────────────────
  await prisma.kbArticle.createMany({
    data: [
      {
        title: "How to reset your Wi-Fi router",
        body: "1. Unplug the router for 30 seconds.\n2. Plug it back in and wait for all lights to turn solid.\n3. If Wi-Fi still doesn't appear, contact us and reference this article.",
        boardId: helpdesk1.id,
        categoryId: wifiCat.id,
        isInternal: false,
        createdById: techAlice.id,
      },
      {
        title: "Requesting a new firewall rule",
        body: "Submit a ticket on the Support board with: the destination IP/hostname, port(s), and protocol needed, plus the business reason. Firewall changes are batched and applied during the next maintenance window unless marked EMERGENCY.",
        boardId: supportBoard.id,
        categoryId: vpnCat.id,
        isInternal: false,
        createdById: techBen.id,
      },
      {
        title: "Internal: RMM agent reinstall procedure",
        body: "1. Uninstall the existing agent via Programs & Features.\n2. Delete leftover files in %ProgramData%\\RMM.\n3. Reboot before reinstalling — a reinstall over a half-removed agent is the #1 cause of duplicate device records in the console.",
        boardId: null,
        categoryId: desktopCat.id,
        isInternal: true,
        createdById: techAlice.id,
      },
    ],
  });

  // ── SLA Policies (one per priority) ────────────────────
  await prisma.slaPolicy.createMany({
    data: [
      { priority: TicketPriority.LOW, responseTargetMinutes: 480, resolutionTargetMinutes: 4320 },
      { priority: TicketPriority.MEDIUM, responseTargetMinutes: 240, resolutionTargetMinutes: 1440 },
      { priority: TicketPriority.HIGH, responseTargetMinutes: 60, resolutionTargetMinutes: 480 },
      { priority: TicketPriority.EMERGENCY, responseTargetMinutes: 15, resolutionTargetMinutes: 240 },
    ],
  });

  // ── Automation Rules (IFTTT-style) ─────────────────────
  await prisma.automationRule.createMany({
    data: [
      {
        name: "Auto-assign Emergency tickets to Alice",
        triggerType: "TICKET_CREATED",
        conditionPriority: TicketPriority.EMERGENCY,
        actionType: "ASSIGN_TECHNICIAN",
        actionAssigneeId: techAlice.id,
      },
      {
        name: "Notify on Support board status change",
        triggerType: "STATUS_CHANGED",
        conditionBoardId: supportBoard.id,
        actionType: "SEND_EMAIL_NOTIFICATION",
      },
      {
        name: "Escalate idle Emergency tickets to Marcus",
        triggerType: "IDLE_TIME_EXCEEDED",
        conditionPriority: TicketPriority.EMERGENCY,
        conditionIdleMinutes: 60,
        actionType: "ASSIGN_TECHNICIAN",
        actionAssigneeId: manager.id,
      },
    ],
  });

  console.log("Seed complete:");
  console.log("  Users: 4, Boards: 4, Categories: 9 (3 parent + 6 sub)");
  console.log("  Clients: 4 (incl. 1 parent/child pair), Contacts: 9, Contracts: 3 (+1 ContractRate)");
  console.log(`  Tickets: ${tickets.length}, TicketComments: 5, TimeLogs: 4, Expenses: 2, CannedResponses: 2, KbArticles: 3, Assets: 3 (+3 TicketAsset links), ScheduledVisits: 2`);
  console.log("  SlaPolicies: 4 (one per priority), AutomationRules: 3 (incl. 1 idle-time)");
  console.log(`  Dev login password for all seeded accounts: "${DEV_PASSWORD}"`);
  console.log("  Staff: priya.admin@ourmsp.com / marcus.manager@ourmsp.com / alice.tech@ourmsp.com / ben.tech@ourmsp.com");
  console.log("  Client portal: diane.cross@acmecorp.com / lauren.hayes@brightpathdental.com (and others with portalAccess)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
