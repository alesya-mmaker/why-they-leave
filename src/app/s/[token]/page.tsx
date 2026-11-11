"use client";

import { FormEvent, useState } from "react";
import { useParams } from "next/navigation";
import { useDemo } from "@/lib/store";
import { firstName, hireById, PROBATION_DAYS, tenureDay } from "@/lib/logic";
import { fmtDate } from "@/lib/dates";
import { CATEGORIES, Category, Mood, STAY_IF, StayIf, WouldStay } from "@/lib/types";

export default function SurveyPage() {
  const { token } = useParams<{ token: string }>();
  const { state } = useDemo();
  const [done, setDone] = useState(false);

  const sub = state.subtasks.find((s) => s.token === token);
  const hire = sub && hireById(state, sub.hireTaskId);

  if (done) return <Message title="Спасибо!" text="Ответ сохранён." />;
  if (!sub || !hire) return <Message title="Ссылка не найдена" text="Возможно, демо сбросили. Попросите HR прислать новую ссылку." />;
  if (sub.status === "answered") return <Message title="Вы уже ответили" text="Спасибо, ответ сохранён." />;
  if (sub.status === "cancelled") return <Message title="Опрос больше не актуален" text="Спасибо, отвечать не нужно." />;
  if (sub.dueDate > state.today) return <Message title="Опрос ещё не открыт" text={`Он откроется ${fmtDate(sub.dueDate)}.`} />;
  if (sub.kind === "stay" && tenureDay(hire, state.today) >= PROBATION_DAYS)
    return <Message title="Опрос закрыт" text="Опросы проводятся в первые 90 дней работы." />;

  const name = firstName(hire.employee);
  return sub.kind === "stay" ? (
    <StayForm token={sub.token} name={name} day={sub.day ?? 0} onDone={() => setDone(true)} />
  ) : (
    <ExitForm token={sub.token} name={name} onDone={() => setDone(true)} />
  );
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="survey">
      <h1>{title}</h1>
      <p className="muted">{text}</p>
    </div>
  );
}

function Radio<T extends string>({ name, value, options, onChange, inline }: { name: string; value: T | null; options: readonly T[]; onChange: (v: T) => void; inline?: boolean }) {
  return (
    <div className={`opts ${inline ? "inline" : ""}`}>
      {options.map((o) => (
        <label key={o} className={`opt ${value === o ? "on" : ""}`}>
          <input type="radio" name={name} checked={value === o} onChange={() => onChange(o)} />
          {o}
        </label>
      ))}
    </div>
  );
}

const MOODS: { v: Mood; label: string }[] = [
  { v: "good", label: "Хорошо" },
  { v: "hard", label: "Есть сложности" },
  { v: "leaving", label: "Думаю уйти" },
];
const NOTHING = "Ничего не мешает";

function StayForm({ token, name, day, onDone }: { token: string; name: string; day: number; onDone: () => void }) {
  const { submit } = useDemo();
  const [mood, setMood] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [contact, setContact] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const toggle = (c: string) => {
    if (c === NOTHING) return setBlockers(blockers.includes(NOTHING) ? [] : [NOTHING]);
    const rest = blockers.filter((b) => b !== NOTHING);
    setBlockers(rest.includes(c) ? rest.filter((b) => b !== c) : [...rest, c]);
  };

  const send = (e: FormEvent) => {
    e.preventDefault();
    const m = MOODS.find((x) => x.label === mood)?.v;
    if (!m) return setErr("Ответьте на вопрос 1.");
    if (blockers.length === 0) return setErr("Выберите, что мешает, или «Ничего не мешает».");
    if (!contact) return setErr("Ответьте, можно ли HR связаться с вами.");
    const ok = submit(token, {
      kind: "stay",
      mood: m,
      blockers: blockers.filter((b) => b !== NOTHING) as Category[],
      comment: comment.trim(),
      contactOk: contact === "Да",
    });
    if (ok) onDone();
    else setErr("Не удалось сохранить: опрос уже закрыт.");
  };

  return (
    <form className="survey" onSubmit={send}>
      <h1>{name}, как вам у нас?</h1>
      <p className="muted">Вы с нами уже {day} дней. Опрос займёт минуту. Ответы конфиденциальны: имя видит только HR и только если вы разрешите связаться.</p>

      <div className="q">
        <span className="qt">1. Как вам у нас сейчас?</span>
        <Radio name="mood" value={mood} options={MOODS.map((m) => m.label)} onChange={setMood} />
      </div>

      <div className="q">
        <span className="qt">2. Что мешает больше всего? Можно несколько.</span>
        <div className="opts">
          {[NOTHING, ...CATEGORIES].map((c) => (
            <label key={c} className={`opt ${blockers.includes(c) ? "on" : ""}`}>
              <input type="checkbox" checked={blockers.includes(c)} onChange={() => toggle(c)} />
              {c}
            </label>
          ))}
        </div>
      </div>

      <div className="q">
        <label className="qt" htmlFor="comment">3. Комментарий <span className="muted">(необязательно)</span></label>
        <textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Что стоит изменить?" />
      </div>

      <div className="q">
        <span className="qt">4. Можно HR связаться с вами?</span>
        <Radio name="contact" value={contact} options={["Да", "Нет"] as const} onChange={setContact} inline />
      </div>

      {err && <div className="err">{err}</div>}
      <button className="btn primary submit" type="submit">Отправить</button>
    </form>
  );
}

const WOULD: { v: WouldStay; label: string }[] = [
  { v: "yes", label: "Да" },
  { v: "maybe", label: "Может быть" },
  { v: "no", label: "Нет" },
];

function ExitForm({ token, name, onDone }: { token: string; name: string; onDone: () => void }) {
  const { submit } = useDemo();
  const [reason, setReason] = useState<Category | null>(null);
  const [details, setDetails] = useState("");
  const [would, setWould] = useState<string | null>(null);
  const [stayIf, setStayIf] = useState<StayIf | null>(null);
  const [contact, setContact] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const w = WOULD.find((x) => x.label === would)?.v;
  const askIf = w === "yes" || w === "maybe";

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!reason) return setErr("Выберите главную причину.");
    if (!w) return setErr("Ответьте, остались бы вы.");
    if (askIf && !stayIf) return setErr("Выберите, что именно должно измениться.");
    if (!contact) return setErr("Ответьте, можно ли HR связаться с вами.");
    const ok = submit(token, {
      kind: "exit",
      mainReason: reason,
      details: details.trim(),
      wouldStay: w,
      stayIf: askIf ? stayIf : null,
      contactOk: contact === "Да",
    });
    if (ok) onDone();
    else setErr("Не удалось сохранить: опрос уже закрыт.");
  };

  return (
    <form className="survey" onSubmit={send}>
      <h1>{name}, жаль, что вы уходите</h1>
      <p className="muted">Ответьте, пожалуйста, на несколько вопросов. Это поможет нам стать лучше для новых сотрудников. Ответы конфиденциальны: имя видит только HR и только если вы разрешите связаться.</p>

      <div className="q">
        <span className="qt">1. Главная причина ухода?</span>
        <Radio name="reason" value={reason} options={CATEGORIES} onChange={setReason} />
      </div>

      <div className="q">
        <label className="qt" htmlFor="details">2. Расскажите подробнее <span className="muted">(необязательно)</span></label>
        <textarea id="details" value={details} onChange={(e) => setDetails(e.target.value)} />
      </div>

      <div className="q">
        <span className="qt">3. Остались бы, если бы что-то изменилось?</span>
        <Radio name="would" value={would} options={WOULD.map((x) => x.label)} onChange={setWould} inline />
        {askIf && (
          <div className="q">
            <span className="qt">Что именно?</span>
            <Radio name="stayIf" value={stayIf} options={STAY_IF} onChange={setStayIf} />
          </div>
        )}
      </div>

      <div className="q">
        <span className="qt">4. Можно HR связаться с вами до последнего дня?</span>
        <Radio name="contact" value={contact} options={["Да", "Нет"] as const} onChange={setContact} inline />
      </div>

      {err && <div className="err">{err}</div>}
      <button className="btn primary submit" type="submit">Отправить</button>
    </form>
  );
}
