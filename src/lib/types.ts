// Модель данных демо. Всё хранится в одном объекте DemoState (localStorage).

export const CATEGORIES = [
  "График",
  "Нагрузка",
  "Руководитель",
  "Коллектив",
  "Деньги",
  "Обучение и ввод в работу",
  "Дорога",
  "Личные обстоятельства",
  "Другое",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Категория для формальных причин («по собственному желанию», пусто). */
export const NOT_SPECIFIED = "Причина не указана" as const;
export type ReasonCategory = Category | typeof NOT_SPECIFIED;

/** Кто поставил категорию. */
export type CategorySource = "person" | "dictionary" | "llm" | "none";

export interface Categorized {
  category: ReasonCategory;
  source: CategorySource;
}

export type Dept = "Склад" | "Магазин" | "Отдел продаж" | "Офис";

export interface Point {
  name: string;
  dept: Dept;
  manager: string;
}

/** Задача Битрикс24 (имитация). */
export interface HireTask {
  id: string;
  type: "hire";
  title: string;
  createdAt: string; // ISO-дата
  status: "open" | "done";
  employee: string; // «Иванов Иван»
  position: string;
  dept: Dept;
  point: string;
  manager: string;
  startDate: string;
  contact: string;
}

export interface FireTask {
  id: string;
  type: "fire";
  title: string;
  createdAt: string;
  status: "open" | "done";
  employee: string;
  position: string;
  dept: Dept;
  point: string;
  manager: string;
  hireTaskId: string;
  lastDay: string;
  reason: string; // свободный текст
  reasonCat: Categorized; // разбор текста причины
}

export type Task = HireTask | FireTask;

export type SurveyKind = "stay" | "exit";

/** Подзадача HR «Отправить опрос». */
export interface Subtask {
  id: string;
  hireTaskId: string;
  kind: SurveyKind;
  day: number | null; // 7/14/30/60 для stay, null для exit
  dueDate: string;
  createdAt: string;
  status: "pending" | "sent" | "answered" | "cancelled";
  sentAt?: string;
  token: string; // личная ссылка /s/{token}
}

export type Mood = "good" | "hard" | "leaving";
export type WouldStay = "yes" | "maybe" | "no";
export const STAY_IF = [
  "Другой график",
  "Другая точка",
  "Другой руководитель",
  "Другая должность",
  "Другое",
] as const;
export type StayIf = (typeof STAY_IF)[number];

export interface StayAnswer {
  kind: "stay";
  mood: Mood;
  blockers: Category[]; // выбрал сам; пусто = «Ничего не мешает»
  comment: string;
  commentCat: Categorized | null; // разбор комментария
  contactOk: boolean;
}

export interface ExitAnswer {
  kind: "exit";
  mainReason: Category; // выбрал сам
  details: string;
  detailsCat: Categorized | null;
  wouldStay: WouldStay;
  stayIf: StayIf | null;
  contactOk: boolean;
}

export interface SurveyResponse {
  id: string;
  subtaskId: string;
  hireTaskId: string;
  date: string;
  tenureDay: number;
  answer: StayAnswer | ExitAnswer;
}

export type FlagType = "leaving" | "hard" | "retain";
export type FlagStatus = "new" | "contacted" | "resolved" | "left";

export interface Flag {
  id: string;
  type: FlagType;
  responseId: string;
  hireTaskId: string;
  createdAt: string;
  status: FlagStatus;
}

export interface DemoState {
  version: number;
  today: string; // дата в демо
  tasks: Task[];
  subtasks: Subtask[];
  responses: SurveyResponse[];
  flags: Flag[];
  seq: number; // счётчик id
}
