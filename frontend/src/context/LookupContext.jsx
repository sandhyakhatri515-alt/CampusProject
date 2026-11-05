import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const EMPTY = { conditions: [], report_reasons: [], departments: [], locations: [] };
const LookupContext = createContext({ ...EMPTY, refresh: () => {}, conditionLabel: (v) => v });

const prettify = (v = '') => v.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

// Option lists (conditions, departments, pick-up locations, report reasons) come from the server.
export function LookupProvider({ children }) {
  const [data, setData] = useState(EMPTY);

  const refresh = useCallback(() => {
    api.get('/lookups').then((r) => setData({ ...EMPTY, ...r.data })).catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => ({
    ...data,
    refresh,
    conditionLabel: (v) => data.conditions.find((c) => c.value === v)?.label || prettify(v)
  }), [data, refresh]);

  return <LookupContext.Provider value={value}>{children}</LookupContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useLookups = () => useContext(LookupContext);

// Native autocomplete list: <input list={id} /> + <DataList id={id} items={...} />
export function DataList({ id, items }) {
  return (
    <datalist id={id}>
      {items.map((i) => <option key={i.name} value={i.name} />)}
    </datalist>
  );
}
