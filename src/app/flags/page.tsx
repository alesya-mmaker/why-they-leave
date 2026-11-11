"use client";

import { useState } from "react";
import { useDemo } from "@/lib/store";
import { fmtShort } from "@/lib/dates";
import { HINTS, SOURCE_LABEL } from "@/lib/categorize";
import { fireForHire, hireById, isActiveFlag, responseReason } from "@/lib/logic";
import { Flag, FlagStatus, FlagType } from "@/lib/types";

const FLAG_META: Record<FlagType, { label: string; color: "red" | "yellow"; rank: number }> = {
  leaving: { label: "Думает уйти", color: "red", rank: 0 },
  retain: { label: "Есть шанс удержать", color: "red", rank: 0 },
  hard: { label: "Есть сложности", color: "yellow", rank: 1 },
};

const STATUS_LABEL: Record<FlagStatus, string> = {
  new: "Новый",
  contacted: "Связались",
  resolved: "Решено",
  left: "Ушёл",
};

export default function FlagsPage() {
  const { state } = useDemo();
  const [closed, setClosed] = useState(false);
  const list = state.flags
    .filter((f) => (closed ? !isActiveFlag(f) : isActiveFlag(f)))
    .sort((a, b) => {
      const r = FLAG_META[a.type].rank - FLAG_META[b.type].rank;
      return r !== 0 ? r : a.createdAt < b.createdAt ? 1 : -1;
    });
  const activeCount = state.flags.filter(isActiveFlag).length;

  return (
    <>
      <h1>К кому идти сейчас</h1>
      <p className="lead">Только те, кто согласился на связь. Сначала красные.</p>

      <div className="row" style={{ marginBottom: 12 }}>
        <button className={`btn small ${!closed ? "primary" : ""}`} onClick={() => setClosed(false)}>Активные {activeCount}</button>
        <button className={`btn small ${closed ? "primary" : ""}`} onClick={() => setClosed(true)}>Закрытые {state.flags.length - activeCount}</button>
      </div>

      {list.length === 0 ? (
        <p className="muted">{closed ? "Закрытых нет." : "Сейчас никого. Новые флаги появятся после ответов на опросы."}</p>
      ) : (
        <div className="stack">
          {list.map((f) => (
            <FlagCard key={f.id} flag={f} />
          ))}
        </div>
      )}
    </>
  );
}

function FlagCard({ flag }: { flag: Flag }) {
  const { state, setFlagStatus } = useDemo();
  const resp = state.responses.find((r) => r.id === flag.responseId);
  const hire = hireById(state, flag.hireTaskId);
  if (!resp || !hire) return null;
  const fire = flag.type === "retain" ? fireForHire(state, hire.id) : undefined;
  const meta = FLAG_META[flag.type];
  const a = resp.answer;
  const main = responseReason(resp);
  const comment = a.kind === "stay" ? a.comment : a.details;
  const commentCat = a.kind === "stay" ? a.commentCat : a.detailsCat;

  const reasons = a.kind === "stay" ? a.blockers.join(", ") : a.mainReason;
  // Тему комментария показываем, только если она добавляет что-то к выбору сотрудника.
  const chosen: string[] = a.kind === "stay" ? a.blockers : [a.mainReason];
  const alreadyChosen = !!commentCat && chosen.includes(commentCat.category);

  return (
    <div className={`card flag ${meta.color}`}>
      <div className="flag-head">
        <span className={`badge ${meta.color}`}>{meta.label}</span>
        <b>{hire.employee}</b>
        <span className="muted small">
          {hire.point}, {hire.position.toLowerCase()} · ответил на {resp.tenureDay}-й день работы · {hire.contact}
          {fire && <> · <b style={{ color: "var(--red)" }}>последний день {fmtShort(fire.lastDay)}</b></>}
        </span>
      </div>

      <div className="flag-body">
        <div>
          <span className="muted">{a.kind === "stay" ? "Мешает:" : "Причина ухода:"}</span>{" "}
          {reasons ? <b>{reasons}</b> : <span className="muted">не выбрано</span>}
          {a.kind === "exit" && a.stayIf && (
            <> · остался бы{a.wouldStay === "maybe" ? ", может быть," : ""} если: <b>{a.stayIf.toLowerCase()}</b></>
          )}
        </div>
        {comment && (
          <div className="muted">
            «{comment}»
            {commentCat && !alreadyChosen && (
              <span className="small">
                {" "}→ тема «{commentCat.category}» ({SOURCE_LABEL[commentCat.source]})
              </span>
            )}
          </div>
        )}
        {main && <div className="hint">{HINTS[main.category]}</div>}
        <div className="status-row">
          <span className="small muted">Статус:</span>
          <div className="seg">
            {(Object.keys(STATUS_LABEL) as FlagStatus[]).map((s) => (
              <button key={s} className={`seg-btn ${flag.status === s ? "on" : ""}`} onClick={() => setFlagStatus(flag.id, s)}>
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <span className="small muted" style={{ marginLeft: "auto" }}>ответ {fmtShort(resp.date)}</span>
        </div>
      </div>
    </div>
  );
}
