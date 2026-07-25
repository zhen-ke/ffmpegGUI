import { useCallback, useEffect, type RefObject } from 'react';
import { type GuideStep } from '../components/AppHeader';
import { useLocalStorage } from './useLocalStorage';

const LS_ONBOARDING_COMPLETED = 'onboarding-completed-v1';
const LS_ONBOARDING_DISMISSED = 'onboarding-dismissed-v1';

/**
 * useOnboardingGuide manages the display state and interactions of the onboarding guide.
 */
export function useOnboardingGuide(options: {
  status: string;
  templateControlId: string;
  inputControlBaseId: string;
  outputControlId: string;
  startButtonRef: RefObject<HTMLButtonElement>;
}): {
  showOnboardingGuide: boolean;
  dismissGuide: () => void;
  handleGuideStepClick: (step: GuideStep) => void;
} {
  const {
    status,
    templateControlId,
    inputControlBaseId,
    outputControlId,
    startButtonRef,
  } = options;

  // 拆成两个 key 各自持久化（保留历史存储格式），合并后即 guideDismissed
  const [dismissed, setDismissed] = useLocalStorage<boolean>(
    LS_ONBOARDING_DISMISSED,
    false,
    { serialize: (b) => (b ? '1' : '0'), deserialize: (s) => s === '1' },
  );
  const [completed, setCompleted] = useLocalStorage<boolean>(
    LS_ONBOARDING_COMPLETED,
    false,
    { serialize: (b) => (b ? '1' : '0'), deserialize: (s) => s === '1' },
  );
  const guideDismissed = dismissed || completed;

  const dismissGuide = useCallback(() => {
    setDismissed(true);
  }, [setDismissed]);

  useEffect(() => {
    if (status === 'done') {
      setCompleted(true);
    }
  }, [status, setCompleted]);

  const handleGuideStepClick = useCallback(
    (step: GuideStep) => {
      switch (step) {
        case 'template':
          document.getElementById(templateControlId)?.click();
          break;
        case 'input':
          document.getElementById(`${inputControlBaseId}-0`)?.focus();
          break;
        case 'output':
          document.getElementById(outputControlId)?.focus();
          break;
        case 'start':
          startButtonRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
          startButtonRef.current?.focus();
          break;
        default:
          break;
      }
    },
    [inputControlBaseId, outputControlId, templateControlId, startButtonRef],
  );

  return {
    showOnboardingGuide: !guideDismissed,
    dismissGuide,
    handleGuideStepClick,
  };
}
