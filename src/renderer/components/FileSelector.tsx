/**
 * 文件选择器组件
 * 可复用的文件/文件夹选择按钮
 */

interface FileSelectorProps {
  type: 'input' | 'output';
  value: string;
  onSelect: () => Promise<void>;
  onClear: () => void;
  label: string;
}

export function FileSelector({
  type,
  value,
  onSelect,
  onClear,
  label,
}: FileSelectorProps) {
  const colorScheme =
    type === 'input'
      ? {
          filled:
            'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300',
          empty:
            'bg-white border-gray-300 hover:border-gray-400 text-gray-600 dark:bg-[#0d1117] dark:border-gray-700 dark:text-gray-400',
          hover: 'hover:bg-blue-200 dark:hover:bg-blue-800',
        }
      : {
          filled:
            'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300',
          empty:
            'bg-white border-gray-300 hover:border-gray-400 text-gray-600 dark:bg-[#0d1117] dark:border-gray-700 dark:text-gray-400',
          hover: 'hover:bg-amber-200 dark:hover:bg-amber-800',
        };

  const icon =
    type === 'input' ? (
      <svg
        className="w-4 h-4 opacity-50"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>
    ) : (
      <svg
        className="w-4 h-4 opacity-50"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
        />
      </svg>
    );

  const displayValue = value ? value.split(/[/\\]/).pop() : label;

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={onSelect}
        aria-label={label}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm border rounded-lg transition-all duration-200 ${
          value ? colorScheme.filled : colorScheme.empty
        }`}
      >
        <span className="truncate flex-1 text-left mr-2" title={value || label}>
          {displayValue}
        </span>
        {!value && icon}
      </button>
      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear ${label}`}
          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 ${colorScheme.hover} rounded-full cursor-pointer`}
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
