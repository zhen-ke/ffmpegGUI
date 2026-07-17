/**
 * PipelineStrip — 输入 → 命令 → 输出 管线可视化
 *
 * 一眼确认「进什么、执行什么、出什么」。
 * - 三段 chip：Input / Command / Output，未绑定时显示虚线占位。
 * - 选中模板时命令段显示模板名，否则回退到命令前 N 字。
 * - 三者皆空时整条隐藏，避免噪音。
 */

import { ChevronRight, Cpu, FileInput, FileOutput } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface PipelineStripProps {
  inputFiles: string[];
  command: string;
  finalOutputPath: string;
  templateName?: string | null;
}

function basename(p: string): string {
  if (!p) return '';
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return i >= 0 ? p.slice(i + 1) : p;
}

export function PipelineStrip({
  inputFiles,
  command,
  finalOutputPath,
  templateName,
}: PipelineStripProps) {
  const { t } = useLanguage();

  const hasInput = inputFiles.length > 0 && !!inputFiles[0];
  const hasCommand = command.trim().length > 0;
  const hasOutput = !!finalOutputPath;

  // 三者皆空时不渲染，减噪
  if (!hasInput && !hasCommand && !hasOutput) return null;

  const inputFile = hasInput ? basename(inputFiles[0]) : '';
  const extraInputs = inputFiles.length > 1 ? ` +${inputFiles.length - 1}` : '';
  let cmdSummary = '';
  if (templateName) {
    cmdSummary = templateName;
  } else if (hasCommand) {
    cmdSummary = command.length > 24 ? `${command.slice(0, 24)}…` : command;
  }
  const outFile = hasOutput ? basename(finalOutputPath) : '';

  const chipBase =
    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium min-w-0';
  const filled =
    'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-600/60';
  const empty =
    'bg-transparent text-slate-400 dark:text-slate-500 border border-dashed border-slate-300 dark:border-slate-600';

  return (
    <div
      className="flex items-center gap-1 flex-wrap"
      role="group"
      aria-label={t('Pipeline')}
    >
      {/* Input */}
      <div
        className={`${chipBase} ${hasInput ? filled : empty}`}
        title={hasInput ? inputFiles[0] : t('No input')}
      >
        <FileInput size={13} className="flex-shrink-0" />
        <span className="truncate max-w-[120px]">
          {hasInput ? `${inputFile}${extraInputs}` : t('No input')}
        </span>
      </div>

      <ChevronRight
        size={14}
        className="text-slate-300 dark:text-slate-600 flex-shrink-0"
      />

      {/* Command */}
      <div
        className={`${chipBase} ${hasCommand ? filled : empty}`}
        title={hasCommand ? (templateName ?? command) : t('No command')}
      >
        <Cpu size={13} className="flex-shrink-0" />
        <span className="truncate max-w-[200px] font-mono">
          {hasCommand ? cmdSummary : t('No command')}
        </span>
      </div>

      <ChevronRight
        size={14}
        className="text-slate-300 dark:text-slate-600 flex-shrink-0"
      />

      {/* Output */}
      <div
        className={`${chipBase} ${hasOutput ? filled : empty}`}
        title={hasOutput ? finalOutputPath : t('No output')}
      >
        <FileOutput size={13} className="flex-shrink-0" />
        <span className="truncate max-w-[160px]">
          {hasOutput ? outFile : t('No output')}
        </span>
      </div>
    </div>
  );
}
