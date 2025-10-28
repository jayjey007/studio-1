
"use client";

import { useEffect, useRef, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { doc, onSnapshot, collection, addDoc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { Button } from './ui/button';
import { Phone, PhoneOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface VideoChatProps {
    firestore: Firestore;
    callId: string;
    currentUser: User;
}

const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
        },
    ],
    iceCandidatePoolSize: 10,
};

export function VideoChat({ firestore, callId, currentUser }: VideoChatProps) {
    const pc = useRef<RTCPeerConnection | null>(null);
    const localStream = useRef<MediaStream | null>(null);
    const remoteStream = useRef<MediaStream | null>(null);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    const { toast } = useToast();
    const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'in-call' | 'error'>('idle');
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

    useEffect(() => {
        const getCameraPermission = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                localStream.current = stream;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
                setHasCameraPermission(true);
            } catch (error) {
                console.error('Error accessing camera:', error);
                setHasCameraPermission(false);
                toast({
                    variant: 'destructive',
                    title: 'Camera Access Denied',
                    description: 'Please enable camera permissions in your browser settings to use this feature.',
                });
            }
        };
        getCameraPermission();
    }, [toast]);
    
    const startCall = async () => {
        if (!firestore || !currentUser || !localStream.current) {
            toast({ title: 'Error', description: 'Cannot start call. Resources not ready.', variant: 'destructive'});
            return;
        }
        setCallStatus('calling');

        const callDocRef = doc(firestore, 'videoCalls', callId);
        const offerCandidatesRef = collection(callDocRef, 'offerCandidates');
        const answerCandidatesRef = collection(callDocRef, 'answerCandidates');
        
        pc.current = new RTCPeerConnection(servers);

        localStream.current.getTracks().forEach(track => {
            pc.current!.addTrack(track, localStream.current!);
        });

        remoteStream.current = new MediaStream();
        pc.current.ontrack = event => {
            event.streams[0].getTracks().forEach(track => {
                remoteStream.current!.addTrack(track);
            });
        };
        
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream.current;
        }

        pc.current.onicecandidate = async event => {
            if (event.candidate) {
                await addDoc(offerCandidatesRef, event.candidate.toJSON());
            }
        };

        const offerDescription = await pc.current.createOffer();
        await pc.current.setLocalDescription(offerDescription);

        const offer = {
            sdp: offerDescription.sdp,
            type: offerDescription.type,
        };

        await updateDoc(callDocRef, { offer });

        onSnapshot(callDocRef, (snapshot) => {
            const data = snapshot.data();
            if (!pc.current?.currentRemoteDescription && data?.answer) {
                const answerDescription = new RTCSessionDescription(data.answer);
                pc.current?.setRemoteDescription(answerDescription);
            }
        });

        onSnapshot(answerCandidatesRef, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    pc.current?.addIceCandidate(candidate);
                }
            });
        });
        setCallStatus('in-call');
    };
    
    const answerCall = async () => {
        if (!firestore || !localStream.current) return;
        setCallStatus('in-call');

        const callDocRef = doc(firestore, 'videoCalls', callId);
        const answerCandidatesRef = collection(callDocRef, 'answerCandidates');
        const offerCandidatesRef = collection(callDocRef, 'offerCandidates');
        
        pc.current = new RTCPeerConnection(servers);

        localStream.current.getTracks().forEach(track => {
            pc.current!.addTrack(track, localStream.current!);
        });

        remoteStream.current = new MediaStream();
        pc.current.ontrack = event => {
            event.streams[0].getTracks().forEach(track => {
                remoteStream.current!.addTrack(track);
            });
        };
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream.current;
        }

        pc.current.onicecandidate = async event => {
            if (event.candidate) {
                await addDoc(answerCandidatesRef, event.candidate.toJSON());
            }
        };

        const callData = (await getDoc(callDocRef)).data();
        if (callData?.offer) {
            await pc.current.setRemoteDescription(new RTCSessionDescription(callData.offer));
            const answerDescription = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answerDescription);

            const answer = {
                type: answerDescription.type,
                sdp: answerDescription.sdp,
            };
            await updateDoc(callDocRef, { answer });

            onSnapshot(offerCandidatesRef, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        let data = change.doc.data();
                        pc.current?.addIceCandidate(new RTCIceCandidate(data));
                    }
                });
            });
        }
    };


    const hangUp = async () => {
        if (pc.current) {
            pc.current.close();
        }
        if (localStream.current) {
            localStream.current.getTracks().forEach(track => track.stop());
        }
        
        if (firestore) {
            const callDocRef = doc(firestore, 'videoCalls', callId);
            if((await getDoc(callDocRef)).exists()) {
                 await deleteDoc(callDocRef);
            }
        }

        pc.current = null;
        localStream.current = null;
        remoteStream.current = null;
        setCallStatus('idle');
        window.location.reload(); // Quick way to reset state
    };


    return (
        <div className="w-full max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-muted rounded-lg overflow-hidden aspect-video">
                    <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">You</div>
                </div>
                <div className="bg-muted rounded-lg overflow-hidden aspect-video">
                    <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">Remote</div>
                </div>
            </div>

            {hasCameraPermission === false && (
                <Alert variant="destructive" className="mt-4">
                    <AlertTitle>Camera Access Required</AlertTitle>
                    <AlertDescription>
                        Please allow camera and microphone access to use the video call feature. Check your browser settings.
                    </AlertDescription>
                </Alert>
            )}
            
            <div className="mt-6 flex justify-center items-center gap-4">
                {callStatus === 'idle' && (
                    <>
                        <Button onClick={startCall} disabled={hasCameraPermission !== true}>
                            <Phone className="mr-2 h-4 w-4" /> Start Call
                        </Button>
                        <Button onClick={answerCall} disabled={hasCameraPermission !== true} variant="outline">
                            Join Call
                        </Button>
                    </>
                )}

                {callStatus === 'calling' && <p className="text-muted-foreground">Calling...</p>}
                
                {callStatus === 'in-call' && (
                    <Button onClick={hangUp} variant="destructive">
                        <PhoneOff className="mr-2 h-4 w-4" /> Hang Up
                    </Button>
                )}
            </div>
        </div>
    );
}

    