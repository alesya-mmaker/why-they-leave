// Чистые функции над DemoState: каждая принимает состояние и возвращает новое.

import { addDays, diffDays } from "./dates";
import { categorizeText } from "./categorize";
import {
  Categorized,
  Category,
  DemoState,
  Dept,
  ExitAnswer,
  FireTask,
  Flag,
  FlagStatus,
  FlagType,
  HireTask,
  Point,
  StayAnswer,
  Subtask,
  SurveyResponse,
} from "./types";

export const POINTS: Point[] = [
  { name: "Склад", dept: "Склад", manager: "Громов Пётр" },
  { name: "Магазин №1", dept: "Магазин", manager: "Лебедева Ольга" },
  { name: "Магазин №2", dept: "Магазин", manager: "Соколов Андрей" },
  { name: "Магазин №3", dept: "Магазин", manager: "Брагин Виктор" },
  { name: "Магазин №4", dept: "Магазин", manager: "Котова Марина" },
  { name: "Отдел продаж", dept: "Отдел продаж", manager: "Фомин Денис" },
  { name: "Офис", dept: "Офис", manager: "Широкова Анна" },
];

export const STAY_DAYS = [7, 14, 30, 60];
export const PROBATION_DAYS = 90;

export function pointByName(name: string): Point {
  return POINTS.find((p) => p.name === name) ?? POINTS[0];
}

// ---------- id и токены ----------

function nextId(s: DemoState, prefix: string): string {
  s.seq += 1;
  return `${prefix}${s.seq}`;
}

function makeToken(s: DemoState): string {
  s.seq += 1;
  const rnd = Math.random().toString(36).slice(2, 7);
  return `${s.seq.toString(36)}${rnd}`;
}

function clone(s: DemoState): DemoState {
  return structuredClone(s);
}

// ---------- выборки ----------

export function hires(s: DemoState): HireTask[] {
  return s.tasks.filter((t): t is HireTask => t.type === "hire");
}

export function fires(s: DemoState): FireTask[] {
  return s.tasks.filter((t): t is FireTask => t.type === "fire");
}

export function hireById(s: DemoState, id: string): HireTask | undefined {
  return s.tasks.find((t): t is HireTask => t.type === "hire" && t.id === id);
}

export function fireForHire(s: DemoState, hireId: string): FireTask | undefined {
  return s.tasks.find((t): t is FireTask => t.type === "fire" && t.hireTaskId === hireId);
}

/** День стажа на дату (день выхода = 0). */
export function tenureDay(hire: HireTask, date: string): number {
  return diffDays(hire.startDate, date);
}

export function isOverdue(sub: Subtask, today: string): boolean {
  return sub.status === "pending" && sub.dueDate < today;
}

export function firstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[1] ?? parts[0];
}

/** Готовый текст сообщения для сотрудника. */
export function messageText(sub: Subtask, hire: HireTask, link: string): string {
  const name = firstName(hire.employee);
  if (sub.kind === "stay") {
    return `Здравствуйте, ${name}! Вы с нами уже ${sub.day} дней. Расскажите, как вам у нас, это займёт минуту. Ответы конфиденциальны: имя видит только HR и только если вы разрешите связаться. ${link}`;
  }
  return `${name}, жаль, что вы уходите. Ответьте, пожалуйста, на 3 вопроса, это поможет нам стать лучше для новых сотрудников. Ответы конфиденциальны: имя видит только HR и только если вы разрешите связаться. ${link}`;
}

// ---------- подзадачи ----------

/** Состояние подзадачи для HR с учётом даты в демо. */
export type SubtaskState = "planned" | "todo" | "overdue" | "sent" | "answered" | "cancelled";

export function subtaskState(sub: Subtask, today: string): SubtaskState {
  if (sub.status !== "pending") return sub.status;
  if (sub.dueDate > today) return "planned";
  return sub.dueDate < today ? "overdue" : "todo";
}

/** Опрос можно отправлять и проходить только с даты срока. */
export function isOpen(sub: Subtask, today: string): boolean {
  return sub.dueDate <= today && (sub.status === "pending" || sub.status === "sent");
}

export function advanceDays(s: DemoState, days: number): DemoState {
  return { ...s, today: addDays(s.today, days) };
}

export function markSent(input: DemoState, subtaskId: string): DemoState {
  const s = clone(input);
  const sub = s.subtasks.find((x) => x.id === subtaskId);
  if (sub && sub.status === "pending" && sub.dueDate <= s.today) {
    sub.status = "sent";
    sub.sentAt = s.today;
  }
  return s;
}

// ---------- задачи Битрикс24 ----------

export interface HireInput {
  employee: string;
  position: string;
  point: string;
  startDate: string;
  contact: string;
}

export function createHire(input: DemoState, f: HireInput): DemoState {
  const s = clone(input);
  const p = pointByName(f.point);
  const task: HireTask = {
    id: nextId(s, "t"),
    type: "hire",
    title: `Приём: ${f.employee}, ${f.position.toLowerCase()}, ${p.name}`,
    createdAt: s.today,
    status: "open",
    employee: f.employee,
    position: f.position,
    dept: p.dept as Dept,
    point: p.name,
    manager: p.manager,
    startDate: f.startDate,
    contact: f.contact,
  };
  s.tasks.push(task);

  // Все опросы «пока работаю» создаются сразу: HR видит план наперёд.
  for (const day of STAY_DAYS) {
    s.subtasks.push({
      id: nextId(s, "st"),
      hireTaskId: task.id,
      kind: "stay",
      day,
      dueDate: addDays(task.startDate, day),
      createdAt: s.today,
      status: "pending",
      token: makeToken(s),
    });
  }
  return s;
}

/** Можно ли увольнять через это демо: вышел и стаж сейчас меньше 90 дней. */
export function canFire(s: DemoState, hire: HireTask): boolean {
  return !fireForHire(s, hire.id) && hire.startDate <= s.today && tenureDay(hire, s.today) < PROBATION_DAYS;
}

export interface FireInput {
  hireTaskId: string;
  lastDay: string;
  reason: string;
}

export function createFire(input: DemoState, f: FireInput): { state: DemoState; fireId: string | null } {
  const s = clone(input);
  const hire = hireById(s, f.hireTaskId);
  if (!hire || fireForHire(s, hire.id)) return { state: input, fireId: null };
  const task: FireTask = {
    id: nextId(s, "t"),
    type: "fire",
    title: `Увольнение: ${hire.employee}, ${hire.position.toLowerCase()}, ${hire.point}`,
    createdAt: s.today,
    status: "open",
    employee: hire.employee,
    position: hire.position,
    dept: hire.dept,
    point: hire.point,
    manager: hire.manager,
    hireTaskId: hire.id,
    lastDay: f.lastDay,
    reason: f.reason,
    reasonCat: categorizeText(f.reason),
  };
  s.tasks.push(task);
  hire.status = "done";

  // Опросы «пока работаю» больше не нужны: и неотправленные, и отправленные без ответа.
  for (const sub of s.subtasks) {
    if (sub.hireTaskId === hire.id && sub.kind === "stay" && (sub.status === "pending" || sub.status === "sent")) {
      sub.status = "cancelled";
    }
  }
  // Флаги «думает уйти» / «есть сложности» закрываются: человек уже уходит.
  for (const fl of s.flags) {
    if (fl.hireTaskId === hire.id && fl.type !== "retain" && isActiveFlag(fl)) fl.status = "left";
  }

  // Стаж меньше 90 дней на последний день -> опрос при уходе.
  if (diffDays(hire.startDate, f.lastDay) < PROBATION_DAYS) {
    s.subtasks.push({
      id: nextId(s, "st"),
      hireTaskId: hire.id,
      kind: "exit",
      day: null,
      dueDate: s.today,
      createdAt: s.today,
      status: "pending",
      token: makeToken(s),
    });
  }
  return { state: s, fireId: task.id };
}

// ---------- ответы и флаги ----------

export type AnswerInput =
  | Omit<StayAnswer, "commentCat">
  | Omit<ExitAnswer, "detailsCat">;

function flagTypeFor(answer: StayAnswer | ExitAnswer): FlagType | null {
  if (!answer.contactOk) return null; // без согласия флага с именем нет
  if (answer.kind === "stay") {
    if (answer.mood === "leaving") return "leaving";
    if (answer.mood === "hard") return "hard";
    return null;
  }
  return answer.wouldStay === "yes" || answer.wouldStay === "maybe" ? "retain" : null;
}

export function submitResponse(
  input: DemoState,
  token: string,
  a: AnswerInput,
): { state: DemoState; responseId: string | null } {
  const s = clone(input);
  const sub = s.subtasks.find((x) => x.token === token);
  if (!sub || !isOpen(sub, s.today)) return { state: input, responseId: null };
  const hire = hireById(s, sub.hireTaskId);
  if (!hire) return { state: input, responseId: null };
  // После 90 дней стажа опросы «пока работаю» прекращаются.
  if (sub.kind === "stay" && tenureDay(hire, s.today) >= PROBATION_DAYS) return { state: input, responseId: null };

  const answer: StayAnswer | ExitAnswer =
    a.kind === "stay"
      ? { ...a, commentCat: a.comment.trim() ? categorizeText(a.comment) : null }
      : { ...a, detailsCat: a.details.trim() ? categorizeText(a.details) : null };

  const resp: SurveyResponse = {
    id: nextId(s, "r"),
    subtaskId: sub.id,
    hireTaskId: hire.id,
    date: s.today,
    tenureDay: tenureDay(hire, s.today),
    answer,
  };
  s.responses.push(resp);
  sub.status = "answered";

  const type = flagTypeFor(answer);
  if (type) {
    s.flags.push({
      id: nextId(s, "f"),
      type,
      responseId: resp.id,
      hireTaskId: hire.id,
      createdAt: s.today,
      status: "new",
    });
  }
  return { state: s, responseId: resp.id };
}

export function setFlagStatus(input: DemoState, flagId: string, status: FlagStatus): DemoState {
  const s = clone(input);
  const f = s.flags.find((x) => x.id === flagId);
  if (f) f.status = status;
  return s;
}

/** Применить категорию от LLM к тексту ответа или причине увольнения. */
export function applyLlm(
  input: DemoState,
  target: { responseId?: string; fireId?: string },
  category: Category,
): DemoState {
  const s = clone(input);
  const cat: Categorized = { category, source: "llm" };
  if (target.responseId) {
    const r = s.responses.find((x) => x.id === target.responseId);
    if (r?.answer.kind === "stay" && r.answer.commentCat?.category === "Другое") r.answer.commentCat = cat;
    if (r?.answer.kind === "exit" && r.answer.detailsCat?.category === "Другое") r.answer.detailsCat = cat;
  }
  if (target.fireId) {
    const t = s.tasks.find((x): x is FireTask => x.type === "fire" && x.id === target.fireId);
    if (t && t.reasonCat.category === "Другое") t.reasonCat = cat;
  }
  return s;
}

// ---------- причины ----------

/** Главная причина ответа: выбор человека важнее разбора текста. */
export function responseReason(r: SurveyResponse): Categorized | null {
  const a = r.answer;
  if (a.kind === "exit") return { category: a.mainReason, source: "person" };
  if (a.blockers.length > 0) return { category: a.blockers[0], source: "person" };
  return a.commentCat;
}

/** Причина ухода человека: ответ на опрос «ухожу», иначе текст задачи увольнения. */
export function exitReason(s: DemoState, fire: FireTask): Categorized {
  const r = s.responses.find((x) => x.hireTaskId === fire.hireTaskId && x.answer.kind === "exit");
  if (r && r.answer.kind === "exit") return { category: r.answer.mainReason, source: "person" };
  return fire.reasonCat;
}

export function isActiveFlag(f: Flag): boolean {
  return f.status === "new" || f.status === "contacted";
}
