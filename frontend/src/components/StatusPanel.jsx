import styles from './StatusPanel.module.css';

export function StatusPanel({ status }) {
  return (
    <div className={styles.statusPanel}>
      <h2>ロボット状態</h2>
      {status ? (
        <div className={styles.status}>{status}</div>
      ) : (
        <div className={styles.disconnected}>接続待ち...</div>
      )}
    </div>
  );
}
