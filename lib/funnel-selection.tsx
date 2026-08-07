"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode, ReactElement } from "react";
import type { FunnelBrandKit, BuilderSelection } from "./prompt-assembly.ts";
import { STORAGE_KEY, validatePersisted } from "./funnel-selection.ts";
import type { PersistedState, CatalogueShape } from "./funnel-selection.ts";

const EMPTY_KIT: FunnelBrandKit = {
  primary: "", background: "", fontHead: "", fontSub: "", fontBody: "", images: "",
};

// Declared explicitly rather than as `ReturnType<typeof useFunnelSelection>`:
// that form is circular (the hook is defined below and reads from this
// context), which TypeScript rejects.
interface ContextValue {
  sel: Record<string, BuilderSelection>;
  kit: FunnelBrandKit;
  hydrated: boolean;
  enabledIds: string[];
  setSection: (id: string, patch: Partial<BuilderSelection>) => void;
  toggleSection: (id: string, variation: string) => void;
  setKit: (patch: Partial<FunnelBrandKit>) => void;
  replaceAll: (next: PersistedState) => void;
  reset: () => void;
}

const Ctx = createContext<ContextValue | null>(null);

export function FunnelSelectionProvider({
  children, catalogue, initialSel,
}: {
  children: ReactNode;
  catalogue: CatalogueShape;
  initialSel: Record<string, BuilderSelection>;
}): ReactElement {
  const [sel, setSel] = useState(initialSel);
  const [kit, setKitState] = useState<FunnelBrandKit>(EMPTY_KIT);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate after mount, never during render: localStorage does not exist on the
  // server and reading it in render causes a hydration mismatch. localStorage is
  // read synchronously here — there is no async gap and so no unmount race — so
  // the setState calls below are deliberately direct, not deferred to a
  // callback; react-hooks/set-state-in-effect is silenced narrowly rather than
  // worked around, since the "avoid setState in an effect" rationale (cascading
  // renders from an avoidable derived-state effect) doesn't apply to a one-time
  // post-mount hydration read.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = validatePersisted(JSON.parse(stored), catalogue);
        if (parsed) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
          setSel((prev) => ({ ...prev, ...parsed.sel }));
          setKitState(parsed.kit);
        }
      }
    } catch {
      // Corrupt or unavailable storage is not worth failing the app over.
    }
    setHydrated(true);
  }, [catalogue]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ sel, kit }));
    } catch {
      // Quota or private-mode failures are non-fatal.
    }
  }, [sel, kit, hydrated]);

  const setSection = useCallback((id: string, patch: Partial<BuilderSelection>) => {
    setSel((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const toggleSection = useCallback((id: string, variation: string) => {
    setSel((prev) => {
      const current = prev[id];
      const turningOff = current?.enabled && current.variation === variation;
      return { ...prev, [id]: { ...current, enabled: !turningOff, variation } };
    });
  }, []);

  const setKit = useCallback((patch: Partial<FunnelBrandKit>) => {
    setKitState((prev) => ({ ...prev, ...patch }));
  }, []);

  const replaceAll = useCallback((next: PersistedState) => {
    setSel(next.sel);
    setKitState(next.kit);
  }, []);

  const reset = useCallback(() => {
    setSel(initialSel);
    setKitState(EMPTY_KIT);
  }, [initialSel]);

  const enabledIds = useMemo(
    () => Object.entries(sel).filter(([, v]) => v?.enabled).map(([id]) => id),
    [sel]
  );

  const value = useMemo<ContextValue>(
    () => ({ sel, kit, hydrated, enabledIds, setSection, toggleSection, setKit, replaceAll, reset }),
    [sel, kit, hydrated, enabledIds, setSection, toggleSection, setKit, replaceAll, reset]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFunnelSelection(): ContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFunnelSelection must be used inside FunnelSelectionProvider");
  return ctx;
}
