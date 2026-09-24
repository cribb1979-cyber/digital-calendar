import { useCallback, useEffect, useState } from 'react';
import { formatTime } from '../lib/dates.js';

const FIRED_KEY = 'dc:fired-reminders';
const CHECK_INTERVAL = 15000;
// Don't fire reminders for events that started longer ago than this
const GRACE_MS = 5 * 60000;

function loadFired() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FIRED_KEY)) || []);
  } catch {
    return new Set();
  }
}

function saveFired(fired) {
  try {
    // Keep the list from growing forever
    localStorage.setItem(FIRED_KEY, JSON.stringify([...fired].slice(-500)));
  } catch {
    // storage unavailable - reminders may repeat after reload
  }
}

const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

/**
 * Fires a browser notification (and an in-app alert via `onRemind`) when an
 * event's reminder time is reached. Works while the app is open in a tab.
 */
export function useReminders(events, onRemind) {
  const [permission, setPermission] = useState(notificationsSupported() ? Notification.permission : 'unsupported');

  const requestPermission = useCallback(async () => {
    if (!notificationsSupported()) return;
    setPermission(await Notification.requestPermission());
  }, []);

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      const fired = loadFired();
      let changed = false;
      for (const event of events) {
        if (event.reminderMinutes == null) continue;
        const start = new Date(event.start).getTime();
        const remindAt = start - event.reminderMinutes * 60000;
        const key = `${event.id}:${event.start}:${event.reminderMinutes}`;
        if (remindAt > now || start < now - GRACE_MS || fired.has(key)) continue;
        fired.add(key);
        changed = true;
        const when = event.allDay ? 'idag' : `kl ${formatTime(new Date(event.start))}`;
        const body = start <= now ? `Börjar nu (${when})` : `Börjar ${when}`;
        if (notificationsSupported() && Notification.permission === 'granted') {
          try {
            new Notification(event.title, { body, tag: key });
          } catch {
            // Some mobile browsers only allow notifications from a service worker
          }
        }
        onRemind?.(event, body);
      }
      if (changed) saveFired(fired);
    };
    check();
    const id = setInterval(check, CHECK_INTERVAL);
    return () => clearInterval(id);
  }, [events, onRemind]);

  return { permission, requestPermission };
}
