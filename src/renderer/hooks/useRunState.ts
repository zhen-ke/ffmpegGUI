import { useEffect, useRef, useState } from 'react';

/**
 * useRunState — 运行状态指示（驱动底部标签栏的圆点动画）
 *
 * 从 FFmpeg 状态机派生一个轻量指示：
 * - running / stopping  → 'running'（圆点脉冲动画）
 * - done                → 'success'（绿色，短暂停留后自动回到 idle）
 * - error               → 'error'  （红色，短暂停留后自动回到 idle）
 *
 * 与 useResultCards 的自动弹抽屉解耦：圆点只负责"提示"，不负责"弹出"。
 */
export type RunState = 'idle' | 'running' | 'success' | 'error';

const SUCCESS_HOLD_MS = 3000;
const ERROR_HOLD_MS = 3000;

export function useRunState(status: string): RunState {
  const [runState, setRunState] = useState<RunState>('idle');
  const statusRef = useRef<string>('idle');

  useEffect(() => {
    const prev = statusRef.current;
    statusRef.current = status;

    // 运行态：直接切到 running（不启动定时器）
    if (status === 'running' || status === 'stopping') {
      setRunState('running');
      return undefined;
    }

    // 仅状态跳变时触发一次性结果提示（done/error），避免重复渲染反复重启定时器。
    if (status === prev || (status !== 'done' && status !== 'error')) {
      return undefined;
    }

    setRunState(status === 'done' ? 'success' : 'error');
    const timer = window.setTimeout(
      () => setRunState('idle'),
      status === 'done' ? SUCCESS_HOLD_MS : ERROR_HOLD_MS,
    );
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return runState;
}
