"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type ActiveCitationValue = {
  active: string | null;
  setActive: (id: string | null) => void;
};

const ActiveCitationContext = createContext<ActiveCitationValue>({
  active: null,
  setActive: () => {},
});

export function ActiveCitationProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<string | null>(null);
  const value = useMemo(() => ({ active, setActive }), [active]);
  return <ActiveCitationContext.Provider value={value}>{children}</ActiveCitationContext.Provider>;
}

export function useActiveCitation(): ActiveCitationValue {
  return useContext(ActiveCitationContext);
}
