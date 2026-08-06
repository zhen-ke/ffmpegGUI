/**
 * ProgressBar — 下载/解压等任务的横向进度条
 */

export default function ProgressBar({
  progress,
  color,
  label,
}: {
  progress: number;
  color: string;
  label: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
          {label}
        </span>
        <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
          {progress}%
        </span>
      </div>
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
        <div
          className={`${color} h-full rounded-full transition-all duration-500 ease-out shadow-sm`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
