/**
 * WorkspaceDrawer — 底部抽屉区域
 *
 * 从 Home.tsx 拆分出来，负责 DrawerTabBar + 内容面板（FFmpegTerminal / Terminal / 折叠占位）。
 */

import { Play, Terminal as TerminalIcon } from 'lucide-react';
import type { MutableRefObject } from 'react';
import {
  DrawerSize,
  DrawerTabBar,
  type WorkspacePane,
} from './DrawerTabBar';
import {
  FFmpegTerminal,
  type TerminalLogType,
} from './FFmpegTerminal';
import Terminal from './Terminal/Terminal';

const DRAWER_HEIGHT: Record<DrawerSize, number> = {
  sm: 48,
  md: 260,
  lg: 420,
};

interface WorkspaceDrawerProps {
  activePane: WorkspacePane;
  onActivePaneChange: (pane: WorkspacePane) => void;
  drawerSize: DrawerSize;
  onDrawerSizeChange: (s: DrawerSize) => void;
  canStop: boolean;
  isRunning: boolean;
  isStopping: boolean;
  progress: number;
  onStop: () => void;
  onCopyLogs: () => void;
  xtermClearRef: MutableRefObject<(() => void) | null>;
  xtermCopyRef: MutableRefObject<(() => string) | null>;
  xtermWriteLogRef: MutableRefObject<
    ((type: TerminalLogType, message: string) => void) | null
  >;
  t: (key: string) => string;
}

export function WorkspaceDrawer({
  activePane,
  onActivePaneChange,
  drawerSize,
  onDrawerSizeChange,
  canStop,
  isRunning,
  isStopping,
  progress,
  onStop,
  onCopyLogs,
  xtermClearRef,
  xtermCopyRef,
  xtermWriteLogRef,
  t,
}: WorkspaceDrawerProps) {
  return (
    <div className="flex-shrink-0 flex flex-col">
      <DrawerTabBar
        activePane={activePane}
        onActivePaneChange={onActivePaneChange}
        canStop={canStop}
        isRunning={isRunning}
        isStopping={isStopping}
        progress={progress}
        onStop={onStop}
        onClearLogs={() => xtermClearRef.current?.()}
        onCopyLogs={onCopyLogs}
        drawerSize={drawerSize}
        onDrawerSizeChange={onDrawerSizeChange}
      />

      <div
        style={{
          height: DRAWER_HEIGHT[drawerSize],
          transition: 'height 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
        }}
        className="bg-white dark:bg-slate-900 relative"
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            visibility:
              drawerSize === 'sm' || activePane !== 'activity'
                ? 'hidden'
                : 'visible',
            pointerEvents:
              drawerSize === 'sm' || activePane !== 'activity'
                ? 'none'
                : 'auto',
          }}
        >
          <FFmpegTerminal
            onClearRef={xtermClearRef}
            onCopyRef={xtermCopyRef}
            onWriteLogRef={xtermWriteLogRef}
          />
        </div>

        {drawerSize !== 'sm' && activePane === 'terminal' && (
          <div className="absolute inset-0 bg-[#0B1120]">
            <Terminal />
          </div>
        )}

        {drawerSize === 'sm' && (
          <div className="h-full flex flex-col items-center justify-center pointer-events-none select-none">
            <div className="relative mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-xl flex items-center justify-center shadow-inner">
                <TerminalIcon
                  size={24}
                  className="text-slate-400 dark:text-slate-500"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                <Play size={8} className="text-white ml-0.5" />
              </div>
            </div>
            <p className="text-slate-400 dark:text-slate-500 font-medium text-sm">
              {activePane === 'activity'
                ? t('Activity stays here while the converter stays above.')
                : t(
                    'Open a shell for quick checks without leaving the converter.',
                  )}
            </p>
            <p className="text-slate-300 dark:text-slate-600 text-xs mt-1">
              {activePane === 'activity'
                ? t('Select a template or enter a command to begin')
                : t('Open Shell')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
