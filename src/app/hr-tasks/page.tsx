"use client";

import { Fragment, useEffect, useState } from "react";
import { useDemo } from "@/lib/store";
import { addDays, diffDays, fmtShort } from "@/lib/dates";
import { hireById, messageText, SubtaskState, subtaskState } from "@/lib/logic";
import { Subtask } from "@/lib/types";

const STATE_META: Record<SubtaskState, { label: string; cls: string; order: number }> = {
  overdue: { label: "Просрочено", cls: "red", order: 0 },
  todo: { label: "Отправить сегодня", cls: "blue", order: 1 },
  planned: { label: "Запланировано", cls: "", order: 2 },
  sent: { label: "Ждём ответа", cls: "yellow", order: 3 },
  answered: { label: "Ответил", cls: "green", order: 4 },
  cancelled: { label: "Отменено", cls: "", order: 5 },
};

type Filter = "all" | "send" | "planned" | "sent" | "answered";
const FILTERS: { id: Filter; label: string; match: (s: SubtaskState) => boolean }[] = [
  { id: "all", label: "Все", match: (s) => s !== "cancelled" },
  { id: "send", label: "Отправить", match: (s) => s === "todo" || s === "overdue" },
  { id: "planned", label: "Запланировано", match: (s) => s === "planned" },
  { id: "sent", label: "Ждём ответа", match: (s) => s === "sent" },
  { id: "answered", label: "Ответили", match: (s) => s === "answered" },
];

export default function HrTasksPage() {
  const { state } = useDemo();
  const [filter, setFilter] = useState<Filter>("all");
  const [history, setHistory] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  // По умолчанию: всё будущее и последние 30 дней. История — по кнопке.
  const from = addDays(state.today, -30);
  const rows = state.subtasks
    .map((sub) => ({ sub, st: subtaskState(sub, state.today) }))
    .filter(({ sub }) => history || sub.dueDate >= from);

  const count = (f: (typeof FILTERS)[number]) => rows.filter((r) => f.match(r.st)).length;
  const active = FILTERS.find((f) => f.id === filter)!;
  const shown = rows
    .filter((r) => active.match(r.st))
    .sort((a, b) => {
      const o = STATE_META[a.st].order - STATE_META[b.st].order;
      if (o !== 0) return o;
      const asc = a.st === "planned" || a.st === "todo" || a.st === "overdue";
      return (a.sub.dueDate < b.sub.dueDate ? -1 : 1) * (asc ? 1 : -1);
    });

  return (
    <>
      <h1>Задачи HR</h1>
      <p className="lead">Опросы создаются сами при приёме и увольнении. В день срока скопируйте текст, отправьте сотруднику и отметьте «Отправлено».</p>

      <div className="row" style={{ marginBottom: 10 }}>
        {FILTERS.map((f) => (
          <button key={f.id} className={`btn small ${filter === f.id ? "primary" : ""}`} onClick={() => setFilter(f.id)}>
            {f.label} <span style={{ opacity: 0.7 }}>{count(f)}</span>
          </button>
        ))}
        <label className="small muted" style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={history} onChange={(e) => setHistory(e.target.checked)} />
          показать старше 30 дней
        </label>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Срок</th>
              <th>Сотрудник</th>
              <th>Опрос</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map(({ sub, st }) => (
              <Row key={sub.id} sub={sub} st={st} origin={origin} />
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">Пусто.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Row({ sub, st, origin }: { sub: Subtask; st: SubtaskState; origin: string }) {
  const { state, markSent } = useDemo();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const hire = hireById(state, sub.hireTaskId);
  if (!hire) return null;
  const meta = STATE_META[st];
  const text = messageText(sub, hire, `${origin}/s/${sub.token}`);
  const canSend = st === "todo" || st === "overdue";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setOpen(true); // буфер недоступен: показываем текст, чтобы скопировать вручную
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Fragment>
      <tr className={st === "overdue" ? "hot" : ""}>
        <td style={{ whiteSpace: "nowrap" }}>{fmtShort(sub.dueDate)}</td>
        <td>
          <b>{hire.employee}</b>
          <div className="small muted">{hire.point} · {hire.contact}</div>
        </td>
        <td>{sub.kind === "stay" ? `${sub.day} день` : <span className="badge red">При уходе</span>}</td>
        <td>
          <span className={`badge ${meta.cls}`}>
            {meta.label}
            {st === "overdue" && ` ${diffDays(sub.dueDate, state.today)} дн.`}
          </span>
        </td>
        <td>
          <div className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
            {canSend && (
              <>
                <button className="btn small" onClick={copy}>{copied ? "Скопировано ✓" : "Скопировать текст"}</button>
                <button className="btn small primary" onClick={() => markSent(sub.id)}>Отправлено</button>
              </>
            )}
            {(canSend || st === "sent") && (
              <>
                <button className="btn small" onClick={() => setOpen(!open)} title="Показать текст сообщения">{open ? "▴" : "▾"}</button>
                <a className="btn small" href={`/s/${sub.token}`} target="_blank" rel="noreferrer" title="Открыть ссылку опроса">↗</a>
              </>
            )}
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td />
          <td colSpan={4}>
            <div className="msg">{text}</div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
