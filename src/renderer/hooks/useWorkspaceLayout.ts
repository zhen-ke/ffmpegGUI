import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { type WorkspacePane } from '../components/DrawerTabBar';
import { useLocalStorage } from './useLocalStorage';

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
  const [activePane, setActivePane] = useLocalStorage<WorkspacePane>(
    LS_WORKSPACE_PANE_KEY,
    'activity',
    {
      // 历史存储为裸字符串（非 JSON），用 String / 直读保持兼容
      serialize: String,
      deserialize: (raw) => (raw || 'activity') as WorkspacePane,
    },
  );

  const [isCompact, setIsCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(COMPACT_MEDIA_QUERY);
    const handler = () => setIsCompact(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const expandDrawerRef = useRef<(() => void) | null>(null);

  const handleActivePaneChange = useCallback(
    (pane: WorkspacePane) => {
      setActivePane(pane);
      // 切 pane / Start 时若抽屉折叠则撑开（复刻原内联副作用，瞬时命令也能弹日志）
      expandDrawerRef.current?.();
      // 持久化由 useLocalStorage 自动完成
    },
    [setActivePane],
  );

  return {
    activePane,
    isCompact,
    expandDrawerRef,
    handleActivePaneChange,
  };
}
