/**
 * FFmpeg 状态管理 Hook（状态机版）
 *
 * 用有限状态机替代原来的双布尔值（isRunning + isStopping），
 * 消除非法状态组合，UI 判断逻辑更清晰。
 *
 * 状态流转：
 *   idle ──start──▶ starting ──started──▶ running ──stop──▶ stopping ──cancelled/error──▶ idle
 *                       │                       │                                              ▲
 *                       └── error ──────────────┴──────────────── complete/error ─────────┘
 *
 * `starting` 是异步 invoke 与 STARTED 之间的中间态，期间 canStart=false，
 * 避免连点 Start 触发竞态（dispatch START 后 status 不再是 idle）。
 */

import { useCallback, useEffect, useReducer } from 'react';
import { onFFmpegEvent } from '../ipc/ffmpegEvents';
import { useLatest } from './useLatest';

// ========== 状态机类型 ==========

export type FFmpegStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'done'
  | 'error';

interface FFmpegState {
  status: FFmpegStatus;
  lastStartedCommand: string;
  lastCompletedOutputFile: string;
}

type FFmpegAction =
  | { type: 'START'; payload: { command: string } }
  | { type: 'STARTED' }
  | { type: 'STOP' }
  | { type: 'COMPLETE'; payload: { outputFile: string | null } }
  | { type: 'ERROR' }
  | { type: 'CANCELLED' }
  | { type: 'RESET' };

const initialState: FFmpegState = {
  status: 'idle',
  lastStartedCommand: '',
  lastCompletedOutputFile: '',
};

function reducer(state: FFmpegState, action: FFmpegAction): FFmpegState {
  switch (action.type) {
    case 'START':
      return {
        status: 'starting',
        lastStartedCommand: action.payload.command,
        lastCompletedOutputFile: '',
      };
    case 'STARTED':
      return { ...state, status: 'running' };
    case 'STOP':
      if (state.status !== 'running') return state;
      return { ...state, status: 'stopping' };
    case 'COMPLETE':
      return {
        ...state,
        status: 'done',
        lastCompletedOutputFile: action.payload.outputFile ?? '',
      };
    case 'ERROR':
      return { ...state, status: 'error' };
    case 'CANCELLED':
      return { ...state, status: 'idle' };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// ========== 派生布尔值 ==========

export function deriveFFmpegFlags(status: FFmpegStatus) {
  return {
    isRunning: status === 'running' || status === 'stopping',
    isStopping: status === 'stopping',
    isIdle: status === 'idle' || status === 'done' || status === 'error',
    // starting / running / stopping 期间都禁止再次启动，杜绝连点竞态
    canStart: status === 'idle' || status === 'done' || status === 'error',
    canStop: status === 'running',
  };
}

// ========== Hook ==========

/**
 * FFmpeg 状态机 Hook（status-only）。
 *
 * 只跟踪低频状态流转（idle/starting/running/stopping/done/error）；
 * 高频的 progress / duration 不再进入 reducer——避免消费此 hook 的
 * Home 随进度帧整树重渲。进度订阅已下放到 FFmpegProgressBar 内部。
 */
export function useFFmpegState() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const stateRef = useLatest(state);

  const handleStart = useCallback((command: string) => {
    const trimmed = command?.trim();
    if (!trimmed) return;

    dispatch({ type: 'START', payload: { command: trimmed } });

    window.electron.ipcRenderer
      .invoke('start-ffmpeg', trimmed)
      .then((result: unknown) => {
        if (
          result &&
          typeof result === 'object' &&
          'success' in result &&
          (result as { success: boolean }).success === true
        ) {
          dispatch({ type: 'STARTED' });
        } else {
          dispatch({ type: 'ERROR' });
        }
        return undefined;
      })
      .catch(() => {
        dispatch({ type: 'ERROR' });
        return undefined;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStop = useCallback(() => {
    if (stateRef.current.status !== 'running') return;

    window.electron.ipcRenderer
      .invoke('stop-ffmpeg')
      .then((result: unknown) => {
        if (
          result &&
          typeof result === 'object' &&
          'success' in result &&
          (result as { success: boolean }).success === true
        ) {
          dispatch({ type: 'STOP' });
        }
        return undefined;
      })
      .catch(() => {
        // stop 失败由 ffmpeg-error 事件处理
        return undefined;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const listeners = [
      onFFmpegEvent('ffmpeg-error', () => {
        dispatch({ type: 'ERROR' });
      }),

      onFFmpegEvent('ffmpeg-cancelled', () => {
        dispatch({ type: 'CANCELLED' });
      }),

      onFFmpegEvent('ffmpeg-complete', ({ outputFile }) => {
        dispatch({ type: 'COMPLETE', payload: { outputFile } });
      }),
    ];

    return () => listeners.forEach((remove) => remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flags = deriveFFmpegFlags(state.status);

  return {
    status: state.status,
    lastStartedCommand: state.lastStartedCommand,
    lastCompletedOutputFile: state.lastCompletedOutputFile,
    ...flags,
    handleStart,
    handleStop,
  };
}
