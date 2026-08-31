import type {
  AppData,
  Campaign,
  ClientRecord,
  Customer,
  DailyMetric,
  Deal,
  TeamCapacity,
  TimeEntry,
  Transaction,
} from "./types";
import { choice, daysAgo, rand, uid } from "./utils";

export function generateDemoData(): AppData {
  const categories = ["Software", "Ads", "Salaries", "Design", "Hosting", "Transport", "Office", "Training"];
  const incomeCategories = ["Retainer", "Project", "Consulting", "Training"];
  const channels = ["SEO", "PPC", "Social", "Email"];
  const clientNames = ["Nova Labs", "BrightFoods", "CityMed", "EduSpark", "Kora Beauty", "MetroLegal", "SwiftPay", "GreenNest"];
  const services = ["SEO", "PPC", "Design", "Web", "Content"];

  const transactions: Transaction[] = [];
  for (let i = 0; i < 180; i++) {
    const type: "income" | "expense" = Math.random() > 0.46 ? "income" : "expense";
    transactions.push({
      id: uid("tx"),
      date: daysAgo(rand(0, 89)),
      type,
      category: type === "income" ? choice(incomeCategories) : choice(categories),
      amount: type === "income" ? rand(900, 8500) : rand(80, 3200),
      description: type === "income" ? `${choice(clientNames)} payment` : `${choice(categories)} spend`,
    });
  }

  const campaigns: Campaign[] = Array.from({ length: 16 }, (_, i) => {
    const channel = choice(channels);
    const spend = rand(500, 7000);
    const clicks = rand(300, 7000);
    const conversions = rand(8, 180);
    return {
      id: uid("camp"),
      name: `${channel} Campaign ${i + 1}`,
      channel,
      campaignType: choice(["Lead Gen", "Awareness", "Retargeting", "Launch"]),
      startDate: daysAgo(rand(30, 90)),
      endDate: daysAgo(rand(0, 29)),
      spend,
      impressions: clicks * rand(8, 34),
      clicks,
      conversions,
      revenue: spend * (Math.random() * 3.5 + 0.6),
    };
  });

  const daily_metrics: DailyMetric[] = [];
  for (let d = 89; d >= 0; d--) {
    channels.forEach((channel) => {
      const spend = rand(20, 450);
      const leads = rand(0, 25);
      daily_metrics.push({
        date: daysAgo(d),
        channel,
        spend,
        clicks: rand(20, 600),
        leads,
        hour: rand(8, 21),
        costPerLead: leads ? spend / leads : spend,
      });
    });
  }

  const clientRecords: ClientRecord[] = clientNames.map((name) => {
    const monthlyRetainer = rand(1500, 9500);
    const contractHours = rand(18, 80);
    const actualHours = contractHours + rand(-12, 45);
    const scopeCreepHours = Math.max(0, actualHours - contractHours + rand(0, 15));
    return {
      id: uid("client"),
      name,
      tier: choice(["A", "B", "C"]) as "A" | "B" | "C",
      serviceLine: choice(services),
      monthlyRetainer,
      contractHours,
      actualHours,
      scopeCreepHours,
      billableExpenses: rand(100, 2400),
      clientRevenue: monthlyRetainer + rand(0, 5000),
    };
  });

  const time_entries: TimeEntry[] = [];
  clientRecords.forEach((c) => {
    for (let i = 0; i < 18; i++) {
      time_entries.push({
        id: uid("time"),
        clientId: c.id,
        date: daysAgo(rand(0, 89)),
        hours: rand(1, 8),
        description: `${c.serviceLine} work`,
        billable: Math.random() > 0.35,
        approved: Math.random() > 0.6,
      });
    }
  });

  const deals: Deal[] = Array.from({ length: 22 }, () => ({
    id: uid("deal"),
    clientName: `${choice(["Alpha", "Prime", "Vertex", "Royal", "Blue", "Urban"])} ${choice(["Group", "Stores", "Health", "Foods", "Media"])}`,
    value: rand(2000, 30000),
    stage: choice(["Proposal", "Negotiation", "Closed Won", "Closed Lost"]) as Deal["stage"],
    industry: choice(["SaaS", "Retail", "Healthcare", "Education", "Finance"]),
    expectedCloseDate: daysAgo(-rand(3, 105)),
    probability: choice([20, 35, 50, 70, 90, 100]),
    requiredRole: choice(services),
    hoursNeeded: rand(12, 160),
  }));

  const team: TeamCapacity[] = services.map((role) => ({
    role,
    availableHoursThisMonth: rand(70, 180),
    totalCapacity: rand(120, 220),
  }));

  const customers: Customer[] = Array.from({ length: 40 }, (_, i) => {
    const channel = choice(channels);
    const cac = rand(120, 2600);
    const lifetimeRevenue = rand(1200, 42000);
    const churned = Math.random() < 0.22;
    return {
      id: uid("cust"),
      name: `${choice(clientNames)} ${i + 1}`,
      acquisitionDate: daysAgo(rand(0, 700)),
      acquisitionChannel: channel,
      cac,
      firstYearRevenue: rand(900, 16000),
      lifetimeRevenue,
      churnDate: churned ? daysAgo(rand(0, 180)) : null,
    };
  });

  return {
    settings: {
      currency: "₦",
      fiscalStartMonth: "January",
      hourlyCost: 45,
      targetLtvCac: 3,
      monthlyBudget: 25000,
      categoryBudgets: {
        Software: 2500,
        Ads: 7000,
        Salaries: 12000,
        Design: 3500,
        Hosting: 1200,
        Transport: 1000,
        Office: 1500,
        Training: 1000,
      },
    },
    transactions,
    campaigns,
    daily_metrics,
    clients: clientRecords,
    time_entries,
    deals,
    team,
    customers,
  };
}
