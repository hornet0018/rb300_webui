import { useEffect, useCallback } from 'react';

export function useKeyboard(sendCmdVel) {
  const keys = new Set();

  const handleKeyDown = useCallback((e) => {
    if (keys.has(e.key)) return;
    keys.add(e.key);

    switch (e.key) {
      case 'w':
      case 'ArrowUp':
        sendCmdVel(0.5, 0);
        break;
      case 's':
      case 'ArrowDown':
        sendCmdVel(-0.5, 0);
        break;
      case 'a':
      case 'ArrowLeft':
        sendCmdVel(0, 0.5);
        break;
      case 'd':
      case 'ArrowRight':
        sendCmdVel(0, -0.5);
        break;
    }
  }, [sendCmdVel]);

  const handleKeyUp = useCallback((e) => {
    keys.delete(e.key);
    if (
      ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
    ) {
      sendCmdVel(0, 0);
    }
  }, [sendCmdVel]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);
}
