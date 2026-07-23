/**
 * AppHeader — 顶部导航栏
 *
 * v3 改动：
 * - 移除 Header 内 Activity/Shell 切换（统一由底部抽屉 Tab 负责）
 * - 四步引导：命令 → 输入 → 输出 → 开始，支持点击跳转
 * - 就绪状态依赖完整 Setup（命令 + 输入 + 输出）
 */

import { PlusCircle, X, Zap } from 'lucide-react';
import { memo } from 'react';
import { useLanguage } from '../LanguageContext';
import FFmpegProgressBar from './FFmpegProgressBar';

export type GuideStep = 'template' | 'input' | 'output' | 'start';

interface AppHeaderProps {
  language: string;
  toggleLanguage: () => void;
  openNewTemplateDialog: () => void;
  workflowLabel: string;
  workflowTone: string;
  commandSourceLabel: string;
  hasCommand: boolean;
  hasInputFile: boolean;
  hasOutputReady: boolean;
  isReadyToRun: boolean;
  isRunning: boolean;
  showOnboardingGuide: boolean;
  onDismissGuide: () => void;
  onGuideStepClick: (step: GuideStep) => void;
}

function AppHeaderImpl({
  language,
  toggleLanguage,
  openNewTemplateDialog,
  workflowLabel,
  workflowTone,
  commandSourceLabel,
  hasCommand,
  hasInputFile,
  hasOutputReady,
  isReadyToRun,
  isRunning,
  showOnboardingGuide,
  onDismissGuide,
  onGuideStepClick,
}: AppHeaderProps) {
  const { t } = useLanguage();
  const isMac = window.electron.platform === 'darwin';

  // 进度 + ETA 已移至 FFmpegProgressBar：高频 progress 订阅下放到叶子组件，
  // AppHeader 不再持有 progress，Home 不再随进度帧重渲整树。

  const steps: Array<{
    key: GuideStep;
    label: string;
    done: boolean;
    active: boolean;
  }> = [
    {
      key: 'template',
      label: language === 'zh' ? '选择模板' : 'Choose template',
      done: hasCommand,
      active: !hasCommand,
    },
    {
      key: 'input',
      label: language === 'zh' ? '选择输入文件' : 'Pick input file',
      done: hasInputFile,
      active: hasCommand && !hasInputFile,
    },
    {
      key: 'output',
      label: language === 'zh' ? '选择输出位置' : 'Pick output',
      done: hasOutputReady,
      active: hasCommand && hasInputFile && !hasOutputReady,
    },
    {
      key: 'start',
      label: language === 'zh' ? '点击开始' : 'Click start',
      done: false,
      active: isReadyToRun,
    },
  ];

  const getStepToneClass = (step: (typeof steps)[number]) => {
    if (step.done) {
      return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-700/30';
    }
    if (step.active) {
      return 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 border border-primary-200/60 dark:border-primary-700/30';
    }
    return 'text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/30';
  };

  const renderStep = (step: (typeof steps)[number], index: number) => (
    <div key={step.key} className="flex items-center gap-1.5">
      {index > 0 && (
        <span className="text-slate-300 dark:text-slate-600 text-[10px] select-none">
          →
        </span>
      )}
      <button
        type="button"
        onClick={() => onGuideStepClick(step.key)}
        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors duration-200 cursor-pointer hover:brightness-95 dark:hover:brightness-110 ${getStepToneClass(step)}`}
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
      </button>
    </div>
  );

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
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold flex-shrink-0 ${workflowTone}`}
        >
          {workflowLabel}
        </span>

        {/* 进度条：高频订阅已下放到 FFmpegProgressBar 内部；组件内部按 isRunning 自门控 */}
        <FFmpegProgressBar isRunning={isRunning} language={language} />

        {showOnboardingGuide && !isRunning && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {steps.map(renderStep)}
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

        {(isReadyToRun || isRunning) && !showOnboardingGuide && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {commandSourceLabel}
          </span>
        )}
      </div>
    </header>
  );
}

export const AppHeader = memo(AppHeaderImpl);
