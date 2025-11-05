
"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Firestore } from 'firebase/firestore';
import { doc, onSnapshot, collection, addDoc, updateDoc, getDoc, deleteDoc, setDoc, getDocs, Unsubscribe } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { Button } from './ui/button';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { cn } from '@/lib/utils';

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
    const [inCall, setInCall] = useState(false);
    const [hasMediaPermission, setHasMediaPermission] = useState<boolean | null>(null);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    
    const [isJoining, setIsJoining] = useState(false);

    const subscriptions = useRef<Unsubscribe[]>([]);

    const setupMedia = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localStream.current = stream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            setHasMediaPermission(true);
            return stream;
        } catch (error) {
            console.error('Error accessing media devices.', error);
            setHasMediaPermission(false);
            toast({
                variant: 'destructive',
                title: 'Media Access Denied',
                description: 'Please enable camera and microphone permissions to use video chat.',
            });
            return null;
        }
    }, [toast]);
    
    const hangUp = useCallback(async () => {
        if (pc.current) {
            pc.current.close();
            pc.current = null;
        }

        localStream.current?.getTracks().forEach(track => track.stop());
        remoteStream.current?.getTracks().forEach(track => track.stop());
        localStream.current = null;
        remoteStream.current = null;

        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

        subscriptions.current.forEach(unsubscribe => unsubscribe());
        subscriptions.current = [];

        const callDocRef = doc(firestore, 'videoCalls', callId);
        if ((await getDoc(callDocRef)).exists()) {
            const initiatorCandidatesRef = collection(callDocRef, 'initiatorCandidates');
            const recipientCandidatesRef = collection(callDocRef, 'recipientCandidates');
            
            const initiatorSnapshot = await getDocs(initiatorCandidatesRef);
            initiatorSnapshot.forEach(async (doc) => await deleteDoc(doc.ref));

            const recipientSnapshot = await getDocs(recipientCandidatesRef);
            recipientSnapshot.forEach(async (doc) => await deleteDoc(doc.ref));

            await deleteDoc(callDocRef);
        }

        setInCall(false);
        setIsJoining(false);
        await setupMedia();

    }, [firestore, callId, setupMedia]);
    
    useEffect(() => {
        setupMedia();
        return () => {
            hangUp();
        };
    }, [setupMedia, hangUp]);

    const joinCall = async () => {
        if (isJoining || !hasMediaPermission || !localStream.current) return;
        
        setIsJoining(true);
        pc.current = new RTCPeerConnection(servers);

        localStream.current.getTracks().forEach(track => {
            pc.current!.addTrack(track, localStream.current!);
        });
        
        remoteStream.current = new MediaStream();
        pc.current.ontrack = event => {
            event.streams[0].getTracks().forEach(track => {
                remoteStream.current!.addTrack(track);
            });
            if(remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream.current;
            }
        };

        const callDocRef = doc(firestore, 'videoCalls', callId);
        const callDocSnap = await getDoc(callDocRef);

        if (callDocSnap.exists()) {
            // Callee logic
            await pc.current.setRemoteDescription(new RTCSessionDescription(callDocSnap.data().offer));

            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);

            await updateDoc(callDocRef, { answer });

            pc.current.onicecandidate = async e => {
                if (e.candidate) {
                    await addDoc(collection(callDocRef, 'recipientCandidates'), e.candidate.toJSON());
                }
            };
            
            const initiatorCandidatesUnsub = onSnapshot(collection(callDocRef, 'initiatorCandidates'), snapshot => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        pc.current?.addIceCandidate(new RTCIceCandidate(change.doc.data()));
                    }
                });
            });
            subscriptions.current.push(initiatorCandidatesUnsub);

        } else {
            // Caller logic
            const offer = await pc.current.createOffer();
            await pc.current.setLocalDescription(offer);

            await setDoc(callDocRef, { offer });

            pc.current.onicecandidate = async e => {
                if (e.candidate) {
                    await addDoc(collection(callDocRef, 'initiatorCandidates'), e.candidate.toJSON());
                }
            };

            const callDocUnsub = onSnapshot(callDocRef, async snapshot => {
                const data = snapshot.data();
                if (data?.answer && !pc.current?.currentRemoteDescription) {
                    await pc.current?.setRemoteDescription(new RTCSessionDescription(data.answer));
                }
            });

            const recipientCandidatesUnsub = onSnapshot(collection(callDocRef, 'recipientCandidates'), snapshot => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        pc.current?.addIceCandidate(new RTCIceCandidate(change.doc.data()));
                    }
                });
            });
            subscriptions.current.push(callDocUnsub, recipientCandidatesUnsub);
        }
        setInCall(true);
        setIsJoining(false);
    };

    const toggleVideo = () => {
        if (localStream.current) {
            const videoTrack = localStream.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoEnabled(videoTrack.enabled);
            }
        }
    };
    
    const toggleAudio = () => {
        if (localStream.current) {
            const audioTrack = localStream.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioEnabled(audioTrack.enabled);
            }
        }
    };

    return (
        <div className="relative w-full h-full bg-black">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            
            <div className="absolute top-24 left-4 w-1/4 max-w-[150px] aspect-[9/16] rounded-lg overflow-hidden shadow-2xl bg-black">
                <video ref={localVideoRef} autoPlay playsInline muted className={cn("w-full h-full object-cover transform -scale-x-100", !isVideoEnabled && "hidden")} />
                {!isVideoEnabled && <div className="w-full h-full flex items-center justify-center"><VideoOff className="h-8 w-8 text-white" /></div>}
            </div>

            {hasMediaPermission === false && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                    <Alert variant="destructive" className="max-w-sm m-4">
                        <AlertTitle>Camera & Mic Access Required</AlertTitle>
                        <AlertDescription>
                            Please allow camera and microphone access to use video calls. You may need to check your browser's settings.
                        </AlertDescription>
                    </Alert>
                </div>
            )}
            
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 z-10">
                {!inCall && hasMediaPermission && (
                    <Button onClick={joinCall} disabled={isJoining} className="bg-green-500 hover:bg-green-600 text-white rounded-full h-16 w-16 p-0 border-0">
                       <Phone className="h-7 w-7" />
                       <span className="sr-only">Join Call</span>
                    </Button>
                )}
                
                {inCall && (
                    <>
                        <Button onClick={toggleAudio} variant="outline" className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border-0 text-white rounded-full h-12 w-12 p-0">
                            {isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
                        </Button>
                        <Button onClick={hangUp} variant="destructive" className="rounded-full h-16 w-16 p-0">
                            <PhoneOff className="h-7 w-7" />
                        </Button>
                        <Button onClick={toggleVideo} variant="outline" className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border-0 text-white rounded-full h-12 w-12 p-0">
                            {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}

    