/**
 * WorkspaceDrawer — 底部抽屉区域
 *
 * v2：抽屉高度所有权收归于此（px 单一真相源），drawerSize 退化为派生高亮态。
 * - 拖拽 resize 手柄（只缩放内容区，标签栏常驻）
 * - 运行时自动展开到 lg、结束后恢复
 * - 切 pane 时若折叠则展开
 * - toggle / sm·md·lg 三档按钮映射到目标 px
 */

import { Play, Terminal as TerminalIcon } from 'lucide-react';
import type React from 'react';
import { memo, useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { DrawerSize, DrawerTabBar, type WorkspacePane } from './DrawerTabBar';
import { FFmpegTerminal, type TerminalLogType } from './FFmpegTerminal';
import Terminal from './Terminal/Terminal';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useLatest } from '../hooks/useLatest';

const PX_TARGETS: Record<DrawerSize, number> = { sm: 0, md: 260, lg: 470 };
const LS_PX_KEY = 'ffmpeg-drawer-px-v1';

function deriveDrawerSize(px: number): DrawerSize {
  if (px <= 0) return 'sm';
  if (px >= PX_TARGETS.lg) return 'lg';
  return 'md';
}

interface WorkspaceDrawerProps {
  activePane: WorkspacePane;
  onActivePaneChange: (pane: WorkspacePane) => void;
  canStop: boolean;
  isRunning: boolean;
  isStopping: boolean;
  onStop: () => void;
  onCopyLogs: () => void;
  xtermClearRef: MutableRefObject<(() => void) | null>;
  xtermCopyRef: MutableRefObject<(() => string) | null>;
  xtermWriteLogRef: MutableRefObject<
    ((type: TerminalLogType, message: string) => void) | null
  >;
  /** 父级调用可展开抽屉（若折叠）——Start / 切 pane 时自动弹出日志 */
  onExpandRef: MutableRefObject<(() => void) | null>;
  t: (key: string) => string;
}

function WorkspaceDrawerImpl({
  activePane,
  onActivePaneChange,
  canStop,
  isRunning,
  isStopping,
  onStop,
  onCopyLogs,
  xtermClearRef,
  xtermCopyRef,
  xtermWriteLogRef,
  onExpandRef,
  t,
}: WorkspaceDrawerProps) {
  // ── 抽屉高度（px 单一真相源）──
  const [drawerHeightPx, setDrawerHeightPx] = useLocalStorage<number>(
    LS_PX_KEY,
    PX_TARGETS.md,
    {
      // 读写自带 try/catch，写入自动持久化，取代手写 persist
      serialize: String,
      deserialize: (raw) => {
        const n = Number(raw);
        return Number.isFinite(n) && n >= 0 ? n : PX_TARGETS.md;
      },
    },
  );
  const lastNonZeroRef = useRef<number>(drawerHeightPx || PX_TARGETS.md);
  const preRunHeightRef = useRef<number>(drawerHeightPx);
  // useLatest 统一管理渲染期 ref 同步，替代手写 heightRef.current = drawerHeightPx
  const heightRef = useLatest(drawerHeightPx);

  // 派生高亮态（仅用于三档按钮的选中视觉）
  const drawerSize = deriveDrawerSize(drawerHeightPx);

  const setSizeTarget = useCallback(
    (sz: DrawerSize) => {
      const px = PX_TARGETS[sz];
      setDrawerHeightPx(px);
      if (px > 0) lastNonZeroRef.current = px;
      // 持久化由 useLocalStorage 自动完成
    },
    [setDrawerHeightPx],
  );

  const toggleDrawer = useCallback(() => {
    setDrawerHeightPx((prev) => {
      if (prev > 0) {
        lastNonZeroRef.current = prev;
        return 0;
      }
      return lastNonZeroRef.current || PX_TARGETS.md;
    });
    // 持久化由 useLocalStorage 自动完成
  }, [setDrawerHeightPx]);

  // 暴露 imperative expand：父级在 Start / 切 pane 时调用，若折叠则展开。
  // 同步调用、不依赖 effect，避免瞬时命令（如 -version）isRunning 未稳定时抽屉不弹。
  useEffect(() => {
    onExpandRef.current = () => {
      setDrawerHeightPx((prev) =>
        prev > 0 ? prev : lastNonZeroRef.current || PX_TARGETS.md,
      );
    };
    return () => {
      onExpandRef.current = null;
    };
  }, [onExpandRef, setDrawerHeightPx]);

  // 运行时自动展开到 lg，结束后恢复
  const prevIsRunningRef = useRef(false);
  useEffect(() => {
    const wasRunning = prevIsRunningRef.current;
    prevIsRunningRef.current = isRunning;
    if (!wasRunning && isRunning) {
      preRunHeightRef.current = heightRef.current;
      setDrawerHeightPx(PX_TARGETS.lg);
    } else if (wasRunning && !isRunning) {
      setDrawerHeightPx(preRunHeightRef.current);
    }
  }, [isRunning, heightRef, setDrawerHeightPx]);

  // ── 拖拽 resize ──
  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = heightRef.current;
      const maxH = window.innerHeight * 0.7;
      const onMove = (ev: PointerEvent) => {
        // 向上拖 → 增高
        const next = Math.max(
          0,
          Math.min(maxH, startH + (startY - ev.clientY)),
        );
        setDrawerHeightPx(Math.round(next));
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        setDrawerHeightPx((h) => {
          if (h > 0) lastNonZeroRef.current = h;
          return h;
        });
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [setDrawerHeightPx, heightRef],
  );

  return (
    <div className="flex-shrink-0 flex flex-col">
      <DrawerTabBar
        activePane={activePane}
        onActivePaneChange={onActivePaneChange}
        canStop={canStop}
        isRunning={isRunning}
        isStopping={isStopping}
        onStop={onStop}
        onClearLogs={() => xtermClearRef.current?.()}
        onCopyLogs={onCopyLogs}
        drawerSize={drawerSize}
        onDrawerSizeChange={setSizeTarget}
        onToggleDrawer={toggleDrawer}
      />

      {/* 拖拽 resize 手柄（只缩放内容区，标签栏常驻） */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={t('Toggle drawer')}
        aria-valuenow={Math.round(drawerHeightPx)}
        aria-valuemin={0}
        aria-valuemax={Math.round(window.innerHeight * 0.7)}
        onPointerDown={onHandlePointerDown}
        onDoubleClick={() => setSizeTarget(drawerSize === 'sm' ? 'md' : 'sm')}
        className="h-1.5 -mt-0.5 cursor-row-resize bg-transparent hover:bg-primary-500/40 active:bg-primary-500/60 transition-colors duration-150 flex-shrink-0"
      />

      <div
        style={{
          height: drawerHeightPx,
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

        <div
          style={{
            position: 'absolute',
            inset: 0,
            visibility:
              drawerSize === 'sm' || activePane !== 'terminal'
                ? 'hidden'
                : 'visible',
            pointerEvents:
              drawerSize === 'sm' || activePane !== 'terminal'
                ? 'none'
                : 'auto',
          }}
          className="bg-slate-900"
        >
          {/* 始终挂载：折叠/切 pane 仅切 visibility，避免反复 pty-kill / pty-start。
              与上方 FFmpegTerminal 的 visibility 策略保持一致。 */}
          <Terminal />
        </div>

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

export const WorkspaceDrawer = memo(WorkspaceDrawerImpl);
