'use client'

import { Suspense, type ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { SkoupProvider, useSkoupPageview, type SkoupProviderProps } from '@skoup/analytics-react'

function PageViews() {
  const pathname = usePathname()
  const search = useSearchParams()
  const query = search?.toString()
  useSkoupPageview(pathname === null ? null : pathname + (query ? '?' + query : ''))
  return null
}

/**
 * Skoup Analytics for the App Router: mount once in the root layout. Page
 * views follow the pathname and search params (the provider does not
 * patch `history`, Next drives it). `useSearchParams` needs a Suspense
 * boundary during static rendering — provided here.
 */
export function SkoupAnalytics({
  children,
  ...options
}: Omit<SkoupProviderProps, 'autoPageview' | 'trackHistory'> & { children?: ReactNode }) {
  return (
    <SkoupProvider {...options} autoPageview={false} trackHistory={false}>
      <Suspense fallback={null}>
        <PageViews />
      </Suspense>
      {children}
    </SkoupProvider>
  )
}

export { useSkoup, useSkoupEvent } from '@skoup/analytics-react'
export type {
  Skoup,
  SkoupOptions,
  Attribution,
  EventExtra,
  EventProperties,
  ConsentState,
} from '@skoup/analytics'
