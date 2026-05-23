import styles from './BatteryPanel.module.css';

export function BatteryPanel({ battery }) {
  return (
    <div className={styles.batteryPanel}>
      <h2>バッテリー状態</h2>
      {battery ? (
        <div className={styles.value}>
          電圧: {battery.voltage.toFixed(2)} V | 残量: {(battery.percentage * 100).toFixed(1)} %
        </div>
      ) : (
        <div className={styles.disconnected}>接続待ち...</div>
      )}
    </div>
  );
}
