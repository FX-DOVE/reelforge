import { db } from "./db";
import { getConfig } from "./config";
import { currentUid, meteredSince } from "./usage";

/** Defaults protect the owner's Meta credits when sign-ups are open. 0 disables that window. */
export function quotaLimits() {
  const num = (key: string, fallback: number) => {
    const n = parseInt(getConfig(key) ?? "", 10);
    return Number.isFinite(n) ? n : fallback;
  };
  return { hourly: num("QUOTA_HOURLY", 40), daily: num("QUOTA_DAILY", 160) };
}

/** null = allowed. Otherwise a message safe to show the user. */
export function decideQuota(hourlyCount: number, dailyCount: number, hourly: number, daily: number): string | null {
  if (hourly > 0 && hourlyCount >= hourly)
    return `Hourly AI limit reached (${hourly} Meta calls per hour on this account). Wait a bit, or ask an admin to raise Usage limits.`;
  if (daily > 0 && dailyCount >= daily)
    return `Daily AI limit reached (${daily} Meta calls per day on this account). Ask an admin to raise Usage limits if this project needs more.`;
  return null;
}

/** Throw before a Meta API call when this signed-in user is over the admin cap. The admin account is exempt so a demo is not locked out. */
export function assertQuota() {
  const uid = currentUid();
  if (!uid || uid === "admin") return;
  const { hourly, daily } = quotaLimits();
  if (hourly <= 0 && daily <= 0) return;
  const owner = (pid?: string) => (pid ? db.getProject(pid)?.ownerId : undefined);
  const msg = decideQuota(
    hourly > 0 ? meteredSince(uid, 3_600_000, owner) : 0,
    daily > 0 ? meteredSince(uid, 86_400_000, owner) : 0,
    hourly,
    daily,
  );
  if (msg) throw new Error(msg);
}
