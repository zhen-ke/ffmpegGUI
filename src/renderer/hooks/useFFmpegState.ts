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
  progress: number;
  totalDuration: number;
  lastStartedCommand: string;
  lastCompletedOutputFile: string;
}

type FFmpegAction =
  | { type: 'START'; payload: { command: string } }
  | { type: 'STARTED' }
  | { type: 'STOP' }
  | { type: 'PROGRESS'; payload: { time: number; totalDuration: number } }
  | { type: 'DURATION'; payload: number }
  | { type: 'COMPLETE'; payload: { outputFile: string | null } }
  | { type: 'ERROR' }
  | { type: 'CANCELLED' }
  | { type: 'RESET' };

const initialState: FFmpegState = {
  status: 'idle',
  progress: 0,
  totalDuration: 0,
  lastStartedCommand: '',
  lastCompletedOutputFile: '',
};

function reducer(state: FFmpegState, action: FFmpegAction): FFmpegState {
  switch (action.type) {
    case 'START':
      return {
        status: 'starting',
        progress: 0,
        totalDuration: 0,
        lastStartedCommand: action.payload.command,
        lastCompletedOutputFile: '',
      };
    case 'STARTED':
      return { ...state, status: 'running' };
    case 'STOP':
      if (state.status !== 'running') return state;
      return { ...state, status: 'stopping' };
    case 'DURATION':
      return { ...state, totalDuration: action.payload };
    case 'PROGRESS': {
      const { time, totalDuration } = action.payload;
      const pct =
        totalDuration > 0 ? Math.min(100, (time / totalDuration) * 100) : 0;
      return { ...state, progress: pct };
    }
    case 'COMPLETE':
      return {
        ...state,
        status: 'done',
        progress: 100,
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

interface UseFFmpegStateProps {
  onProgressUpdate?: (currentTime: number) => void;
}

export function useFFmpegState({ onProgressUpdate }: UseFFmpegStateProps = {}) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const onProgressUpdateRef = useLatest(onProgressUpdate);
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
      window.electron.ipcRenderer.on('ffmpeg-duration', (data: unknown) => {
        dispatch({
          type: 'DURATION',
          payload: (data as { duration: number }).duration,
        });
      }),

      window.electron.ipcRenderer.on('ffmpeg-progress', (data: unknown) => {
        const { time } = data as { time: number };
        dispatch({
          type: 'PROGRESS',
          payload: { time, totalDuration: stateRef.current.totalDuration },
        });
        onProgressUpdateRef.current?.(time);
      }),

      window.electron.ipcRenderer.on('ffmpeg-error', () => {
        dispatch({ type: 'ERROR' });
      }),

      window.electron.ipcRenderer.on('ffmpeg-cancelled', () => {
        dispatch({ type: 'CANCELLED' });
      }),

      window.electron.ipcRenderer.on('ffmpeg-complete', (data: unknown) => {
        dispatch({
          type: 'COMPLETE',
          payload: {
            outputFile:
              data &&
              typeof data === 'object' &&
              'outputFile' in data &&
              typeof (data as { outputFile?: unknown }).outputFile === 'string'
                ? (data as { outputFile: string }).outputFile
                : null,
          },
        });
      }),
    ];

    return () => listeners.forEach((remove) => remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flags = deriveFFmpegFlags(state.status);

  return {
    status: state.status,
    progress: state.progress,
    totalDuration: state.totalDuration,
    lastStartedCommand: state.lastStartedCommand,
    lastCompletedOutputFile: state.lastCompletedOutputFile,
    ...flags,
    handleStart,
    handleStop,
  };
}
