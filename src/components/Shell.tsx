"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { useDemo } from "@/lib/store";
import { fmtDate } from "@/lib/dates";
import { isActiveFlag, isOverdue } from "@/lib/logic";

const TABS = [
  { href: "/", label: "Как проверить" },
  { href: "/bitrix", label: "Битрикс24" },
  { href: "/hr-tasks", label: "Задачи HR" },
  { href: "/flags", label: "К кому идти сейчас" },
  { href: "/picture", label: "Где и почему уходят" },
];

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { state } = useDemo();

  // Опрос открывает сотрудник: без вкладок HR, только тонкая полоска с датой демо.
  if (path.startsWith("/s/")) {
    return (
      <>
        <div className="demostrip">Демо: экран сотрудника · {fmtDate(state.today)}</div>
        {children}
      </>
    );
  }

  // На вкладке — только то, что пора отправить сегодня (запланированные не считаем).
  const pending = state.subtasks.filter((s) => s.status === "pending" && s.dueDate <= state.today).length;
  const overdue = state.subtasks.some((s) => isOverdue(s, state.today));
  const flags = state.flags.filter(isActiveFlag).length;

  return (
    <>
      <header className="topbar">
        <nav className="nav">
          {TABS.map((t) => {
            const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
            let count: number | null = null;
            if (t.href === "/hr-tasks" && pending) count = pending;
            if (t.href === "/flags" && flags) count = flags;
            return (
              <Link key={t.href} href={t.href} className={active ? "active" : ""}>
                {t.label}
                {count !== null && <span className={`count ${t.href === "/hr-tasks" && !overdue ? "grey" : ""}`}>{count}</span>}
              </Link>
            );
          })}
        </nav>
        <DemoClock />
      </header>
      <main className="page">{children}</main>
    </>
  );
}

/** Дата в демо: вперёд на неделю / 60 дней и возврат к сегодняшнему дню (вместе с данными). */
function DemoClock() {
  const { state, advance, reset } = useDemo();
  const [confirm, setConfirm] = useState(false);

  if (confirm) {
    return (
      <div className="clock">
        <span className="clock-note">Вернуть к сегодня? Данные тоже вернутся к исходным.</span>
        <button className="seg-btn danger" onClick={() => { reset(); setConfirm(false); }}>Да</button>
        <button className="seg-btn" onClick={() => setConfirm(false)}>Нет</button>
      </div>
    );
  }

  return (
    <div className="clock">
      <span className="clock-label">Дата в демо</span>
      <span className="clock-date">{fmtDate(state.today)}</span>
      <div className="seg">
        <button className="seg-btn" onClick={() => advance(7)}>+7 дней</button>
        <button className="seg-btn" onClick={() => advance(60)}>+60 дней</button>
        <button className="seg-btn" onClick={() => setConfirm(true)} title="Вернуться к сегодняшней дате">↺ Сегодня</button>
      </div>
    </div>
  );
}
