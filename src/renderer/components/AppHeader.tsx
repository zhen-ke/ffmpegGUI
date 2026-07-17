/**
 * AppHeader — 顶部导航栏
 *
 * 从 Home.tsx 拆分出来，负责品牌标识、状态指示、语言切换和模板操作入口。
 *
 * v2 改动：
 * - 移除 t prop（直接用 useLanguage hook，消除 props drilling）
 * - 加入三步骤工作流引导（Step indicator），新用户友好
 */

import { PlusCircle, Terminal as TerminalIcon, X, Zap } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useLanguage } from '../LanguageContext';
import type { WorkspacePane } from './DrawerTabBar';

interface AppHeaderProps {
  language: string;
  toggleLanguage: () => void;
  activePane: WorkspacePane;
  openActivityPane: () => void;
  openShellPane: () => void;
  openNewTemplateDialog: () => void;
  workflowLabel: string;
  workflowTone: string;
  commandSourceLabel: string;
  /** 是否已选择模板或输入了命令 */
  hasCommand: boolean;
  /** 是否已选择输入文件 */
  hasInputFile: boolean;
  /** 是否处于运行或停止状态（运行中时不显示步骤引导） */
  isRunning: boolean;
  /** FFmpeg 进度 0-100 */
  progress: number;
  /** 是否显示三步骤引导（已关闭或完成后为 false） */
  showOnboardingGuide: boolean;
  /** 关闭三步骤引导 */
  onDismissGuide: () => void;
}

export function AppHeader({
  language,
  toggleLanguage,
  activePane,
  openActivityPane,
  openShellPane,
  openNewTemplateDialog,
  workflowLabel,
  workflowTone,
  commandSourceLabel,
  hasCommand,
  hasInputFile,
  isRunning,
  progress,
  showOnboardingGuide,
  onDismissGuide,
}: AppHeaderProps) {
  const { t } = useLanguage();
  const isMac = window.electron.platform === 'darwin';

  // ── 进度 + ETA（EMA 平滑，避免跳变 / Infinity） ──
  const rateRef = useRef(0); // % per ms
  const lastProgressRef = useRef(0);
  const lastTimeRef = useRef(0);
  useEffect(() => {
    if (!isRunning) {
      rateRef.current = 0;
      lastProgressRef.current = 0;
      lastTimeRef.current = 0;
      return;
    }
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

  const clampedProgress = Math.max(0, Math.min(100, progress));
  const showEta =
    isRunning &&
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

  // ── 步骤引导逻辑 ─────────────────────────────────────────
  // step 1: 选择模板或输入命令
  // step 2: 选择输入文件
  // step 3: 点击开始（Ready 状态）
  const step1Done = hasCommand;
  const step2Done = step1Done && hasInputFile;
  const step3Active = step2Done; // ready to run

  const steps = [
    {
      key: 'template',
      label: language === 'zh' ? '选择模板' : 'Choose template',
      done: step1Done,
      active: !step1Done,
    },
    {
      key: 'input',
      label: language === 'zh' ? '选择输入文件' : 'Pick input file',
      done: step2Done,
      active: step1Done && !step2Done,
    },
    {
      key: 'start',
      label: language === 'zh' ? '点击开始' : 'Click start',
      done: false,
      active: step3Active,
    },
  ];

  return (
    <header
      className={`flex-shrink-0 pb-1.5 border-b border-slate-200/60 dark:border-slate-700/60 shadow-sm z-20 transition-all duration-300 ${
        isMac
          ? 'pt-6 pl-24 pr-6 bg-white/60 dark:bg-slate-900/40 backdrop-blur-md'
          : 'pt-2 px-4 sm:px-6 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        {/* 品牌区 */}
        <div className="flex items-center gap-3 justify-start min-w-0">
          <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-md shadow-primary-500/20 flex-shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight text-balance">
              {t('FFmpeg Tool')}
            </h1>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
              {t('Video & Audio Processing')}
            </p>
          </div>
        </div>

        {/* 右侧操作按钮 */}
        <div className="flex items-center gap-2 justify-end flex-wrap">
          <button
            type="button"
            onClick={
              activePane === 'terminal' ? openActivityPane : openShellPane
            }
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-600/50 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200/60 dark:border-slate-600/50 transition-colors duration-200"
          >
            <TerminalIcon size={14} />
            {activePane === 'terminal' ? t('Show Activity') : t('Open Shell')}
          </button>
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={
              language === 'en'
                ? 'Switch language to Chinese'
                : 'Switch language to English'
            }
            className="px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-600/50 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200/60 dark:border-slate-600/50 transition-colors duration-200"
          >
            {language === 'en' ? '中文' : 'EN'}
          </button>
          <button
            type="button"
            onClick={openNewTemplateDialog}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg border border-primary-200/60 dark:border-primary-700/30 transition-[background-color,box-shadow,color] duration-200 hover:shadow-sm"
          >
            <PlusCircle size={14} />
            {t('Add Template')}
          </button>
        </div>
      </div>

      {/* 状态行 */}
      <div className="mt-2 flex items-center gap-3 flex-wrap">
        {/* 工作流状态 pill */}
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold flex-shrink-0 ${workflowTone}`}
        >
          {workflowLabel}
        </span>

        {/* 运行中：进度条 + ETA */}
        {isRunning && (
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
        )}

        {/* 三步骤引导（可 × 关闭 / 完成后自动隐藏） */}
        {showOnboardingGuide && !isRunning && !step2Done && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {steps.map((step, index) => (
              <div key={step.key} className="flex items-center gap-1.5">
                {index > 0 && (
                  <span className="text-slate-300 dark:text-slate-600 text-[10px] select-none">
                    →
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors duration-200 ${
                    step.done
                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-700/30'
                      : step.active
                        ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 border border-primary-200/60 dark:border-primary-700/30'
                        : 'text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/30'
                  }`}
                >
                  {step.done ? (
                    <span className="text-[9px]">✓</span>
                  ) : (
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        step.active
                          ? 'bg-primary-500 animate-pulse'
                          : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    />
                  )}
                  {step.label}
                </span>
              </div>
            ))}
            <button
              type="button"
              onClick={onDismissGuide}
              aria-label={t("Don't show again")}
              title={t("Don't show again")}
              className="ml-1 w-5 h-5 flex items-center justify-center rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors duration-150"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </div>
        )}

        {/* 当已就绪或在运行时，显示命令来源标签 */}
        {(step2Done || isRunning) && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {commandSourceLabel}
          </span>
        )}
      </div>
    </header>
  );
}
