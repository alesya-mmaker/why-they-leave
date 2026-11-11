"use client";

// Хранилище демо: состояние в React-контексте + localStorage.
// Вкладки синхронизируются через событие storage (ответ в опросе сразу виден на экране HR).

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { todayIso } from "./dates";
import { needsLlm } from "./categorize";
import * as L from "./logic";
import { buildSeed, STATE_VERSION } from "./seed";
import { activeChannel } from "./channel";
import { CATEGORIES, Category, DemoState, FlagStatus } from "./types";

const KEY = "novichki-demo";

function load(): DemoState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as DemoState;
      if (s.version === STATE_VERSION) return s;
    }
  } catch {
    // повреждённые данные -> начинаем заново
  }
  return buildSeed(todayIso());
}

function save(s: DemoState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // приватный режим: работаем без сохранения
  }
}

/** Спросить LLM категорию. Без ключа или при ошибке возвращает null, всё продолжает работать. */
async function askLlm(text: string): Promise<Category | null> {
  try {
    const res = await fetch("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { category: string | null };
    return CATEGORIES.includes(data.category as Category) ? (data.category as Category) : null;
  } catch {
    return null;
  }
}

interface Store {
  state: DemoState;
  advance: (days: number) => void;
  reset: () => void;
  createHire: (f: L.HireInput) => void;
  createFire: (f: L.FireInput) => void;
  markSent: (subtaskId: string) => Promise<void>;
  submit: (token: string, a: L.AnswerInput) => boolean;
  setFlagStatus: (flagId: string, st: FlagStatus) => void;
}

const Ctx = createContext<Store | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState | null>(null);
  const ref = useRef<DemoState | null>(null);

  const commit = useCallback((next: DemoState) => {
    ref.current = next;
    save(next);
    setState(next);
  }, []);

  useEffect(() => {
    const s = load();
    commit(s);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY || !e.newValue) return;
      const next = JSON.parse(e.newValue) as DemoState;
      ref.current = next;
      setState(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [commit]);

  const cur = () => ref.current!;

  const llmRefine = useCallback(
    async (text: string, target: { responseId?: string; fireId?: string }) => {
      const cat = await askLlm(text);
      if (cat && ref.current) commit(L.applyLlm(ref.current, target, cat));
    },
    [commit],
  );

  if (!state) {
    return <div className="loading">Загрузка демо…</div>;
  }

  const store: Store = {
    state,
    advance: (days) => commit(L.advanceDays(cur(), days)),
    reset: () => commit(buildSeed(todayIso())),
    createHire: (f) => commit(L.createHire(cur(), f)),
    createFire: (f) => {
      const { state: next, fireId } = L.createFire(cur(), f);
      commit(next);
      const fire = next.tasks.find((t) => t.id === fireId);
      if (fire?.type === "fire" && needsLlm(fire.reason, fire.reasonCat)) void llmRefine(fire.reason, { fireId: fire.id });
    },
    markSent: async (subtaskId) => {
      const s = cur();
      const sub = s.subtasks.find((x) => x.id === subtaskId);
      const hire = sub && L.hireById(s, sub.hireTaskId);
      if (!sub || !hire) return;
      const link = `${window.location.origin}/s/${sub.token}`;
      const res = await activeChannel.send({ subtaskId, contact: hire.contact, text: L.messageText(sub, hire, link) });
      if (res.ok) commit(L.markSent(cur(), subtaskId));
    },
    submit: (token, a) => {
      const { state: next, responseId } = L.submitResponse(cur(), token, a);
      if (!responseId) return false;
      commit(next);
      const text = a.kind === "stay" ? a.comment : a.details;
      const r = next.responses.find((x) => x.id === responseId)!;
      const cat = r.answer.kind === "stay" ? r.answer.commentCat : r.answer.detailsCat;
      if (needsLlm(text, cat)) void llmRefine(text, { responseId });
      return true;
    },
    setFlagStatus: (flagId, st) => commit(L.setFlagStatus(cur(), flagId, st)),
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useDemo(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useDemo вне DemoProvider");
  return s;
}
