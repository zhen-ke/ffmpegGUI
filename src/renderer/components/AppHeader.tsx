/**
 * AppHeader — 顶部导航栏
 *
 * 从 Home.tsx 拆分出来，负责品牌标识、状态指示、语言切换和模板操作入口。
 */

import {
  PlusCircle,
  Terminal as TerminalIcon,
  Zap,
} from 'lucide-react';
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
  t: (key: string) => string;
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
  t,
}: AppHeaderProps) {
  return (
    <header className="flex-shrink-0 px-4 pt-2 pb-2.5 sm:px-6 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-b border-slate-200/60 dark:border-slate-700/60 shadow-sm z-20">
      <div className="flex items-center justify-between gap-4">
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

      <div className="mt-3 flex flex-col gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${workflowTone}`}
            >
              {workflowLabel}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {commandSourceLabel}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
