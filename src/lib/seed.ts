// Стартовые данные. Все люди вымышленные.
// Год истории не записан руками, а «проигрывается» через те же функции, что и в интерфейсе
// (приём, перемотка, ответы, увольнение), поэтому данные всегда согласованы с логикой.

import { addDays, diffDays } from "./dates";
import {
  AnswerInput,
  POINTS,
  advanceDays,
  createFire,
  createHire,
  markSent,
  submitResponse,
} from "./logic";
import { Category, DemoState, StayIf, WouldStay } from "./types";

export const STATE_VERSION = 2;

// ---------- детерминированный генератор ----------

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const MALE_SURNAMES = ["Орлов", "Зайцев", "Морозов", "Волков", "Белов", "Тихонов", "Крылов", "Медведев", "Гусев", "Ершов", "Рябов", "Кузьмин", "Сорокин", "Дроздов", "Комаров", "Блинов", "Шубин", "Ларин", "Носов", "Пахомов", "Титов", "Лапин", "Мухин", "Жуков", "Фролов"];
export const MALE_NAMES = ["Артём", "Илья", "Максим", "Кирилл", "Денис", "Никита", "Роман", "Егор", "Павел", "Глеб", "Антон", "Олег", "Степан"];
export const FEMALE_SURNAMES = ["Орлова", "Зайцева", "Морозова", "Волкова", "Белова", "Тихонова", "Крылова", "Медведева", "Гусева", "Ершова", "Рябова", "Кузьмина", "Сорокина", "Дроздова", "Комарова", "Блинова", "Шубина", "Ларина", "Носова", "Пахомова", "Титова", "Лапина", "Мухина", "Жукова", "Фролова"];
export const FEMALE_NAMES = ["Анна", "Дарья", "Полина", "Екатерина", "Виктория", "Алина", "Софья", "Ксения", "Юлия", "Вера", "Мария", "Ольга", "Елена"];

export const POSITIONS: Record<string, string[]> = {
  "Склад": ["Кладовщик", "Грузчик", "Комплектовщик"],
  "Магазин": ["Продавец-консультант", "Кассир", "Продавец-консультант"],
  "Отдел продаж": ["Менеджер по продажам"],
  "Офис": ["Бухгалтер", "Специалист по закупкам", "Контент-менеджер"],
};

// ---------- сценарии людей ----------

interface StayScript {
  day: number;
  answer?: Omit<Extract<AnswerInput, { kind: "stay" }>, "kind">;
  /** true: HR отправил, ответа нет. false/undefined без answer: подзадача осталась неотправленной. */
  sent?: boolean;
}

interface ExitScript {
  mainReason: Category;
  details: string;
  wouldStay: WouldStay;
  stayIf: StayIf | null;
  contactOk: boolean;
}

interface Person {
  name?: string; // если не задано, берётся из списков
  female?: boolean;
  point: string;
  position?: string;
  startAgo: number; // сколько дней назад вышел
  stay: StayScript[];
  leave?: { afterDays: number; reason: string; exit?: ExitScript };
}

const good = (comment = "", contactOk = true) => ({ mood: "good" as const, blockers: [] as Category[], comment, contactOk });
const hard = (blockers: Category[], comment = "", contactOk = false) => ({ mood: "hard" as const, blockers, comment, contactOk });
const leaving = (blockers: Category[], comment = "", contactOk = true) => ({ mood: "leaving" as const, blockers, comment, contactOk });

/** Новые сотрудники, которые сейчас в первых 90 днях. Заданы руками под проверки. */
const CURRENT: Person[] = [
  {
    name: "Ершов Никита", point: "Магазин №3", position: "Продавец-консультант", startAgo: 35,
    stay: [
      { day: 7, answer: good() },
      { day: 14, answer: hard(["Руководитель"], "", false) },
      { day: 30, answer: leaving(["Руководитель", "График"], "Старший продавец кричит при покупателях, смены ставят в последний момент.") },
    ],
  },
  {
    name: "Медведева Алина", female: true, point: "Склад", position: "Комплектовщик", startAgo: 22,
    stay: [
      { day: 7, answer: good() },
      { day: 14, answer: hard(["Нагрузка", "График"], "Много ночных смен подряд, не успеваю восстановиться.", true) },
    ],
  },
  { name: "Ларина Ксения", female: true, point: "Магазин №1", position: "Кассир", startAgo: 10, stay: [{ day: 7, answer: good("Всё понятно, спасибо") }] },
  { name: "Титов Глеб", point: "Отдел продаж", position: "Менеджер по продажам", startAgo: 16, stay: [{ day: 7, sent: true }, { day: 14 }] },
  { name: "Носова Вера", female: true, point: "Офис", position: "Специалист по закупкам", startAgo: 7, stay: [{ day: 7 }] },
  { name: "Блинов Степан", point: "Магазин №2", position: "Кассир", startAgo: 3, stay: [] },
  {
    name: "Шубина Полина", female: true, point: "Магазин №4", position: "Продавец-консультант", startAgo: 50,
    stay: [
      { day: 7, answer: good() },
      { day: 14, answer: hard(["Дорога"], "", false) },
      { day: 30, answer: hard(["Дорога"], "Ехать полтора часа с пересадкой.", false) },
    ],
  },
  {
    name: "Мухин Олег", point: "Магазин №3", position: "Кассир", startAgo: 26,
    stay: [{ day: 7, answer: hard(["График"], "Ставят по 12 часов без перерыва.", false) }, { day: 14, sent: true }],
  },
  {
    name: "Пахомов Роман", point: "Склад", position: "Грузчик", startAgo: 70,
    stay: [{ day: 7, answer: good() }, { day: 14, answer: good() }, { day: 30, answer: good() }, { day: 60, answer: good("Спасибо наставнику, всё объяснил.") }],
  },
];

/** Ранние уходы (до 90 дней): причина в задаче + иногда ответ на опрос «ухожу». */
const EARLY_LEAVES: Record<string, { reason: string; exit?: ExitScript; stayHint?: Category }[]> = {
  "Магазин №3": [
    { reason: "По собственному желанию", exit: { mainReason: "Руководитель", details: "Старший смены унижает при всех.", wouldStay: "maybe", stayIf: "Другой руководитель", contactOk: true }, stayHint: "Руководитель" },
    { reason: "Не сработался со старшим продавцом, постоянные придирки", stayHint: "Руководитель" },
    { reason: "По собственному желанию", exit: { mainReason: "График", details: "Каждую неделю новый график, нельзя ничего планировать.", wouldStay: "yes", stayIf: "Другой график", contactOk: false }, stayHint: "График" },
    { reason: "Постоянно меняют график, ставят на выходные", stayHint: "График" },
    { reason: "По собственному желанию", stayHint: "Руководитель" },
  ],
  "Склад": [
    { reason: "Тяжёлая физическая работа, не ожидал такой нагрузки" },
    { reason: "Расторжение по ст. 80 ТК", exit: { mainReason: "Деньги", details: "", wouldStay: "no", stayIf: null, contactOk: false } },
    { reason: "По собственному желанию" },
  ],
  "Магазин №1": [
    { reason: "Далеко ездить, переехал в другой район" },
    { reason: "По собственному желанию", exit: { mainReason: "Личные обстоятельства", details: "Семейные обстоятельства.", wouldStay: "no", stayIf: null, contactOk: false } },
  ],
  "Магазин №2": [
    { reason: "Нашёл, где платят больше" },
    { reason: "По собственному желанию", exit: { mainReason: "Обучение и ввод в работу", details: "Никто ничего не объяснил, в первый день поставили на кассу одну.", wouldStay: "maybe", stayIf: "Другое", contactOk: true } },
  ],
  "Магазин №4": [{ reason: "Предложили работу по специальности" }],
  "Отдел продаж": [
    { reason: "По собственному желанию", exit: { mainReason: "Деньги", details: "Доход ниже, чем обещали на собеседовании.", wouldStay: "maybe", stayIf: "Другая должность", contactOk: true } },
    { reason: "Слишком большой план звонков, не успевал" },
  ],
  "Офис": [{ reason: "Не сложились отношения в коллективе" }],
};

/** Сколько всего новых сотрудников за год на точке (без CURRENT). */
const HISTORICAL_COUNT: Record<string, number> = {
  "Склад": 8, "Магазин №1": 6, "Магазин №2": 6, "Магазин №3": 7, "Магазин №4": 5, "Отдел продаж": 5, "Офис": 4,
};

const LATE_LEAVE_REASONS = ["Переезд в другой город", "По собственному желанию", "Ушёл на повышение в другую компанию"];

const COMMENTS: Partial<Record<Category, string[]>> = {
  "График": ["Неудобные смены", "Хотелось бы больше выходных"],
  "Нагрузка": ["Очень устаю к концу смены", "Много работы, не успеваю"],
  "Руководитель": ["Начальник придирается по мелочам", "Старший не объясняет, только ругает"],
  "Деньги": ["Зарплата ниже, чем ожидал"],
  "Обучение и ввод в работу": ["Нет наставника, учусь сам"],
  "Дорога": ["Далеко добираться"],
};

function buildPeople(): Person[] {
  const r = rng(20251111);
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const people: Person[] = [...CURRENT];
  let lateLeft = 0;

  for (const point of POINTS) {
    const total = HISTORICAL_COUNT[point.name];
    const early = EARLY_LEAVES[point.name] ?? [];
    for (let i = 0; i < total; i++) {
      const startAgo = 100 + Math.floor(r() * 260);
      const leaveScript = early[i];
      const isM3 = point.name === "Магазин №3";
      const p: Person = {
        female: r() < 0.45,
        point: point.name,
        position: pick(POSITIONS[point.dept]),
        startAgo,
        stay: [],
      };
      const leaveAfter = leaveScript ? 12 + Math.floor(r() * 70) : null;

      // Ответы на опросы «пока работаю» до ухода.
      for (const day of [7, 14, 30, 60]) {
        if (leaveAfter !== null && day >= leaveAfter - 3) break;
        if (r() > 0.55) continue;
        const hint = leaveScript?.stayHint;
        const roll = r();
        let blockerPool: Category[] = isM3 ? ["Руководитель", "График", "Руководитель"] : ["Нагрузка", "Деньги", "График", "Обучение и ввод в работу", "Дорога"];
        if (hint) blockerPool = [hint];
        const consent = r() < 0.5;
        if (hint || (isM3 && roll < 0.5) || roll < 0.22) {
          const cat = pick(blockerPool);
          const comment = r() < 0.5 ? pick(COMMENTS[cat] ?? [""]) : "";
          p.stay.push({ day, answer: hard([cat], comment, consent) });
        } else {
          p.stay.push({ day, answer: good("", consent) });
        }
      }

      if (leaveScript && leaveAfter !== null) {
        p.leave = { afterDays: leaveAfter, reason: leaveScript.reason, exit: leaveScript.exit };
      } else if (lateLeft < LATE_LEAVE_REASONS.length && r() < 0.15 && startAgo > 200) {
        p.leave = { afterDays: 120 + Math.floor(r() * 60), reason: LATE_LEAVE_REASONS[lateLeft++] };
      }
      people.push(p);
    }
  }

  // Имена: уникальные сочетания фамилии и имени.
  let m = 0;
  let f = 0;
  const used = new Set(people.filter((p) => p.name).map((p) => p.name));
  for (const p of people) {
    if (p.name) continue;
    let name = "";
    do {
      name = p.female
        ? `${FEMALE_SURNAMES[f % FEMALE_SURNAMES.length]} ${FEMALE_NAMES[(f * 7 + 3) % FEMALE_NAMES.length]}`
        : `${MALE_SURNAMES[m % MALE_SURNAMES.length]} ${MALE_NAMES[(m * 5 + 1) % MALE_NAMES.length]}`;
      if (p.female) f++;
      else m++;
    } while (used.has(name));
    used.add(name);
    p.name = name;
  }
  return people;
}

// ---------- проигрывание истории ----------

interface Ev {
  date: string;
  order: number;
  run: (s: DemoState) => DemoState;
}

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
  э: "e", ю: "yu", я: "ya",
};
export const latin = (s: string) => [...s.toLowerCase()].map((ch) => TRANSLIT[ch] ?? ch).join("");

function contactFor(name: string, i: number): string {
  if (i % 2 === 0) return `+7 9${String(10 + (i % 80)).padStart(2, "0")} 555-${String(1000 + i * 37).slice(-4)}`;
  const [surname, first] = name.split(" ");
  return `@${latin(first)}_${latin(surname).slice(0, 3)}${i}`;
}

export function buildSeed(today: string): DemoState {
  const people = buildPeople();
  const start = addDays(today, -400);
  let s: DemoState = { version: STATE_VERSION, today: start, tasks: [], subtasks: [], responses: [], flags: [], seq: 0 };

  const hireIds = new Map<number, string>();
  const events: Ev[] = [];
  const currentIdx = new Set(people.map((_, i) => i).filter((i) => i < CURRENT.length));

  people.forEach((p, i) => {
    const startDate = addDays(today, -p.startAgo);
    const createdOn = addDays(startDate, -5);
    events.push({
      date: createdOn,
      order: 0,
      run: (st) => {
        const next = createHire(st, { employee: p.name!, position: p.position ?? "Сотрудник", point: p.point, startDate, contact: contactFor(p.name!, i) });
        hireIds.set(i, next.tasks[next.tasks.length - 1].id);
        return next;
      },
    });

    for (const sc of p.stay) {
      if (!sc.answer) continue;
      events.push({
        date: addDays(startDate, sc.day + 1),
        order: 1,
        run: (st) => {
          const sub = st.subtasks.find((x) => x.hireTaskId === hireIds.get(i) && x.kind === "stay" && x.day === sc.day);
          if (!sub) return st;
          const sent = markSent(st, sub.id);
          return submitResponse(sent, sub.token, { kind: "stay", ...sc.answer! }).state;
        },
      });
    }

    if (p.leave) {
      const lastDay = addDays(startDate, p.leave.afterDays);
      const fireDate = addDays(lastDay, -3);
      events.push({
        date: fireDate,
        order: 2,
        run: (st) => createFire(st, { hireTaskId: hireIds.get(i)!, lastDay, reason: p.leave!.reason }).state,
      });
      const ex = p.leave.exit;
      if (ex) {
        events.push({
          date: addDays(fireDate, 1),
          order: 3,
          run: (st) => {
            const sub = st.subtasks.find((x) => x.hireTaskId === hireIds.get(i) && x.kind === "exit");
            if (!sub) return st;
            const sent = markSent(st, sub.id);
            return submitResponse(sent, sub.token, { kind: "exit", ...ex }).state;
          },
        });
      }
    }
  });

  // Время идёт шагами не больше недели, как если бы HR нажимал «+7 дней».
  const stepTo = (st: DemoState, date: string): DemoState => {
    while (st.today < date) st = advanceDays(st, Math.min(7, diffDays(st.today, date)));
    return st;
  };
  events.sort((a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1));
  for (const ev of events) {
    s = stepTo(s, ev.date);
    s = ev.run(s);
  }
  s = stepTo(s, today);

  // Довести статусы до правдоподобных.
  const currentHireIds = new Set([...currentIdx].map((i) => hireIds.get(i)));
  for (const sub of s.subtasks) {
    if (sub.status !== "pending") continue;
    if (!currentHireIds.has(sub.hireTaskId)) {
      // история: HR отправил, человек не ответил
      sub.status = "sent";
      sub.sentAt = sub.dueDate;
      continue;
    }
    const idx = [...hireIds.entries()].find(([, id]) => id === sub.hireTaskId)![0];
    const sc = people[idx].stay.find((x) => x.day === sub.day);
    if (sc?.sent) {
      sub.status = "sent";
      sub.sentAt = sub.dueDate;
    }
  }
  for (const fl of s.flags) {
    if (currentHireIds.has(fl.hireTaskId)) continue;
    const fired = s.tasks.some((t) => t.type === "fire" && t.hireTaskId === fl.hireTaskId);
    fl.status = fired ? "left" : "resolved";
  }
  for (const t of s.tasks) {
    if (t.type === "fire") t.status = "done";
    if (t.type === "hire" && t.startDate < addDays(today, -14)) t.status = "done";
  }
  return s;
}

// ---------- случайные данные для формы приёма ----------

/** Новый вымышленный сотрудник для формы «Создать задачу приёма»: каждый раз другой. */
export function randomHire(s: DemoState): { employee: string; position: string; point: string; contact: string } {
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  const used = new Set(s.tasks.map((t) => t.employee));
  let employee = "";
  for (let i = 0; i < 100; i++) {
    const female = Math.random() < 0.5;
    employee = female ? `${pick(FEMALE_SURNAMES)} ${pick(FEMALE_NAMES)}` : `${pick(MALE_SURNAMES)} ${pick(MALE_NAMES)}`;
    if (!used.has(employee)) break;
  }
  const point = pick(POINTS);
  const position = pick(POSITIONS[point.dept]);
  const [surname, first] = employee.split(" ");
  const contact =
    Math.random() < 0.5
      ? `@${latin(first)}_${latin(surname)}`
      : `+7 9${Math.floor(10 + Math.random() * 89)} ${Math.floor(100 + Math.random() * 899)}-${Math.floor(1000 + Math.random() * 8999)}`;
  return { employee, position, point: point.name, contact };
}
