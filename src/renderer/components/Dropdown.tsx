/* eslint-disable react/require-default-props -- defaultProps 已弃用（React 19 移除），改用默认参数；此规则与此方向冲突 */
/**
 * Dropdown 模板选择组件（重构版）
 *
 * 对齐 FileSelector 重构后的设计语言：
 * - 固定高度 h-10，与 FileSelector 一致
 * - 去掉触发按钮内图标背景块，视觉更轻
 * - 边框、hover、focus 状态与 FileSelector 统一
 * - 列表项图标保留色彩区分（自定义 vs 内置），但尺寸收紧
 * - 下拉列表 z-index 提升，避免被其他元素遮挡
 */

import {
  ChevronDown,
  Edit2,
  FileCode,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import React, {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLanguage } from '../LanguageContext';
import { Template } from '../types/template';

export interface DropdownOption extends Omit<Template, 'name' | 'description'> {
  name: string;
  description: string;
}

interface DropdownProps {
  id?: string;
  options: DropdownOption[];
  onChange: (option: DropdownOption) => void;
  value: DropdownOption | null;
  placeholder: string;
  onEdit?: (template: { id: string }) => void;
  onDelete?: (templateId: string) => void;
  /** 点击 × 时触发，用于清除当前选中的模板 */
  onClear?: () => void;
  /** 外部触发打开：值变化即打开下拉（配合键盘/引导跳转） */
  openSignal?: number;
}

type SourceFilter = 'all' | 'builtin' | 'custom';
type SupportedPlatform = 'darwin' | 'win32' | 'linux';

function getCompatiblePlatforms(command: string): SupportedPlatform[] | null {
  if (/\b(?:h264|hevc)_videotoolbox\b/i.test(command)) {
    return ['darwin'];
  }

  if (/\b(?:h264|hevc)_qsv\b/i.test(command)) {
    return ['win32'];
  }

  if (/\b(?:h264|hevc)_amf\b/i.test(command)) {
    return ['win32'];
  }

  if (/\b(?:h264|hevc)_nvenc\b/i.test(command)) {
    return ['win32', 'linux'];
  }

  return null;
}

function getPlatformLabel(
  platform: SupportedPlatform,
  t: (key: string) => string,
): string {
  if (platform === 'darwin') return t('macOS');
  if (platform === 'win32') return t('Windows');
  return t('Linux');
}

function getCompatibilityBadge(
  option: DropdownOption,
  currentPlatform: string,
  t: (key: string) => string,
): string | null {
  const compatiblePlatforms = getCompatiblePlatforms(option.command);
  if (
    !compatiblePlatforms ||
    compatiblePlatforms.includes(currentPlatform as SupportedPlatform)
  ) {
    return null;
  }

  if (
    compatiblePlatforms.length === 2 &&
    compatiblePlatforms.includes('win32') &&
    compatiblePlatforms.includes('linux')
  ) {
    return t('Windows / Linux');
  }

  return compatiblePlatforms
    .map((platform) => getPlatformLabel(platform, t))
    .join(' / ');
}

function matchesCurrentPlatform(
  option: DropdownOption,
  currentPlatform: string,
): boolean {
  const compatiblePlatforms = getCompatiblePlatforms(option.command);
  return (
    !compatiblePlatforms ||
    compatiblePlatforms.includes(currentPlatform as SupportedPlatform)
  );
}

function Dropdown({
  id,
  options,
  onChange,
  value,
  placeholder,
  onEdit,
  onDelete,
  onClear,
  openSignal = 0,
}: DropdownProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const generatedTriggerId = useId();
  const triggerId = id ?? generatedTriggerId;
  const listRef = useRef<HTMLUListElement>(null);
  const currentPlatform = window.electron.platform;

  const visibleOptions = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return options.filter((option) => {
      // 自动过滤不兼容当前平台的模板
      if (!matchesCurrentPlatform(option, currentPlatform)) {
        return false;
      }

      if (sourceFilter === 'custom' && !option.isCustom) return false;
      if (sourceFilter === 'builtin' && option.isCustom) return false;

      if (!normalizedQuery) return true;

      return [option.name, option.description, option.command].some((field) =>
        field.toLowerCase().includes(normalizedQuery),
      );
    });
  }, [currentPlatform, options, searchQuery, sourceFilter]);

  const groupedOptions = useMemo(() => {
    const customOptions = visibleOptions.filter((option) => option.isCustom);
    const builtinOptions = visibleOptions.filter((option) => !option.isCustom);
    let nextStartIndex = 0;

    const groups: Array<{
      key: string;
      title: string;
      options: DropdownOption[];
      startIndex: number;
    }> = [];

    if (customOptions.length > 0) {
      groups.push({
        key: 'custom',
        title: t('Custom Templates'),
        options: customOptions,
        startIndex: nextStartIndex,
      });
      nextStartIndex += customOptions.length;
    }

    if (builtinOptions.length > 0) {
      groups.push({
        key: 'builtin',
        title: t('Built-in Templates'),
        options: builtinOptions,
        startIndex: nextStartIndex,
      });
    }

    return groups;
  }, [t, visibleOptions]);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setSourceFilter('all');
    setHighlightedIndex(-1);
  }, []);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    resetFilters();
    buttonRef.current?.focus();
  }, [resetFilters]);

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        resetFilters();
      }
    },
    [resetFilters],
  );

  // 外部触发打开（openSignal 每次 +1）
  useEffect(() => {
    if (openSignal > 0) setIsOpen(true);
  }, [openSignal]);

  useEffect(() => {
    if (!isOpen) return undefined;
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDropdown();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [closeDropdown, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const focusTimer = window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const selectedIndex = value
      ? visibleOptions.findIndex((option) => option.id === value.id)
      : -1;

    setHighlightedIndex((previous) => {
      if (visibleOptions.length === 0) return -1;
      if (selectedIndex >= 0) return selectedIndex;
      if (previous < 0 || previous >= visibleOptions.length) return 0;
      return previous;
    });
  }, [isOpen, value, visibleOptions]);

  useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !listRef.current) return;
    const element = listRef.current.querySelector<HTMLElement>(
      `[data-option-index="${highlightedIndex}"]`,
    );
    element?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (visibleOptions.length === 0) {
      setHighlightedIndex(-1);
      return;
    }

    if (highlightedIndex >= visibleOptions.length) {
      setHighlightedIndex(0);
    }
  }, [highlightedIndex, isOpen, visibleOptions.length]);

  const handleOptionClick = useCallback(
    (option: DropdownOption) => {
      onChange(option);
      setIsOpen(false);
      resetFilters();
      buttonRef.current?.focus();
    },
    [onChange, resetFilters],
  );

  const handleClosedKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (
      event.key === 'Enter' ||
      event.key === ' ' ||
      event.key === 'ArrowDown'
    ) {
      event.preventDefault();
      setIsOpen(true);
    }
  }, []);

  const handleOpenKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setHighlightedIndex((previous) =>
            previous < visibleOptions.length - 1 ? previous + 1 : 0,
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex((previous) =>
            previous > 0 ? previous - 1 : visibleOptions.length - 1,
          );
          break;
        case 'Enter':
          if (highlightedIndex >= 0 && visibleOptions[highlightedIndex]) {
            event.preventDefault();
            handleOptionClick(visibleOptions[highlightedIndex]);
          }
          break;
        case 'Tab':
          setIsOpen(false);
          resetFilters();
          break;
        default:
          break;
      }
    },
    [handleOptionClick, highlightedIndex, resetFilters, visibleOptions],
  );

  let triggerIcon = (
    <FileCode
      size={15}
      className="flex-shrink-0 text-slate-400 dark:text-slate-500"
    />
  );
  if (value?.isCustom) {
    triggerIcon = (
      <Sparkles
        size={15}
        className="flex-shrink-0 text-purple-500 dark:text-purple-400"
      />
    );
  } else if (value) {
    triggerIcon = (
      <FileCode
        size={15}
        className="flex-shrink-0 text-primary-500 dark:text-primary-400"
      />
    );
  }

  return (
    <div className="relative h-10" ref={dropdownRef}>
      {/* 主触发按钮 */}
      <button
        ref={buttonRef}
        id={triggerId}
        type="button"
        onClick={() =>
          setIsOpen((open) => {
            if (open) {
              resetFilters();
            }
            return !open;
          })
        }
        onKeyDown={handleClosedKeyDown}
        aria-label={placeholder}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        className={`
          w-full h-full flex items-center gap-2.5 px-3 rounded-xl
          border-2 text-sm font-medium bg-white dark:bg-slate-800
          transition-[border-color,background-color,box-shadow] duration-200 outline-none
          focus-visible:ring-2 focus-visible:ring-primary-500
          focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800
          ${
            isOpen
              ? 'border-primary-400 dark:border-primary-600 shadow-sm'
              : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'
          }
        `}
      >
        {triggerIcon}
        <span
          className={`flex-1 min-w-0 truncate text-left ${
            value ? 'pr-6' : 'pr-1'
          } ${
            value
              ? 'text-slate-800 dark:text-slate-200'
              : 'text-slate-400 dark:text-slate-500'
          }`}
          title={value?.name ?? placeholder}
        >
          {value?.name ?? placeholder}
        </span>
        <ChevronDown
          size={15}
          className={`flex-shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* 清除按钮：仅在有选中值且提供了 onClear 时出现 */}
      {value && onClear && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          aria-label="Clear template selection"
          className="
            absolute right-8 top-1/2 -translate-y-1/2
            w-5 h-5 flex items-center justify-center rounded-md
            text-slate-400 dark:text-slate-500
            hover:text-slate-600 dark:hover:text-slate-300
            hover:bg-slate-100 dark:hover:bg-slate-700
            transition-colors duration-150
          "
        >
          <X size={13} strokeWidth={2.5} />
        </button>
      )}

      {isOpen && (
        <div className="absolute z-50 w-full left-0 mt-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl dark:shadow-black/40 overflow-hidden animate-scale-in origin-top">
          <div className="sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-3 space-y-2.5">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={handleOpenKeyDown}
                placeholder={t('Search by name, description, or command')}
                className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/20 pl-9 pr-3 text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary-500/50"
              />
            </div>

            <div className="flex bg-slate-100 dark:bg-slate-950/60 p-0.5 rounded-lg w-full text-[11px]">
              {(
                [
                  ['all', t('All')],
                  ['builtin', t('Built-in')],
                  ['custom', t('Custom')],
                ] as Array<[SourceFilter, string]>
              ).map(([filter, label]) => {
                const isActive = sourceFilter === filter;
                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setSourceFilter(filter)}
                    className={`flex-1 py-1 text-center font-medium rounded-md transition-all duration-150 outline-none ${
                      isActive
                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm font-semibold'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <ul
            id={listboxId}
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={triggerId}
            aria-activedescendant={
              highlightedIndex >= 0 ? `option-${highlightedIndex}` : undefined
            }
            onKeyDown={handleOpenKeyDown}
            className="max-h-96 overflow-auto"
          >
            {visibleOptions.length === 0 ? (
              <li className="px-4 py-6 text-center text-slate-400 dark:text-slate-500 text-sm">
                {t('No matching templates')}
              </li>
            ) : (
              groupedOptions.map((group) => {
                return (
                  <li key={group.key} role="none">
                    <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/80 dark:bg-slate-900/30 border-y border-slate-100 dark:border-slate-700/50">
                      {group.title}
                    </div>
                    {group.options.map((option, optionIndex) => {
                      const flatIndex = group.startIndex + optionIndex;
                      const isSelected = value?.id === option.id;
                      const isHighlighted = flatIndex === highlightedIndex;
                      const compatibilityBadge = getCompatibilityBadge(
                        option,
                        currentPlatform,
                        t,
                      );
                      let itemStateClass =
                        'hover:bg-slate-50 dark:hover:bg-slate-700/30';
                      if (isSelected) {
                        itemStateClass = 'bg-primary-50 dark:bg-primary-900/20';
                      } else if (isHighlighted) {
                        itemStateClass = 'bg-slate-50 dark:bg-slate-700/40';
                      }

                      return (
                        <div
                          key={option.id}
                          role="none"
                          data-option-index={flatIndex}
                          className={`
                            border-b border-slate-100 dark:border-slate-800/40 last:border-b-0
                            transition-colors duration-100
                            ${itemStateClass}
                          `}
                        >
                          <div className="flex items-center gap-1.5 px-3 py-2">
                            <button
                              type="button"
                              id={`option-${flatIndex}`}
                              role="option"
                              aria-selected={isSelected}
                              onMouseEnter={() =>
                                setHighlightedIndex(flatIndex)
                              }
                              onClick={() => handleOptionClick(option)}
                              className="flex-1 min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg"
                            >
                              <div className="flex items-start gap-2.5 min-w-0">
                                {option.isCustom ? (
                                  <Sparkles
                                    size={14}
                                    className="text-purple-500 dark:text-purple-400 mt-0.5 flex-shrink-0"
                                  />
                                ) : (
                                  <FileCode
                                    size={14}
                                    className="text-slate-400 dark:text-slate-500 mt-0.5 flex-shrink-0"
                                  />
                                )}

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">
                                      {option.name}
                                    </span>

                                    {compatibilityBadge && (
                                      <span className="flex-shrink-0 rounded-full bg-amber-50 dark:bg-amber-900/30 border border-amber-200/70 dark:border-amber-700/50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-200 leading-none">
                                        {compatibilityBadge}
                                      </span>
                                    )}

                                    {isSelected && (
                                      <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary-500 ml-auto" />
                                    )}
                                  </div>

                                  {option.description && (
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                                      {option.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </button>

                            {option.isCustom && (
                              <div className="flex gap-0.5 flex-shrink-0 ml-1">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onEdit?.({ id: option.id });
                                  }}
                                  aria-label={`Edit template ${option.name}`}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onDelete?.(option.id);
                                  }}
                                  aria-label={`Delete template ${option.name}`}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default memo(Dropdown);
