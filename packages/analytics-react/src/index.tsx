'use client'

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { createSkoup, noopSkoup, type Skoup, type SkoupOptions } from '@skoup/analytics'

const SkoupContext = createContext<Skoup>(noopSkoup())

export interface SkoupProviderProps extends SkoupOptions {
  children?: ReactNode
}

/**
 * Creates the Skoup Analytics instance once, on the client, and shares it
 * through `useSkoup()`. Page views follow `history.pushState` (React
 * Router, Next's pages router…); a router that does not push — or
 * Next's app router — reports them with `useSkoupPageview()` instead
 * (`trackHistory: false`).
 */
export function SkoupProvider({ children, ...options }: SkoupProviderProps) {
  const instance = useRef<Skoup | null>(null)

  if (instance.current === null) {
    instance.current = typeof window === 'undefined' ? noopSkoup() : createSkoup(options)
  }

  useEffect(() => {
    const current = instance.current
    return () => current?.destroy()
  }, [])

  return <SkoupContext.Provider value={instance.current}>{children}</SkoupContext.Provider>
}

/** The instance of the nearest provider (a no-op outside of one, or on the server). */
export function useSkoup(): Skoup {
  return useContext(SkoupContext)
}

/**
 * Reports a page view each time `path` changes — for routers the
 * provider cannot observe. Pass the pathname plus search, and give the
 * provider `autoPageview: false` and `trackHistory: false`.
 */
export function useSkoupPageview(path: string | null | undefined): void {
  const skoup = useSkoup()
  const last = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (path == null || path === last.current) return
    last.current = path
    skoup.pageview(last.current === undefined ? undefined : null)
  }, [path, skoup])
}

/** `useMemo` helper: a stable event sender for a component (`const track = useSkoupEvent('signup')`). */
export function useSkoupEvent(name: string) {
  const skoup = useSkoup()
  return useMemo(
    () => (properties?: Parameters<Skoup['event']>[1], extra?: Parameters<Skoup['event']>[2]) =>
      skoup.event(name, properties, extra),
    [name, skoup],
  )
}

export type {
  Skoup,
  SkoupOptions,
  Attribution,
  EventExtra,
  EventProperties,
  ConsentState,
} from '@skoup/analytics'
