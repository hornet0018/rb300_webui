import styles from './ControlPad.module.css';

export function ControlPad({ sendCmdVel }) {
  const handleStart = (linear, angular) => (e) => {
    e.preventDefault();
    sendCmdVel(linear, angular);
  };

  const handleEnd = (e) => {
    e.preventDefault();
    sendCmdVel(0, 0);
  };

  return (
    <div className={styles.controlPad}>
      <h2>移動操作</h2>
      <div className={styles.controls}>
        <button
          onMouseDown={handleStart(0.5, 0)}
          onMouseUp={handleEnd}
          onTouchStart={handleStart(0.5, 0)}
          onTouchEnd={handleEnd}
        >
          前進
        </button>
        <button
          onMouseDown={handleStart(-0.5, 0)}
          onMouseUp={handleEnd}
          onTouchStart={handleStart(-0.5, 0)}
          onTouchEnd={handleEnd}
        >
          後退
        </button>
        <button
          onMouseDown={handleStart(0, 0.5)}
          onMouseUp={handleEnd}
          onTouchStart={handleStart(0, 0.5)}
          onTouchEnd={handleEnd}
        >
          左旋回
        </button>
        <button
          onMouseDown={handleStart(0, -0.5)}
          onMouseUp={handleEnd}
          onTouchStart={handleStart(0, -0.5)}
          onTouchEnd={handleEnd}
        >
          右旋回
        </button>
      </div>
      <p className={styles.note}>キーボード: W/A/S/D または 矢印キー</p>
    </div>
  );
}
