import styles from './App.module.css';
import { useSocket } from './hooks/useSocket';
import { useKeyboard } from './hooks/useKeyboard';
import { BatteryPanel } from './components/BatteryPanel';
import { StatusPanel } from './components/StatusPanel';
import { ControlPad } from './components/ControlPad';

function App() {
  const { connected, battery, status, sendCmdVel } = useSocket();
  useKeyboard(sendCmdVel);

  return (
    <div className={styles.app}>
      <h1>RB300 コントロールパネル</h1>
      <div className={styles.connectionBadge}>
        {connected ? '接続中' : '切断'}
      </div>
      <BatteryPanel battery={battery} />
      <StatusPanel status={status} />
      <ControlPad sendCmdVel={sendCmdVel} />
    </div>
  );
}

export default App;
