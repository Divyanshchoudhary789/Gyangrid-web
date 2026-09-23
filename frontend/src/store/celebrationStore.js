import { create } from 'zustand';

/** Queue of short, non-blocking reward celebrations (F10-09). */
export const useCelebrationStore = create((set) => ({
  queue: [],
  celebrate: (item) => {
    if (!item || (!item.xp && !item.coins && !item.title)) return;
    set((s) => ({ queue: [...s.queue, { id: `${Date.now()}_${Math.random()}`, ...item }] }));
  },
  dismiss: (id) => set((s) => ({ queue: s.queue.filter((c) => c.id !== id) })),
}));
