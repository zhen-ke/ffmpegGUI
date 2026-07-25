import { useCallback, useEffect, useState, type RefObject } from 'react';
import { type GuideStep } from '../components/AppHeader';

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

  const [guideDismissed, setGuideDismissed] = useState(() => {
    try {
      return (
        localStorage.getItem(LS_ONBOARDING_DISMISSED) === '1' ||
        localStorage.getItem(LS_ONBOARDING_COMPLETED) === '1'
      );
    } catch {
      return false;
    }
  });

  const dismissGuide = useCallback(() => {
    setGuideDismissed(true);
    try {
      localStorage.setItem(LS_ONBOARDING_DISMISSED, '1');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (status === 'done') {
      try {
        localStorage.setItem(LS_ONBOARDING_COMPLETED, '1');
      } catch {
        /* ignore */
      }
      setGuideDismissed(true);
    }
  }, [status]);

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
