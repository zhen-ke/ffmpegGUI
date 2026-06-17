/**
 * AppHeader — 顶部导航栏
 *
 * 从 Home.tsx 拆分出来，负责品牌标识、状态指示、语言切换和模板操作入口。
 *
 * v2 改动：
 * - 移除 t prop（直接用 useLanguage hook，消除 props drilling）
 * - 加入三步骤工作流引导（Step indicator），新用户友好
 */

import { PlusCircle, Terminal as TerminalIcon, Zap } from 'lucide-react';
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
}: AppHeaderProps) {
  const { t } = useLanguage();
  const isMac = window.electron.platform === 'darwin';

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
      className={`flex-shrink-0 pb-2.5 border-b border-slate-200/60 dark:border-slate-700/60 shadow-sm z-20 transition-all duration-300 ${
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
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        {/* 工作流状态 pill */}
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold flex-shrink-0 ${workflowTone}`}
        >
          {workflowLabel}
        </span>

        {/* 三步骤引导（仅在非运行时且未完成所有步骤时显示） */}
        {!isRunning && !step2Done && (
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
