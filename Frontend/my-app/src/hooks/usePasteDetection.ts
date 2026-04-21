import { useEffect } from 'react';

// Define the cooldown durations for each violation level (seconds)
const COOLDOWN_DURATIONS = [30, 60, 120, 300];

export const usePasteDetection = (
  editorDomNode: HTMLElement | null,
  onDetected: () => void
) => {
  useEffect(() => {
    if (!editorDomNode) return;

    const handlePaste = () => {
      const violationCount = parseInt(sessionStorage.getItem('pasteViolationCount') || '0', 10);
      const duration = COOLDOWN_DURATIONS[Math.min(violationCount, COOLDOWN_DURATIONS.length - 1)];

      const cooldownUntil = Date.now() + duration * 1000;
      sessionStorage.setItem('cooldownUntil', String(cooldownUntil));
      sessionStorage.setItem('pasteViolationCount', String(violationCount + 1));

      onDetected();
    };

    editorDomNode.addEventListener('paste', handlePaste);
    return () => editorDomNode.removeEventListener('paste', handlePaste);
  }, [editorDomNode, onDetected]);
};
