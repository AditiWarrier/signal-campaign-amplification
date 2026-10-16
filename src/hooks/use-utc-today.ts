import { useEffect, useState } from 'react';

import { getUtcToday, type IsoDate } from '@/data/campaigns';

/** Refreshes date-only campaign deadlines at least once a minute, including UTC midnight. */
export function useUtcToday(): IsoDate {
  const [today, setToday] = useState(getUtcToday);

  useEffect(() => {
    const interval = setInterval(() => setToday(getUtcToday()), 60_000);
    return () => clearInterval(interval);
  }, []);

  return today;
}
