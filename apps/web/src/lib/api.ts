import { dashboardData, findCompany, type AssistantAnswer, type Company, type ComparisonResult, type DashboardData } from "@invest-vitals/domain";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, init);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export async function getDashboard(): Promise<DashboardData> {
  try {
    return await request<DashboardData>("/dashboard");
  } catch {
    return dashboardData;
  }
}

export async function getCompany(symbol: string): Promise<Company> {
  try {
    return await request<Company>(`/companies/${encodeURIComponent(symbol)}`);
  } catch {
    const company = findCompany(symbol);
    if (!company) throw new Error("Company not found");
    return company;
  }
}

export async function compareCompanies(symbols: string[]): Promise<ComparisonResult> {
  return request<ComparisonResult>(`/compare?symbols=${encodeURIComponent(symbols.join(","))}`);
}

export async function askAssistant(question: string): Promise<AssistantAnswer> {
  return request<AssistantAnswer>("/assistant", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
  });
}
