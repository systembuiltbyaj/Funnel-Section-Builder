"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode, ReactElement } from "react";
import type { FunnelBrandKit, BuilderSelection } from "./prompt-assembly.ts";
import { STORAGE_KEY, validatePersisted } from "./funnel-selection.ts";
import type { CatalogueShape, PersistedAnalysis } from "./funnel-selection.ts";

const EMPTY_KIT: FunnelBrandKit = {
  primary: "", background: "", fontHead: "", fontSub: "", fontBody: "", images: "",
};

// Declared explicitly rather than as `ReturnType<typeof useFunnelSelection>`:
// that form is circular (the hook is defined below and reads from this
// context), which TypeScript rejects.
interface ContextValue {
  sel: Record<string, BuilderSelection>;
  kit: FunnelBrandKit;
  analysis: PersistedAnalysis | null;
  hydrated: boolean;
  setSection: (id: string, patch: Partial<BuilderSelection>) => void;
  toggleSection: (id: string, variation: string) => void;
  setKit: (patch: Partial<FunnelBrandKit>) => void;
  applyAnalysis: (next: Record<string, BuilderSelection>, analysis: PersistedAnalysis) => void;
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
  const [analysis, setAnalysis] = useState<PersistedAnalysis | null>(null);
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
          setAnalysis(parsed.analysis);
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
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ sel, kit, analysis }));
    } catch {
      // Quota or private-mode failures are non-fatal.
    }
  }, [sel, kit, analysis, hydrated]);

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

  /**
   * Replace the whole selection with the analyzer's picks.
   *
   * Wholesale rather than merged: the model reasons about the page as one
   * document, so half its recommendations applied over half a manual selection
   * is not a coherent funnel. The caller is responsible for confirming first
   * when the user already has picks — see the analyze panel.
   */
  const applyAnalysis = useCallback(
    (next: Record<string, BuilderSelection>, nextAnalysis: PersistedAnalysis) => {
      setSel(next);
      setAnalysis(nextAnalysis);
    },
    []
  );

  const reset = useCallback(() => {
    setSel(initialSel);
    setKitState(EMPTY_KIT);
    setAnalysis(null);
  }, [initialSel]);

  const value = useMemo<ContextValue>(
    () => ({ sel, kit, analysis, hydrated, setSection, toggleSection, setKit, applyAnalysis, reset }),
    [sel, kit, analysis, hydrated, setSection, toggleSection, setKit, applyAnalysis, reset]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFunnelSelection(): ContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFunnelSelection must be used inside FunnelSelectionProvider");
  return ctx;
}
