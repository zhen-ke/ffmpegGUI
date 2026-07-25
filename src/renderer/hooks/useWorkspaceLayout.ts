import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { type WorkspacePane } from '../components/DrawerTabBar';

const LS_WORKSPACE_PANE_KEY = 'ffmpeg-workspace-pane-v1';
const COMPACT_MEDIA_QUERY = '(max-width: 919px)';

/**
 * useWorkspaceLayout encapsulates the layout state of the workspace, including the active pane, compact mode, and drawer expansion.
 */
export function useWorkspaceLayout(): {
  activePane: WorkspacePane;
  isCompact: boolean;
  expandDrawerRef: MutableRefObject<(() => void) | null>;
  handleActivePaneChange: (pane: WorkspacePane) => void;
} {
  const [activePane, setActivePane] = useState<WorkspacePane>(() => {
    try {
      return (
        (localStorage.getItem(LS_WORKSPACE_PANE_KEY) as WorkspacePane) ??
        'activity'
      );
    } catch {
      return 'activity';
    }
  });

  const [isCompact, setIsCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(COMPACT_MEDIA_QUERY);
    const handler = () => setIsCompact(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const expandDrawerRef = useRef<(() => void) | null>(null);

  const handleActivePaneChange = useCallback((pane: WorkspacePane) => {
    setActivePane(pane);
    // 切 pane / Start 时若抽屉折叠则撑开（复刻原内联副作用，瞬时命令也能弹日志）
    expandDrawerRef.current?.();
    try {
      localStorage.setItem(LS_WORKSPACE_PANE_KEY, pane);
    } catch {
      /* ignore */
    }
  }, []);

  return {
    activePane,
    isCompact,
    expandDrawerRef,
    handleActivePaneChange,
  };
}
