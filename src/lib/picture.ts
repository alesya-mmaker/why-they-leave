// Сводка «где и почему уходят» за последние 12 месяцев.

import { addDays, diffDays } from "./dates";
import { POINTS, PROBATION_DAYS, exitReason, fireForHire, hires } from "./logic";
import { DemoState, HireTask, ReasonCategory } from "./types";

export interface ReasonCount {
  category: ReasonCategory;
  count: number;
}

export interface Row {
  key: string;
  hired: number;
  earlyLeft: number;
  rate: number;
  exitReasons: ReasonCount[]; // почему ушли (опрос «ухожу» или задача увольнения)
  stayIssues: ReasonCount[]; // что мешает: сколько людей хотя бы раз назвали причину в опросах «пока работаю»
  answered: number; // сколько людей ответили хотя бы на один опрос (не больше, чем пришло)
  complained: number; // из них хотя бы раз ответили «Есть сложности» или «Думаю уйти»
}

function top(map: Map<ReasonCategory, number>): ReasonCount[] {
  return [...map.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
}

function inc(map: Map<ReasonCategory, number>, c: ReasonCategory) {
  map.set(c, (map.get(c) ?? 0) + 1);
}

function aggregate(s: DemoState, key: string, group: HireTask[]): Row {
  const exitMap = new Map<ReasonCategory, number>();
  const stayPeople = new Map<ReasonCategory, Set<string>>();
  const answeredPeople = new Set<string>();
  const complainedPeople = new Set<string>();
  let earlyLeft = 0;
  const ids = new Set(group.map((h) => h.id));

  for (const h of group) {
    const fire = fireForHire(s, h.id);
    // Уход считается, когда последний день уже прошёл: до этого человека ещё можно удержать.
    if (fire && fire.lastDay <= s.today && diffDays(h.startDate, fire.lastDay) < PROBATION_DAYS) {
      earlyLeft++;
      inc(exitMap, exitReason(s, fire).category);
    }
  }
  for (const r of s.responses) {
    if (!ids.has(r.hireTaskId)) continue;
    answeredPeople.add(r.hireTaskId);
    const a = r.answer;
    if (a.kind !== "stay" || a.mood === "good") continue;
    complainedPeople.add(r.hireTaskId);
    // Человек мог назвать одну причину в нескольких опросах: считаем его один раз.
    const cats: ReasonCategory[] = a.blockers.length ? a.blockers : a.commentCat ? [a.commentCat.category] : [];
    for (const c of cats) {
      if (!stayPeople.has(c)) stayPeople.set(c, new Set());
      stayPeople.get(c)!.add(r.hireTaskId);
    }
  }
  const stayMap = new Map<ReasonCategory, number>([...stayPeople].map(([c, set]) => [c, set.size]));
  return {
    key,
    hired: group.length,
    earlyLeft,
    rate: group.length ? earlyLeft / group.length : 0,
    exitReasons: top(exitMap),
    stayIssues: top(stayMap),
    answered: answeredPeople.size,
    complained: complainedPeople.size,
  };
}

export function buildPicture(s: DemoState) {
  const from = addDays(s.today, -365);
  const inPeriod = hires(s).filter((h) => h.startDate >= from && h.startDate <= s.today);

  const total = aggregate(s, "Всего", inPeriod);
  const byPoint = POINTS.map((p) => ({
    ...aggregate(s, p.name, inPeriod.filter((h) => h.point === p.name)),
    dept: p.dept,
    manager: p.manager,
  }));
  const depts = [...new Set(POINTS.map((p) => p.dept))];
  const byDept = depts.map((d) => aggregate(s, d, inPeriod.filter((h) => h.dept === d)));

  const managers = [...new Set(inPeriod.map((h) => h.manager))];
  const byManager = managers.map((m) => ({
    ...aggregate(s, m, inPeriod.filter((h) => h.manager === m)),
    point: inPeriod.find((h) => h.manager === m)?.point ?? "",
  }));

  return { from, total, byPoint, byDept, byManager };
}

/** Порог «проблемной» точки: доля ранних уходов в HOT_FACTOR раза выше средней по компании. */
export const HOT_FACTOR = 1.5;

export function isHot(row: Row, total: Row): boolean {
  return row.earlyLeft > 0 && row.rate >= total.rate * HOT_FACTOR;
}
