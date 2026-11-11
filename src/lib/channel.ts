// Канал отправки опросов. Сейчас отправка ручная: HR копирует текст и сам пишет сотруднику
// в мессенджер, затем отмечает «Отправлено». Чтобы перейти на Telegram-бота, достаточно
// реализовать SendChannel с автоматической отправкой и подменить activeChannel.

export interface OutgoingMessage {
  subtaskId: string;
  contact: string; // телефон или @telegram из задачи приёма
  text: string;
}

export interface SendChannel {
  id: string;
  title: string;
  /** true: канал сам доставляет сообщение, HR ничего не копирует. */
  automatic: boolean;
  send(msg: OutgoingMessage): Promise<{ ok: boolean; error?: string }>;
}

/** Ручной канал: «отправка» = HR скопировал текст и отметил подзадачу. */
export const manualChannel: SendChannel = {
  id: "manual",
  title: "Вручную через мессенджер HR",
  automatic: false,
  async send() {
    return { ok: true };
  },
};

// Заготовка на будущее (этап 2):
// export const telegramChannel: SendChannel = {
//   id: "telegram", title: "Telegram-бот", automatic: true,
//   async send(msg) { /* POST /api/telegram/send { chatId, text } */ },
// };

export const activeChannel: SendChannel = manualChannel;
