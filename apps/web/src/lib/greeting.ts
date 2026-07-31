export function getGreeting(date = new Date(), name?: string): string {
  const hour = date.getHours();
  const period = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const configuredName = name?.trim();
  return `Good ${period}${configuredName ? `, ${configuredName}` : ""}.`;
}

export function formatToday(date = new Date()): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatMarketTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}
