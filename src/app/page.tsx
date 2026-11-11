"use client";

import Link from "next/link";
import { useState } from "react";
import { useDemo } from "@/lib/store";

const STEPS = [
  "HR создаёт задачу приёма",
  "Опросы на 7, 14, 30, 60 день планируются сами",
  "В день срока HR отправляет ссылку",
  "Сотрудник отвечает по ссылке",
  "Тревожный ответ — флаг HR",
  "При увольнении до 90 дней — опрос «почему уходите»",
];

export default function HomePage() {
  const { reset } = useDemo();
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <>
      <h1>Почему уходят новые сотрудники</h1>
      <p className="lead">
        Короткие опросы в первые 90 дней и при уходе. HR видит, к кому идти сейчас и где теряют людей.
      </p>

      <div className="steps">
        {STEPS.map((s) => (
          <div key={s} className="step">{s}</div>
        ))}
      </div>

      <h2>Как можно проверить</h2>
      <div className="card">
        <ol className="check">
          <li><Link href="/bitrix">Битрикс24</Link> → «+ Задача приёма», выберите точку «Магазин №3», создайте.</li>
          <li><Link href="/hr-tasks">Задачи HR</Link>: у сотрудника сразу запланированы 4 опроса.</li>
          <li>Нажмите «+7 дней» два раза. Опрос на 14 день стал «Отправить»: откройте ссылку ↗.</li>
          <li>Ответьте: «Думаю уйти», мешает «График», комментарий, связаться «Да».</li>
          <li><Link href="/flags">К кому идти сейчас</Link>: красный флаг с причиной и подсказкой.</li>
          <li>Битрикс24 → «+ Задача увольнения» для этого сотрудника. В Задачах HR появился опрос «При уходе».</li>
          <li>Ответьте: «График», остались бы «Да», «Другой график». Появился флаг «Есть шанс удержать».</li>
          <li><Link href="/picture">Где и почему уходят</Link>: у Магазина №3 выросли ранние уходы и причина «График».</li>
        </ol>
      </div>

      <div className="row" style={{ marginTop: 20 }}>
        {!confirm ? (
          <button className="btn" onClick={() => { setConfirm(true); setDone(false); }}>Сбросить демо</button>
        ) : (
          <>
            <span>Все изменения пропадут.</span>
            <button className="btn primary" onClick={() => { reset(); setConfirm(false); setDone(true); }}>Да, сбросить</button>
            <button className="btn" onClick={() => setConfirm(false)}>Отмена</button>
          </>
        )}
        {done && <span className="badge green">Демо сброшено</span>}
        <span className="small muted">Данные вымышленные и хранятся в вашем браузере.</span>
      </div>
    </>
  );
}
