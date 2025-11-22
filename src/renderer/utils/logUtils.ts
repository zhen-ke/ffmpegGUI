/**
 * 日志格式化工具函数
 * 提供日志格式化和 HTML 生成功能
 */

export type LogType = 'info' | 'error' | 'success';

interface LogStyle {
  color: string;
  bg: string;
  icon: string;
}

/**
 * 日志样式配置
 */
const LOG_STYLES: Record<LogType, LogStyle> = {
  error: {
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20',
    icon: '✕',
  },
  success: {
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20',
    icon: '✓',
  },
  info: {
    color: 'text-slate-700 dark:text-slate-300',
    bg: 'hover:bg-gray-50 dark:hover:bg-white/5 border-transparent',
    icon: '➜',
  },
};

/**
 * 格式化日志消息为 HTML
 * @param type 日志类型
 * @param message 日志消息
 * @returns 格式化的 HTML 字符串
 */
export function formatLog(type: LogType, message: string): string {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  const style = LOG_STYLES[type] || LOG_STYLES.info;

  // 生成结构化的 HTML
  const logHtml = `
    <div class="group flex items-start gap-3 px-4 text-sm font-mono border-b border-dashed border-gray-200 dark:border-gray-800 last:border-0 transition-colors ${style.bg}">
      <span class="flex-shrink-0 w-5 text-center ${style.color} opacity-70 font-bold select-none">${style.icon}</span>
      <span class="flex-shrink-0 text-xs text-gray-400 select-none pt-0.5 group-hover:text-gray-500 dark:group-hover:text-gray-300 transition-colors">[${time}]</span>
      <span class="flex-1 break-all whitespace-pre-wrap leading-relaxed ${style.color}">${message}</span>
    </div>
  `;

  return logHtml;
}

/**
 * 从 HTML 字符串中移除所有标签
 * 用于复制纯文本日志
 *
 * @param html HTML 字符串
 * @returns 纯文本
 */
export function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

/**
 * 批量格式化日志数组
 * @param logs 日志数组
 * @returns 合并的 HTML 字符串
 */
export function formatLogs(
  logs: Array<{ type: LogType; message: string }>,
): string {
  return logs.map(({ type, message }) => formatLog(type, message)).join('');
}
