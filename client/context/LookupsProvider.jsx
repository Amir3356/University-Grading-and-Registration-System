import { useQuery } from '@/hooks/useStore'
import { store } from '@/store'
import { LookupsContext } from './lookups-context'

export function LookupsProvider({ children }) {
  const { data } = useQuery(() => store.lookups.getLookups(), [])
  return <LookupsContext.Provider value={data ?? null}>{children}</LookupsContext.Provider>
}
