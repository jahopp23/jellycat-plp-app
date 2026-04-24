import type {Dispatch, SetStateAction} from 'react';
import {useEffect} from 'react';

/**
 * Clears a message after a short delay (ARIA live region on PLP).
 */
export function useAnnouncementTimeout(
  announcement: string | null,
  setAnnouncement: Dispatch<SetStateAction<string | null>>,
) {
  useEffect(() => {
    const timeoutId =
      announcement &&
      window.setTimeout(() => {
        setAnnouncement(null);
      }, 2600);

    return () => {
      timeoutId && window.clearTimeout(timeoutId);
    };
  }, [announcement, setAnnouncement]);
}
