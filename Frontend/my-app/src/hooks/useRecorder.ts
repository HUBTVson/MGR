import {useRef, useCallback} from 'react';

export const useRecorder=() => {
    const faceRecorderRef = useRef<MediaRecorder | null>(null);
    const screenRecorderRef = useRef<MediaRecorder | null>(null);
    const faceStreamRef = useRef<MediaStream | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const faceChunksRef = useRef<Blob[]>([]);
    const screenChunksRef = useRef<Blob[]>([]);
    const sessionIdRef = useRef<{userId: string; sessionId: string} | null>(null);

    const uploadRecording = async (blob:Blob, type: 'face' | 'screen') => {
        const {userId, sessionId} = sessionIdRef.current!;
        const formData = new FormData();
        formData.append('file', blob, `${sessionId}_${type}.webm`);
        formData.append('userId', userId);
        formData.append('sessionId', sessionId);
        formData.append('type', type);

        try{
            await fetch('/api/upload', {method: 'POST', body: formData});
            console.log(`[Recorder] Uploaded ${type}`);
        }   catch (err) {
            console.error(`[Recorder] Upload failed (${type}):`, err);
        }
    };

    const start=useCallback(async (userId: string, sessionId: string) => {
        sessionIdRef.current = {userId, sessionId};
        try {
            const faceStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false});
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false});

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
            console.log('[Recorder] Both recorders started');
        } catch (err) {
            console.error('[Recorder] Failed to start recording:', err);
        }
    }, []);

    const stop = useCallback(async () => {
        const face = faceRecorderRef.current;
        const screen = screenRecorderRef.current;
        if (!face || !screen) return;

        await Promise.all([
            new Promise<void>((resolve) => {
                face.onstop= async () => {
                    const blob= new Blob(faceChunksRef.current, {type: 'video/webm'});
                    await uploadRecording(blob, 'face');
                    resolve();
                };
                face.stop();
            }),
            new Promise<void>((resolve) => {
                screen.onstop = async () => {
                    const blob = new Blob(screenChunksRef.current, {type: 'video/webm'});
                    await uploadRecording(blob, 'screen');
                    resolve();
                };
                screen.stop();
            }),
        ]);

        faceStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        console.log('[Recorder] Stopped and uploaded.');
    }, []);

        return {start, stop};
    };