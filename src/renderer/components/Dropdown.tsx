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

import { ChevronDown, Edit2, FileCode, Sparkles, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
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
}

function Dropdown({
  id,
  options,
  onChange,
  value,
  placeholder,
  onEdit,
  onDelete,
}: DropdownProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();
  const generatedTriggerId = useId();
  const triggerId = id ?? generatedTriggerId;
  const listRef = useRef<HTMLUListElement>(null);

  // ── 点击外部关闭 ──

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target as Node)
    ) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside, isOpen]);

  // ── Escape 关闭 ──

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // ── 键盘导航 ──

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isOpen) {
        if (
          event.key === 'Enter' ||
          event.key === ' ' ||
          event.key === 'ArrowDown'
        ) {
          event.preventDefault();
          setIsOpen(true);
          if (options.length > 0) {
            setHighlightedIndex(
              value ? options.findIndex((o) => o.id === value.id) : 0,
            );
          }
        }
        return;
      }
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setHighlightedIndex((prev) =>
            prev < options.length - 1 ? prev + 1 : 0,
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : options.length - 1,
          );
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (highlightedIndex >= 0 && options[highlightedIndex]) {
            onChange(options[highlightedIndex]);
            setIsOpen(false);
          }
          break;
        case 'Tab':
          setIsOpen(false);
          break;
        default:
          break;
      }
    },
    [isOpen, options, highlightedIndex, onChange, value],
  );

  // ── 高亮项滚动到可视区 ──

  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const el = listRef.current.children[highlightedIndex] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  const handleOptionClick = useCallback(
    (option: DropdownOption) => {
      onChange(option);
      setIsOpen(false);
      buttonRef.current?.focus();
    },
    [onChange],
  );

  // ── 触发按钮内的图标（裸色，无背景块） ──
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
      {/* ── 触发按钮 ── */}
      <button
        ref={buttonRef}
        id={triggerId}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        onKeyDown={handleKeyDown}
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
        {/* 图标 */}
        {triggerIcon}

        {/* 文字 — 预留右侧空间避免被箭头遮挡 */}
        <span
          className={`flex-1 min-w-0 truncate text-left pr-1 ${
            value
              ? 'text-slate-800 dark:text-slate-200'
              : 'text-slate-400 dark:text-slate-500'
          }`}
          title={value?.name ?? placeholder}
        >
          {value?.name ?? placeholder}
        </span>

        {/* 箭头 */}
        <ChevronDown
          size={15}
          className={`flex-shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* ── 下拉列表 ── */}
      {isOpen && (
        <ul
          id={listboxId}
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={triggerId}
          aria-activedescendant={
            highlightedIndex >= 0 ? `option-${highlightedIndex}` : undefined
          }
          className="absolute z-50 w-full mt-1.5 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl shadow-xl dark:shadow-slate-900/50 max-h-80 overflow-auto"
        >
          {options.length === 0 ? (
            <li className="px-4 py-6 text-center text-slate-400 dark:text-slate-500 text-sm">
              {t('No templates available')}
            </li>
          ) : (
            options.map((option, index) => {
              const isSelected = value?.id === option.id;
              const isHighlighted = index === highlightedIndex;
              let itemStateClass =
                'hover:bg-slate-50 dark:hover:bg-slate-700/30';
              if (isSelected) {
                itemStateClass = 'bg-primary-50 dark:bg-primary-900/20';
              } else if (isHighlighted) {
                itemStateClass = 'bg-slate-50 dark:bg-slate-700/40';
              }

              return (
                <li
                  key={option.id}
                  id={`option-${index}`}
                  role="none"
                  className={`
                    border-b border-slate-50 dark:border-slate-700/50 last:border-b-0
                    transition-colors duration-100
                    ${itemStateClass}
                  `}
                >
                  <div className="flex items-center gap-1 px-3 py-2.5">
                    {/* 选项主体 */}
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleOptionClick(option)}
                      className="flex-1 min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {/* 列表图标：保留小色块区分自定义/内置 */}
                        <div
                          className={`
                            w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-md
                            ${
                              option.isCustom
                                ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                                : 'bg-gradient-to-br from-primary-500 to-cyan-500'
                            }
                          `}
                        >
                          {option.isCustom ? (
                            <Sparkles size={11} className="text-white" />
                          ) : (
                            <FileCode size={11} className="text-white" />
                          )}
                        </div>

                        <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">
                          {option.name}
                        </span>

                        {isSelected && (
                          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary-500 ml-auto" />
                        )}
                      </div>

                      {option.description && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 ml-7 truncate">
                          {option.description}
                        </p>
                      )}
                    </button>

                    {/* 自定义模板的编辑/删除按钮 */}
                    {option.isCustom && (
                      <div className="flex gap-0.5 flex-shrink-0 ml-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit?.({ id: option.id });
                          }}
                          aria-label={`Edit template ${option.name}`}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
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
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

Dropdown.defaultProps = {
  id: undefined,
  onEdit: undefined,
  onDelete: undefined,
};

export default Dropdown;
