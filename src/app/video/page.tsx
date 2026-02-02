
"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase/provider';
import { VideoChat } from '@/components/VideoChat';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User } from 'firebase/auth';

const ALL_USERS = [
    { username: 'Crazy', uid: 'QYTCCLfLg1gxdLLQy34y0T2Pz3g2' },
    { username: 'Cool', uid: 'N2911Sj2g8cT03s5v31s1p9V8s22' }
];

const CALL_ID = "main_call";

export default function VideoPage() {
    const router = useRouter();
    const { firestore, auth } = useFirebase();
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    useEffect(() => {
        const userInSession = sessionStorage.getItem('currentUser');
        if (!userInSession) {
            router.replace('/');
            return;
        }

        const userObject = ALL_USERS.find(u => u.username === userInSession);
        if (!userObject) {
            router.replace('/');
            return;
        }

        // Use a mock user object if Firebase auth isn't fully loaded,
        // ensuring the UID is available for the VideoChat component.
        if (auth.currentUser) {
            setCurrentUser(auth.currentUser);
        } else {
             setCurrentUser({
                uid: userObject.uid,
                displayName: userObject.username,
            } as User);
        }
    }, [router, auth]);

    const handleLogout = () => {
        sessionStorage.removeItem("isAuthenticated");
        sessionStorage.removeItem("currentUser");
        router.replace("/");
    };

    if (!currentUser || !firestore) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-10 w-10 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full flex-col bg-black">
            <header className="absolute top-0 z-20 flex w-full h-16 items-center justify-between gap-4 bg-transparent px-4 text-white">
                <Button variant="ghost" size="icon" className="shrink-0 hover:bg-white/20" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                    <span className="sr-only">Back</span>
                </Button>
                <h1 className="flex-1 text-xl font-semibold">Video Call</h1>
                 <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout" className="hover:bg-white/20">
                    <LogOut className="h-5 w-5" />
                 </Button>
            </header>
            <main className="flex-1 flex flex-col items-center justify-center">
                <VideoChat firestore={firestore} callId={CALL_ID} currentUser={currentUser} />
            </main>
        </div>
    );
}
