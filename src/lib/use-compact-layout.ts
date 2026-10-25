import { useSyncExternalStore } from 'react'

const query = '(max-width: 760px)'
function subscribe(update: () => void) {
  const media = window.matchMedia(query)
  media.addEventListener('change', update)
  return () => media.removeEventListener('change', update)
}
export function useCompactLayout() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
}
