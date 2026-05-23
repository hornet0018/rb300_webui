import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const [battery, setBattery] = useState(null);
  const [status, setStatus] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const s = io(import.meta.env.DEV ? 'http://localhost:5000' : undefined);
    setSocket(s);

    s.on('connect', () => {
      setConnected(true);
      console.log('Socket connected');
    });

    s.on('disconnect', () => {
      setConnected(false);
      console.log('Socket disconnected');
    });

    s.on('battery_update', (data) => {
      setBattery(data);
    });

    s.on('status_update', (data) => {
      setStatus(data.status);
    });

    return () => {
      s.disconnect();
    };
  }, []);

  const sendCmdVel = (linear_x, angular_z) => {
    if (socket && socket.connected) {
      socket.emit('cmd_vel', { linear_x, angular_z });
    }
  };

  return { connected, battery, status, sendCmdVel };
}
