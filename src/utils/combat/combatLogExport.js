import { getChronologicalCombatEvents } from "./combatLogWindow.js";

export function formatCombatLogTimestamp(entry = {}) {
  if (entry?.displayTimestamp) return entry.displayTimestamp;
  if (typeof entry?.timestamp === "string") return entry.timestamp;
  if (Number.isFinite(entry?.timestamp)) return new Date(entry.timestamp).toLocaleTimeString();
  return "";
}

function padSequence(entry = {}) {
  return String(entry.seq ?? 0).padStart(6, "0");
}

function safeJson(value) {
  if (!value || (typeof value === "object" && Object.keys(value).length === 0)) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function formatCombatLogEventForExport(entry = {}) {
  const audience = String(entry.audience || "unknown").toUpperCase();
  const channel = entry.channel || "system";
  const type = entry.eventType || entry.type || entry.level || "event";
  const severity = entry.level || entry.type || "info";
  const metadata = [
    entry.actorId ? `actorId=${entry.actorId}` : "",
    entry.targetId ? `targetId=${entry.targetId}` : "",
    entry.round != null ? `round=${entry.round}` : "",
    entry.turn != null ? `turn=${entry.turn}` : "",
    entry.turnIndex != null ? `turnIndex=${entry.turnIndex}` : "",
    entry.turnToken ? `turnToken=${entry.turnToken}` : "",
    entry.executionKey ? `executionKey=${entry.executionKey}` : "",
    entry.source ? `source=${entry.source}` : "",
  ].filter(Boolean);
  const details = [
    safeJson(entry.data) ? `data=${safeJson(entry.data)}` : "",
    safeJson(entry.diceInfo) ? `dice=${safeJson(entry.diceInfo)}` : "",
  ].filter(Boolean);
  const suffix = [...metadata, ...details].length
    ? ` | ${[...metadata, ...details].join(" | ")}`
    : "";

  return `[#${padSequence(entry)} ${formatCombatLogTimestamp(entry)}] [${audience}/${channel}/${type}/${severity}] ${entry.message || ""}${suffix}`;
}

export function buildCombatLogText(events = [], {
  trimNoticeCount = 0,
  chronological = true,
} = {}) {
  const source = chronological ? getChronologicalCombatEvents(events) : (Array.isArray(events) ? events : []);
  const trimNotice = trimNoticeCount > 0
    ? `[${trimNoticeCount} older combat log event(s) were trimmed from live memory.]\n`
    : "";
  return `${trimNotice}${source.map(formatCombatLogEventForExport).join("\n")}`;
}

export function buildCombatLogFilename(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `combat-log-${yyyy}-${mm}-${dd}-${hh}${mi}${ss}.txt`;
}
