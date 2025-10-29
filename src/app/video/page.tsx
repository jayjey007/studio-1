
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase/provider';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { VideoChat } from '@/components/VideoChat';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ALL_USERS = [
    { username: 'Crazy', uid: 'QYTCCLfLg1gxdLLQy34y0T2Pz3g2' },
    { username: 'Cool', uid: 'N2911Sj2g8cT03s5v31s1p9V8s22' }
];

const CALL_ID = "main_call"; // Using a static call ID for this 1-on-1 app

export default function VideoPage() {
    const router = useRouter();
    const { firestore, auth } = useFirebase();
    const { toast } = useToast();
    const [callDocExists, setCallDocExists] = useState(false);
    const [isCheckingDoc, setIsCheckingDoc] = useState(true);
    const [currentUser, setCurrentUser] = useState<any | null>(null);

    useEffect(() => {
        // Safari on iOS sometimes has issues with auth state persistence on page loads.
        // We check sessionStorage first for a quicker and more reliable auth check on mobile.
        const userInSession = sessionStorage.getItem('currentUser');
        const userObject = userInSession ? ALL_USERS.find(u => u.username === userInSession) : null;

        if (!userObject) {
          router.replace('/');
          return;
        }

        if (auth.currentUser) {
            setCurrentUser(auth.currentUser);
        } else {
            // Create a mock user object if the full auth object isn't available yet
            // This is enough for the component to proceed while auth state finalizes
             setCurrentUser({
                uid: userObject.uid,
                displayName: userObject.username
            });
        }
    }, [router, auth]);


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
                const docSnap = await getDoc(callDocRef);
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
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-10 w-10 animate-spin" />
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
