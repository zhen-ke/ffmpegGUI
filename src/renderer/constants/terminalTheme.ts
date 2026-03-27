/**
 * 共享终端主题常量
 *
 * useXterm 和 useTerminal 共用，避免重复定义。
 */

import type { ITheme } from 'xterm';

export const TERMINAL_THEME: ITheme = {
  background: '#0D1117',
  foreground: '#E6EDF3',
  cursor: '#58A6FF',
  cursorAccent: '#0D1117',
  selectionBackground: 'rgba(88,166,255,0.3)',
  black: '#21262D',
  brightBlack: '#6E7681',
  red: '#FF7B72',
  brightRed: '#FFA198',
  green: '#3FB950',
  brightGreen: '#56D364',
  yellow: '#D29922',
  brightYellow: '#E3B341',
  blue: '#58A6FF',
  brightBlue: '#79C0FF',
  magenta: '#BC8CFF',
  brightMagenta: '#D2A8FF',
  cyan: '#39C5CF',
  brightCyan: '#56D4DD',
  white: '#B1BAC4',
  brightWhite: '#F0F6FC',
};
