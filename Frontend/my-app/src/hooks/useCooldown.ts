import { useState, useEffect } from 'react';

export const useCooldown = () => {
    //timeLeft defines the remaining cooldown time (seconds)
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const check = () => {
      const cooldownUntil = sessionStorage.getItem('cooldownUntil');
      if (!cooldownUntil) {
        setTimeLeft(0);
        return;
      }

      // Calculate remaining time and update state
      const remaining = Math.max(0, parseInt(cooldownUntil, 10) - Date.now());
      setTimeLeft(Math.ceil(remaining / 1000));

      // Cleanup if cooldown has expired
      if (remaining <= 0) {
        sessionStorage.removeItem('cooldownUntil');
      }
    };

    // Initial check (while refreshing the page)and set up interval to update every second (1000 ms)
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, []);

  return timeLeft;
};
