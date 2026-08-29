import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * A clock that ticks when the screen is looked at, and not otherwise.
 *
 * Reading `Date.now()` while rendering is impure, and worse, it goes stale: a
 * card falling due while the Cap sat in the background would not appear until
 * something unrelated happened to re-render it.
 */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
    }, []),
  );

  return now;
}
