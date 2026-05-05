import { useEffect } from 'react';


export const usePasteDetection = (
  editorDomNode: HTMLElement | null,
  userId: string,
  isAdmin: boolean,
  onDetected: () => void
) => {
  useEffect(() => {
    if (!editorDomNode || !userId) return;

    const handlePaste = async (event: ClipboardEvent) => {
      console.log(`Wykryto wklejanie dla użytkownika: ${userId}`);

      try {
        const response = await fetch('/api/record-paste', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: userId,
            isAdmin: isAdmin
          }),
        });

        if (!response.ok) {
          throw new Error('Błąd podczas rejestrowania wklejenia na serwerze');
        }

        const data = await response.json();
        
        sessionStorage.setItem('cooldownUntil', String(data.cooldownUntil));
        sessionStorage.setItem('pasteViolationCount', String(data.violationCount));

        onDetected(); 

      } catch (error) {
        console.error('Błąd komunikacji z backendem:', error);
      }
    };

    editorDomNode.addEventListener('paste', handlePaste);
    return () => editorDomNode.removeEventListener('paste', handlePaste);
  }, [editorDomNode, userId, isAdmin, onDetected]);
};
