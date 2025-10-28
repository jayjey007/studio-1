
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase/provider';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { VideoChat } from '@/components/VideoChat';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ALL_USERS = [
    { username: 'Crazy', uid: 'QYTCCLfLg1gxdLLQy34y0T2Pz3g2' },
    { username: 'Cool', uid: 'N2911Sj2g8cT03s5v31s1p9V8s22' }
];

const CALL_ID = "main_call"; // Using a static call ID for this 1-on-1 app

export default function VideoPage() {
    const router = useRouter();
    const { firestore, user: currentUser } = useFirebase();
    const { toast } = useToast();
    const [callDocExists, setCallDocExists] = useState(false);
    const [isCheckingDoc, setIsCheckingDoc] = useState(true);

    const callDocRef = firestore ? doc(firestore, 'videoCalls', CALL_ID) : null;

    const createCall = useCallback(async () => {
        if (!firestore || !currentUser) return;

        const recipient = ALL_USERS.find(u => u.uid !== currentUser.uid);
        if (!recipient) {
            toast({ title: "Error", description: "Could not find recipient to call.", variant: "destructive"});
            return;
        }

        try {
            await setDoc(callDocRef!, {
                initiatorUid: currentUser.uid,
                recipientUid: recipient.uid,
                status: 'ringing',
            });
            router.push(`/video?callId=${CALL_ID}`);
        } catch (error: any) {
            toast({ title: "Error starting call", description: error.message, variant: "destructive"});
        }

    }, [firestore, currentUser, callDocRef, router, toast]);

    useEffect(() => {
        const checkCallDoc = async () => {
            if (!callDocRef) return;
            try {
                const docSnap = await getDoc(callDoc_ref);
                setCallDocExists(docSnap.exists());
            } catch (error) {
                console.error("Error checking call document:", error);
            } finally {
                setIsCheckingDoc(false);
            }
        };
        checkCallDoc();
    }, [callDocRef]);

    if (!currentUser) {
        // You might want to redirect to login if the user is not authenticated
        // For now, just showing a message.
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground p-4">
                <p>Please log in to use the video call feature.</p>
                <Button onClick={() => router.push('/')} className="mt-4">Go to Login</Button>
            </div>
        );
    }

    // A simple lobby UI
    return (
        <div className="flex h-screen w-full flex-col bg-background">
            <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6">
                <Button variant="outline" size="icon" className="shrink-0" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                    <span className="sr-only">Back</span>
                </Button>
                <h1 className="flex-1 text-xl font-semibold">Video Call</h1>
            </header>
            <main className="flex-1 flex flex-col items-center justify-center p-4">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4">Ready to connect?</h2>
                    <p className="text-muted-foreground mb-8">
                        You can start a video call with the other user.
                    </p>
                    <VideoChat firestore={firestore!} callId={CALL_ID} currentUser={currentUser} />
                </div>
            </main>
        </div>
    );
}

// Minimal stub for getDoc until it's properly used
const getDoc_ref = null as any;

    