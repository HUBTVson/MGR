import {useRef, useCallback, useState} from 'react';

export const useRecorder=() => {
    const faceRecorderRef = useRef<MediaRecorder | null>(null);
    const screenRecorderRef = useRef<MediaRecorder | null>(null);
    const faceStreamRef = useRef<MediaStream | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const faceChunksRef = useRef<Blob[]>([]);
    const screenChunksRef = useRef<Blob[]>([]);
    const sessionIdRef = useRef<{userId: string; sessionId: string} | null>(null);
    const currentTaskIdRef = useRef<number | null>(null);
    const [hasCameraError, setHasCameraError] = useState(false);
    const [hasScreenShareStopped, setHasScreenShareStopped] = useState(false);
    const [hasCameraStopped, setHasCameraStopped] = useState(false);
    const isStoppingRef = useRef(false);
    const stopFnRef = useRef<() => Promise<void>>(async () => {});

    const uploadRecording = async (blob: Blob, type: 'face' | 'screen', taskId?: number | null) => {
        const {userId, sessionId} = sessionIdRef.current!;
        const formData = new FormData();
        const filename = taskId != null
            ? `${sessionId}_task${taskId}_${type}.webm`
            : `${sessionId}_${type}.webm`;
        formData.append('file', blob, filename);
        formData.append('userId', userId);
        formData.append('sessionId', sessionId);
        formData.append('type', type);
        if (taskId != null) formData.append('taskId', String(taskId));

        try{
            await fetch('/api/upload', {method: 'POST', body: formData});
            console.log(`[Nagrywanie] Przesłano ${type}${taskId != null ? ` (zadanie ${taskId})` : ''}`);
        } catch (err) {
            console.error(`[Nagrywanie] Przesyłanie nie powiodło się (${type}):`, err);
        }
    };

    const setCurrentTaskId = useCallback((taskId: number) => {
        currentTaskIdRef.current = taskId;
    }, []);

    // Flushes the recorder's internal buffer for the current task segment,
    // uploads it, and clears the chunks so the next task starts with a clean slate.
    // Recording continues uninterrupted — only the buffer is drained.
    const saveCheckpoint = useCallback(async (taskId: number) => {
        const face = faceRecorderRef.current;
        const screen = screenRecorderRef.current;
        if (!face || !screen) return;
        if (face.state !== 'recording' || screen.state !== 'recording') return;

        await Promise.all([
            new Promise<void>((resolve) => {
                const origHandler = face.ondataavailable;
                face.ondataavailable = (e) => {
                    face.ondataavailable = origHandler;
                    if (e.data.size > 0) faceChunksRef.current.push(e.data);
                    const blob = new Blob(faceChunksRef.current, {type: 'video/webm'});
                    faceChunksRef.current = [];
                    uploadRecording(blob, 'face', taskId).then(resolve);
                };
                face.requestData();
            }),
            new Promise<void>((resolve) => {
                const origHandler = screen.ondataavailable;
                screen.ondataavailable = (e) => {
                    screen.ondataavailable = origHandler;
                    if (e.data.size > 0) screenChunksRef.current.push(e.data);
                    const blob = new Blob(screenChunksRef.current, {type: 'video/webm'});
                    screenChunksRef.current = [];
                    uploadRecording(blob, 'screen', taskId).then(resolve);
                };
                screen.requestData();
            }),
        ]);
        console.log(`[Nagrywanie] Checkpoint dla zadania ${taskId} zapisany`);
    }, []);

    const start=useCallback(async (userId: string, sessionId: string) => {
        sessionIdRef.current = {userId, sessionId};
        setHasCameraError(false);
        setHasScreenShareStopped(false);
        setHasCameraStopped(false);
        isStoppingRef.current = false;
        try {
            const faceStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false});
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false});

            screenStream.getVideoTracks().forEach(track => {
                track.onended = async () => {
                    if (!isStoppingRef.current) {
                        setHasScreenShareStopped(true);
                        await stopFnRef.current();
                    }
                };
            });

            faceStream.getVideoTracks().forEach(track => {
                track.onended = async () => {
                    if (!isStoppingRef.current) {
                        setHasCameraStopped(true);
                        await stopFnRef.current();
                    }
                };
            });

            faceStreamRef.current = faceStream;
            screenStreamRef.current = screenStream;
            faceChunksRef.current = [];
            screenChunksRef.current = [];

            const faceRecorder = new MediaRecorder (faceStream, {mimeType: 'video/webm'});
            const screenRecorder = new MediaRecorder(screenStream, {mimeType: 'video/webm'});
            
            faceRecorder.ondataavailable = (e) => {if (e.data.size > 0) faceChunksRef.current.push(e.data);};
            screenRecorder.ondataavailable = (e) => {if (e.data.size > 0) screenChunksRef.current.push(e.data);};

            faceRecorderRef.current = faceRecorder;
            screenRecorderRef.current = screenRecorder;

            faceRecorder.start();
            screenRecorder.start();
            console.log('[Nagrywanie] Oba rejestratory rozpoczęły nagrywanie');
        } catch (err) {
            const error = err as { name?: string };
            const hardwareErrors = ['NotFoundError', 'DevicesNotFoundError'];
            const permissionErrors = ['NotAllowedError', 'PermissionDeniedError'];
            if (hardwareErrors.includes(error.name ?? '') || permissionErrors.includes(error.name ?? '')) {
                setHasCameraError(true);
            }
            console.error('[Nagrywanie] Nagrywanie nie zostało rozpoczęte:', err);
        }
    }, []);

    const retry = useCallback(() => {
        if (sessionIdRef.current) {
            const { userId, sessionId } = sessionIdRef.current;
            start(userId, sessionId);
        }
    }, [start]);

    const stop = useCallback(async () => {
        isStoppingRef.current = true;
        const face = faceRecorderRef.current;
        const screen = screenRecorderRef.current;
        if (!face || !screen) return;
        const taskId = currentTaskIdRef.current;

        await Promise.all([
            new Promise<void>((resolve) => {
                face.onstop = async () => {
                    const blob = new Blob(faceChunksRef.current, {type: 'video/webm'});
                    if (blob.size > 0) await uploadRecording(blob, 'face', taskId);
                    resolve();
                };
                face.stop();
            }),
            new Promise<void>((resolve) => {
                screen.onstop = async () => {
                    const blob = new Blob(screenChunksRef.current, {type: 'video/webm'});
                    if (blob.size > 0) await uploadRecording(blob, 'screen', taskId);
                    resolve();
                };
                screen.stop();
            }),
        ]);

        faceStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        console.log('[Nagrywanie] Zatrzymano i przesłano nagrania.');
    }, []);

    stopFnRef.current = stop;

    return {start, stop, saveCheckpoint, setCurrentTaskId, hasCameraError, retry, hasScreenShareStopped, hasCameraStopped};
};