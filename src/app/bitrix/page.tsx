"use client";

import { FormEvent, useMemo, useState } from "react";
import { useDemo } from "@/lib/store";
import { fmtShort } from "@/lib/dates";
import { POINTS, PROBATION_DAYS, canFire, hires, tenureDay } from "@/lib/logic";
import { randomHire } from "@/lib/seed";
import { CategoryTag } from "@/components/CategoryTag";
import { Task } from "@/lib/types";

const POSITIONS = ["Кладовщик", "Грузчик", "Комплектовщик", "Продавец-консультант", "Кассир", "Менеджер по продажам", "Бухгалтер", "Специалист по закупкам", "Контент-менеджер"];

export default function BitrixPage() {
  const { state, createHire, createFire } = useDemo();
  const [form, setForm] = useState<"hire" | "fire" | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [filter, setFilter] = useState<"all" | "hire" | "fire">("all");
  const [notice, setNotice] = useState("");

  const open = (f: "hire" | "fire") => {
    setNotice("");
    setFormKey((k) => k + 1); // каждый раз новая форма с новыми данными
    setForm(form === f ? null : f);
  };

  const tasks = useMemo(() => {
    const list = state.tasks.filter((t) => filter === "all" || t.type === filter);
    return [...list].reverse(); // новые сверху
  }, [state.tasks, filter]);

  return (
    <>
      <h1>Битрикс24</h1>
      <p className="lead">Имитация: задачи приёма и увольнения, как HR создаёт их сейчас.</p>

      <div className="row" style={{ marginBottom: 16 }}>
        <button className="btn primary" onClick={() => open("hire")}>+ Задача приёма</button>
        <button className="btn" onClick={() => open("fire")}>+ Задача увольнения</button>
      </div>

      {notice && <div className="card hint" style={{ marginBottom: 16 }}>{notice}</div>}

      {form === "hire" && (
        <HireForm
          key={formKey}
          onCancel={() => setForm(null)}
          onSubmit={(f) => {
            createHire(f);
            setForm(null);
            setNotice(`${f.employee}: в «Задачах HR» запланированы опросы на 7, 14, 30 и 60 день.`);
          }}
        />
      )}
      {form === "fire" && (
        <FireForm
          key={formKey}
          onCancel={() => setForm(null)}
          onSubmit={(f, name) => {
            createFire(f);
            setForm(null);
            setNotice(`${name}: в «Задачах HR» появился опрос при уходе.`);
          }}
        />
      )}

      <div className="row" style={{ margin: "20px 0 10px" }}>
        {(["all", "hire", "fire"] as const).map((f) => (
          <button key={f} className={`btn small ${filter === f ? "primary" : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "Все" : f === "hire" ? "Приём" : "Увольнение"}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Задача</th>
              <th>Сотрудник</th>
              <th>Должность, точка</th>
              <th>Дата</th>
              <th>Причина ухода</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <TaskRow key={t.id} t={t} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TaskRow({ t }: { t: Task }) {
  return (
    <tr>
      <td>
        <span className={`badge ${t.type === "hire" ? "blue" : "red"}`}>{t.type === "hire" ? "Приём" : "Увольнение"}</span>
      </td>
      <td style={{ whiteSpace: "nowrap" }}><b>{t.employee}</b></td>
      <td>{t.position}, {t.point}</td>
      <td style={{ whiteSpace: "nowrap" }}>{t.type === "hire" ? <>выход {fmtShort(t.startDate)}</> : <>последний день {fmtShort(t.lastDay)}</>}</td>
      <td className="small">
        {t.type === "fire" ? (
          <>
            «{t.reason}» <CategoryTag c={t.reasonCat} />
          </>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
    </tr>
  );
}

function HireForm({ onSubmit, onCancel }: { onSubmit: (f: { employee: string; position: string; point: string; startDate: string; contact: string }) => void; onCancel: () => void }) {
  const { state } = useDemo();
  const [init] = useState(() => randomHire(state));
  const [employee, setEmployee] = useState(init.employee);
  const [position, setPosition] = useState(init.position);
  const [point, setPoint] = useState(init.point);
  const [startDate, setStartDate] = useState(state.today);
  const [contact, setContact] = useState(init.contact);
  const [err, setErr] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (employee.trim().split(/\s+/).length < 2) return setErr("Укажите фамилию и имя.");
    if (!startDate || startDate < state.today) return setErr("Дата выхода не может быть в прошлом.");
    onSubmit({ employee: employee.trim(), position, point, startDate, contact: contact.trim() });
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <div className="form">
        <label className="field">Сотрудник<input type="text" value={employee} onChange={(e) => setEmployee(e.target.value)} /></label>
        <label className="field">Должность
          <select value={position} onChange={(e) => setPosition(e.target.value)}>{POSITIONS.map((p) => <option key={p}>{p}</option>)}</select>
        </label>
        <label className="field">Точка
          <select value={point} onChange={(e) => setPoint(e.target.value)}>{POINTS.map((p) => <option key={p.name}>{p.name}</option>)}</select>
        </label>
        <label className="field">Дата выхода<input type="date" min={state.today} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
        <label className="field">Телефон или Telegram<input type="text" value={contact} onChange={(e) => setContact(e.target.value)} /></label>
      </div>
      {err && <div className="err">{err}</div>}
      <div className="row">
        <button className="btn primary" type="submit">Создать</button>
        <button className="btn" type="button" onClick={onCancel}>Отмена</button>
      </div>
    </form>
  );
}

function FireForm({ onSubmit, onCancel }: { onSubmit: (f: { hireTaskId: string; lastDay: string; reason: string }, name: string) => void; onCancel: () => void }) {
  const { state } = useDemo();
  // Только те, кто работает меньше 90 дней: демо про ранние уходы.
  const active = hires(state)
    .filter((h) => canFire(state, h))
    .sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  const [hireTaskId, setHire] = useState(active[0]?.id ?? "");
  const [lastDay, setLastDay] = useState(state.today);
  const [reason, setReason] = useState("По собственному желанию");
  const [err, setErr] = useState("");
  const hire = active.find((h) => h.id === hireTaskId);

  if (active.length === 0) {
    return (
      <div className="card row">
        <span className="muted">Нет сотрудников со стажем меньше {PROBATION_DAYS} дней.</span>
        <button className="btn" onClick={onCancel}>Закрыть</button>
      </div>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!hire) return;
    if (!lastDay || lastDay < state.today) return setErr("Последний день не может быть в прошлом.");
    if (tenureDay(hire, lastDay) >= PROBATION_DAYS) return setErr(`Последний день позже ${PROBATION_DAYS}-го дня стажа: это уже не ранний уход.`);
    onSubmit({ hireTaskId, lastDay, reason }, hire.employee);
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <div className="form">
        <label className="field">Сотрудник (стаж до {PROBATION_DAYS} дней)
          <select value={hireTaskId} onChange={(e) => setHire(e.target.value)}>
            {active.map((h) => (
              <option key={h.id} value={h.id}>
                {h.employee}, {h.point}, день {tenureDay(h, state.today)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">Последний день<input type="date" min={state.today} value={lastDay} onChange={(e) => setLastDay(e.target.value)} /></label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>Причина
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
      </div>
      {err && <div className="err">{err}</div>}
      <div className="row">
        <button className="btn primary" type="submit">Создать</button>
        <button className="btn" type="button" onClick={onCancel}>Отмена</button>
      </div>
    </form>
  );
}
