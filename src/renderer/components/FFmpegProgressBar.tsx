/**
 * FFmpegProgressBar — 隔离的高频进度渲染单元
 *
 * 设计动机（Home.tsx 重构的一部分）：
 * useFFmpegState 原先把 ffmpeg-progress 每帧 dispatch 进 reducer，导致消费该 hook
 * 的 Home（~千行）整棵树按 ffmpeg 进度帧率重渲。此处把 progress/duration 订阅
 * 下放到真正显示进度的叶子组件内部，Home 不再持有 progress，进度帧只重渲本组件。
 *
 * 同时修复 DURATION/PROGRESS 事件顺序竞态：若 DURATION 晚于首条 PROGRESS 到达，
 * 原实现因 totalDuration 仍为 0 而显示 0%。这里在 DURATION 到达时用已记录的最新
 * time 回填百分比，进度立即正确。
 */
import { memo, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../LanguageContext';
import { onFFmpegEvent } from '../ipc/ffmpegEvents';

interface FFmpegProgressBarProps {
  isRunning: boolean;
  language: string;
}

function computePct(time: number, duration: number): number {
  return duration > 0 ? Math.min(100, (time / duration) * 100) : 0;
}

function FFmpegProgressBar({ isRunning, language }: FFmpegProgressBarProps) {
  const { t } = useLanguage();
  const [progress, setProgress] = useState(0);

  // 最新已处理时间 / 总时长（秒），用 ref 跨事件保留，避免竞态丢值
  const timeRef = useRef(0);
  const durationRef = useRef(0);

  // ETA EMA 平滑（从原 AppHeader 移植，避免跳变 / Infinity）
  const rateRef = useRef(0);
  const lastProgressRef = useRef(0);
  const lastTimeRef = useRef(0);

  // 订阅 progress / duration：组件常驻即挂载，跨多次运行复用监听器
  useEffect(() => {
    const unlistenProgress = onFFmpegEvent('ffmpeg-progress', ({ time }) => {
      timeRef.current = time;
      setProgress(computePct(time, durationRef.current));
    });
    const unlistenDuration = onFFmpegEvent(
      'ffmpeg-duration',
      ({ duration }) => {
        durationRef.current = duration;
        // 竞态修复：DURATION 晚到时用最新 time 回填，不再卡在 0%
        setProgress(computePct(timeRef.current, duration));
      },
    );
    return () => {
      unlistenProgress();
      unlistenDuration();
    };
  }, []);

  // 运行结束 → 清空，避免下次运行残留 100%
  useEffect(() => {
    if (isRunning) return;
    setProgress(0);
    timeRef.current = 0;
    durationRef.current = 0;
    rateRef.current = 0;
    lastProgressRef.current = 0;
    lastTimeRef.current = 0;
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning) return;
    const now = performance.now();
    const prevP = lastProgressRef.current;
    const prevT = lastTimeRef.current;
    if (prevT > 0 && progress > prevP) {
      const dt = now - prevT;
      const dp = progress - prevP;
      if (dt > 0) {
        const inst = dp / dt;
        rateRef.current =
          rateRef.current === 0 ? inst : rateRef.current * 0.7 + inst * 0.3;
      }
    }
    lastProgressRef.current = progress;
    lastTimeRef.current = now;
  }, [progress, isRunning]);

  if (!isRunning) return null;

  const clampedProgress = Math.max(0, Math.min(100, progress));
  const showEta =
    clampedProgress > 3 &&
    rateRef.current > 0 &&
    Number.isFinite(rateRef.current);
  let etaLabel: string | null = null;
  if (showEta) {
    const remainingMs = (100 - clampedProgress) / rateRef.current;
    const totalSec = Math.min(
      99 * 60,
      Math.max(1, Math.round(remainingMs / 1000)),
    );
    const mm = Math.floor(totalSec / 60);
    const ss = totalSec % 60;
    etaLabel =
      language === 'zh'
        ? `${t('Estimated remaining')} ${mm}分${ss}秒`
        : `${t('Estimated remaining')} ${mm}m ${ss}s`;
  }

  return (
    <div className="flex items-center gap-2 flex-1 min-w-[140px]">
      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary-500 to-cyan-500 transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
      <span className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 tabular-nums flex-shrink-0">
        {clampedProgress.toFixed(0)}%
      </span>
      {etaLabel && (
        <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums flex-shrink-0 hidden sm:inline">
          {etaLabel}
        </span>
      )}
    </div>
  );
}

export default memo(FFmpegProgressBar);
