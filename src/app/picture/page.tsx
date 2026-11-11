"use client";

import { Fragment, useState } from "react";
import { useDemo } from "@/lib/store";
import { fmtDate } from "@/lib/dates";
import { HOT_FACTOR, buildPicture, isHot, ReasonCount, Row } from "@/lib/picture";
import { ReasonCategory } from "@/lib/types";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Причины, которые не говорят, что чинить: в «главную проблему» не попадают. */
const VAGUE: ReasonCategory[] = ["Причина не указана", "Другое"];

/**
 * Главная проблема: причины, которые есть и среди причин ухода, и среди жалоб в опросах.
 * Сортировка по общему числу людей.
 */
function mainProblems(r: Row): ReasonCategory[] {
  const stay = new Map(r.stayIssues.map((x) => [x.category, x.count]));
  return r.exitReasons
    .filter((x) => stay.has(x.category) && !VAGUE.includes(x.category))
    .map((x) => ({ c: x.category, n: x.count + (stay.get(x.category) ?? 0) }))
    .sort((a, b) => b.n - a.n)
    .map((x) => x.c);
}

/**
 * Ещё сигналы: всё остальное, что называли ушедшие или в опросах, кроме главной проблемы.
 * «Причина не указана» сюда не попадает: это не причина, а пробел в данных; она видна в подробностях и на вкладке «Причины ухода».
 */
function otherSignals(r: Row, main: ReasonCategory[]): ReasonCategory[] {
  const sum = new Map<ReasonCategory, number>();
  for (const x of [...r.exitReasons, ...r.stayIssues]) sum.set(x.category, (sum.get(x.category) ?? 0) + x.count);
  return [...sum.entries()]
    .filter(([c]) => !main.includes(c) && c !== "Причина не указана")
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c);
}

function Rate({ row, hot }: { row: Row; hot: boolean }) {
  return (
    <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
      <span style={{ fontVariantNumeric: "tabular-nums", minWidth: 16, textAlign: "right" }}>{row.earlyLeft}</span>
      <div className={`bar ${hot ? "red" : ""}`} style={{ width: 70 }}>
        <span style={{ width: pct(row.rate) }} />
      </div>
      <span className="muted" style={{ fontVariantNumeric: "tabular-nums" }}>{pct(row.rate)}</span>
    </div>
  );
}

/** Список причин для раскрытой строки: «Причина — N». */
function ReasonList({ title, note, list }: { title: string; note: string; list: ReasonCount[] }) {
  return (
    <div className="detail-col">
      <div className="detail-title">{title}</div>
      <div className="small muted" style={{ marginBottom: 6 }}>{note}</div>
      {list.length === 0 ? (
        <div className="muted">—</div>
      ) : (
        list.map((r) => (
          <div key={r.category} className="detail-row">
            <span>{r.category}</span>
            <span className="muted">— {r.count}</span>
          </div>
        ))
      )}
    </div>
  );
}

type Tab = "points" | "depts" | "managers" | "reasons";
const TABS: { id: Tab; label: string }[] = [
  { id: "points", label: "По точкам" },
  { id: "depts", label: "По отделам" },
  { id: "managers", label: "По руководителям" },
  { id: "reasons", label: "Причины ухода" },
];

/** Компактная таблица: точки, отделы или руководители. Клик по строке раскрывает все причины. */
function RowsTable({ rows, first, total }: { rows: (Row & { sub?: string })[]; first: string; total?: Row }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{first}</th>
            <th className="num">Пришло</th>
            <th>Ушли до 90 дней</th>
            <th>Главная проблема</th>
            <th>Ещё сигналы</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const hot = total ? isHot(r, total) : false;
            const main = mainProblems(r);
            const other = otherSignals(r, main);
            const empty = main.length === 0 && other.length === 0;
            const isOpen = open === r.key;
            return (
              <Fragment key={r.key}>
                <tr className={`clickable ${hot ? "hot" : ""}`} onClick={() => setOpen(isOpen ? null : r.key)}>
                  <td>
                    <b>{r.key}</b>
                    {r.sub && <div className="small muted">{r.sub}</div>}
                  </td>
                  <td className="num">{r.hired}</td>
                  <td><Rate row={r} hot={hot} /></td>
                  <td>
                    {main.length ? <b>{main.join(", ")}</b> : <span className="muted">{empty ? "—" : "нет совпадений"}</span>}
                  </td>
                  <td>{other.length ? other.join(", ") : <span className="muted">—</span>}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="row-toggle"
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? "Скрыть" : "Показать"} причины: ${r.key}`}
                    >
                      {isOpen ? "▴" : "▾"}
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="detail">
                    <td colSpan={6}>
                      <div className="detail-grid">
                        <ReasonList
                          title="Почему ушли"
                          note={`Ушли до 90 дней: ${r.earlyLeft} чел. У каждого одна причина.`}
                          list={r.exitReasons}
                        />
                        <ReasonList
                          title="На что жаловались в опросах"
                          note={`Ответили на опросы: ${r.answered} чел., из них жаловались: ${r.complained}. Можно было выбрать несколько причин.`}
                          list={r.stayIssues}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function PicturePage() {
  const { state } = useDemo();
  const [tab, setTab] = useState<Tab>("points");
  const p = buildPicture(state);
  const managers = [...p.byManager].sort((a, b) => b.rate - a.rate);
  const maxExit = Math.max(1, ...p.total.exitReasons.map((r) => r.count));

  return (
    <>
      <h1>Где и почему уходят</h1>
      <p className="lead">Сотрудники, вышедшие на работу за последние 12 месяцев: с {fmtDate(p.from)} по {fmtDate(state.today)}.</p>

      <div className="row" style={{ gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ minWidth: 160 }}>
          <div className="muted small">Пришло</div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{p.total.hired}</div>
        </div>
        <div className="card" style={{ minWidth: 160 }}>
          <div className="muted small">Ушли до 90 дней</div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>
            {p.total.earlyLeft} <span className="muted" style={{ fontSize: 16 }}>({pct(p.total.rate)})</span>
          </div>
        </div>
        <div className="card" style={{ minWidth: 160 }}>
          <div className="muted small">Ответили на опросы</div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{p.total.answered} <span className="muted" style={{ fontSize: 16 }}>чел.</span></div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        {TABS.map((t) => (
          <button key={t.id} className={`btn small ${tab === t.id ? "primary" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab !== "reasons" && (
        <ul className="notes">
          <li><b>Главная проблема</b> — причина, из-за которой уходят и на которую жалуются в опросах.</li>
          <li><b>Ещё сигналы</b> — причины, которые называли только ушедшие или только в опросах.</li>
          {tab !== "depts" && (
            <li>
              <span className="badge red">Красным</span> — уходят в {String(HOT_FACTOR).replace(".", ",")} раза чаще среднего по компании.
            </li>
          )}
          <li>Нажмите на строку, чтобы увидеть все причины и число людей.</li>
        </ul>
      )}

      {tab === "points" && <RowsTable rows={p.byPoint} first="Точка" total={p.total} />}
      {tab === "depts" && <RowsTable rows={p.byDept} first="Отдел" />}
      {tab === "managers" && <RowsTable rows={managers.map((m) => ({ ...m, sub: m.point }))} first="Руководитель" total={p.total} />}

      {tab === "reasons" && (
        <div className="card stack">
          <ul className="notes" style={{ margin: 0 }}>
            <li>Ранний уход — последний рабочий день наступил раньше 90 дней работы.</li>
            <li>Ниже — причины всех ранних уходов по компании, в людях.</li>
          </ul>
          {p.total.exitReasons.map((r) => (
            <div key={r.category} className="row" style={{ flexWrap: "nowrap" }}>
              <div style={{ width: 210, flex: "none" }}>{r.category}</div>
              <div className="bar" style={{ flex: 1 }}>
                <span style={{ width: `${(r.count / maxExit) * 100}%` }} />
              </div>
              <div style={{ width: 30, textAlign: "right" }}>{r.count}</div>
            </div>
          ))}
          <ul className="notes" style={{ margin: 0 }}>
            <li>«Причина не указана» — в задаче увольнения формальная формулировка, а опроса при уходе не было.</li>
          </ul>
        </div>
      )}
    </>
  );
}
