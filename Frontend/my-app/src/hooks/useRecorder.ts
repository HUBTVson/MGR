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

    // Stops the current recorders, uploads the completed task segment,
    // then starts fresh recorders on the same live streams for the next task.
    // This guarantees every task file is a self-contained valid WebM —
    // no header-splicing hacks needed.
    const saveCheckpoint = useCallback(async (taskId: number) => {
        const face = faceRecorderRef.current;
        const screen = screenRecorderRef.current;
        const faceStream = faceStreamRef.current;
        const screenStream = screenStreamRef.current;
        if (!face || !screen || !faceStream || !screenStream) return;
        if (face.state !== 'recording' || screen.state !== 'recording') return;

        // Stop both recorders and upload this task's segment
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

        // Reset chunk buffers for the new segment
        faceChunksRef.current = [];
        screenChunksRef.current = [];

        // Start fresh recorders on the same live streams
        const newFaceRecorder = new MediaRecorder(faceStream, {mimeType: 'video/webm'});
        const newScreenRecorder = new MediaRecorder(screenStream, {mimeType: 'video/webm'});

        newFaceRecorder.ondataavailable = (e) => { if (e.data.size > 0) faceChunksRef.current.push(e.data); };
        newScreenRecorder.ondataavailable = (e) => { if (e.data.size > 0) screenChunksRef.current.push(e.data); };

        faceRecorderRef.current = newFaceRecorder;
        screenRecorderRef.current = newScreenRecorder;

        newFaceRecorder.start(1000);
        newScreenRecorder.start(1000);

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
            
            faceRecorder.ondataavailable = (e) => { if (e.data.size > 0) faceChunksRef.current.push(e.data); };
            screenRecorder.ondataavailable = (e) => { if (e.data.size > 0) screenChunksRef.current.push(e.data); };

            faceRecorderRef.current = faceRecorder;
            screenRecorderRef.current = screenRecorder;

            // timeslice=1000ms ensures ondataavailable fires regularly
            // so chunks accumulate smoothly for upload on stop/checkpoint.
            faceRecorder.start(1000);
            screenRecorder.start(1000);
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