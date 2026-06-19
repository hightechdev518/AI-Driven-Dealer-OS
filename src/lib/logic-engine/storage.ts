import { promises as fs } from "fs";
import path from "path";
import type { LogicRule } from "./types";

const RULES_FILE = path.join(process.cwd(), "data", "logic-rules.json");

export async function loadCustomRules(): Promise<LogicRule[]> {
  try {
    const raw = await fs.readFile(RULES_FILE, "utf-8");
    const parsed = JSON.parse(raw) as LogicRule[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveCustomRule(rule: LogicRule): Promise<void> {
  const rules = await loadCustomRules();
  rules.push(rule);
  await fs.mkdir(path.dirname(RULES_FILE), { recursive: true });
  await fs.writeFile(RULES_FILE, JSON.stringify(rules, null, 2), "utf-8");
}

export async function loadAllRules(
  builtInRules: LogicRule[]
): Promise<LogicRule[]> {
  const custom = await loadCustomRules();
  return [...builtInRules, ...custom];
}
