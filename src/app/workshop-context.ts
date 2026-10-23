import { createContext, useContext } from 'react'
import type { Membership, WorkshopData } from '../data/types'
export interface AppState {
  data: WorkshopData | null; loading: boolean; busy: boolean; error: string; toast: string; signedIn: boolean;
  membership: Membership | null; isAdmin: boolean; signOut: () => Promise<void>;
  restoreBackup: (backup: WorkshopData) => Promise<boolean>;
  mutate: (fn: (data: WorkshopData) => void, message?: string, expectedUserId?: string) => Promise<boolean>;
  refresh: () => Promise<void>; notify: (message: string) => void; clearError: () => void;
}
export const WorkshopContext = createContext<AppState | null>(null)
export function useWorkshop() {
  const context = useContext(WorkshopContext)
  if (!context) throw new Error('Missing app provider')
  return context
}
