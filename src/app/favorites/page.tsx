
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { collection, query, where, orderBy, getDocs, Timestamp, or, and } from "firebase/firestore";
import { useFirebase, useMemoFirebase } from "@/firebase";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Star, LogOut } from "lucide-react";
import { format } from "date-fns";
import type { Message } from "../chat/page";
import { cn } from "@/lib/utils";

const ALL_USERS = [
    { username: 'Crazy', uid: 'QYTCCLfLg1gxdLLQy34y0T2Pz3g2' },
    { username: 'Cool', uid: 'N2911Sj2g8cT03s5v31s1p9V8s22' }
];

// Simple Caesar cipher for decoding
const decodeMessage = (text: string, shift: number = 1): string => {
  return text
    .split('')
    .map(char => {
      const charCode = char.charCodeAt(0);
       if (charCode >= 32 + shift && charCode <= 126 + shift) {
        return String.fromCharCode(charCode - shift);
      }
      return char;
    })
    .join('');
};

const LinkifiedText = ({ text }: { text: string }) => {
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    const parts = text.split(urlRegex);

    return (
        <p className="whitespace-pre-wrap break-words">
            {parts.map((part, i) => {
                if (part && part.match(urlRegex)) {
                    return (
                        <a
                            key={i}
                            href={part}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-blue-300 hover:text-blue-400"
                        >
                            {part}
                        </a>
                    );
                }
                return part;
            })}
        </p>
    );
};

export default function FavoritesPage() {
  const router = useRouter();
  const { firestore: db } = useFirebase();
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentUserObject = useMemo(() => ALL_USERS.find(u => u.username === currentUser), [currentUser]);

  useEffect(() => {
    const user = sessionStorage.getItem("currentUser");
    if (!user) {
      router.replace("/");
    } else {
      setCurrentUser(user);
    }
  }, [router]);

    const handleLogout = useCallback(() => {
    sessionStorage.removeItem("isAuthenticated");
    sessionStorage.removeItem("currentUser");
    router.replace("/");
  }, [router]);

  const fetchFavorites = useCallback(async () => {
    if (!db || !currentUserObject) return;

    setIsLoading(true);
    const messagesRef = collection(db, "messages");
    
    const userIsParticipantQuery = query(
        messagesRef,
        and(
            where("isFavorited", "==", true),
            or(
                where("senderUid", "==", currentUserObject.uid),
                where("recipientUid", "==", currentUserObject.uid)
            )
        ),
        orderBy("createdAt", "desc")
    );


    try {
        const querySnapshot = await getDocs(userIsParticipantQuery);
        
        const favs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
        
        setFavorites(favs);
    } catch (error) {
        console.error("Error fetching favorites:", error);
    } finally {
        setIsLoading(false);
    }
  }, [db, currentUserObject]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const getMessageText = (message: Message) => {
    return message.isEncoded ? decodeMessage(message.scrambledText) : message.scrambledText;
  };

  if (!currentUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6">
        <Button variant="outline" size="icon" className="shrink-0" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back</span>
        </Button>
        <h1 className="flex-1 text-xl font-semibold">Favorite Messages</h1>
      </header>
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 md:p-6">
            {isLoading ? (
              <div className="flex justify-center items-center p-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : favorites.length === 0 ? (
              <div className="text-center text-muted-foreground py-10">
                <Star className="mx-auto h-12 w-12 text-yellow-400" />
                <p className="mt-4">You haven't favorited any messages yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {favorites.map((message) => (
                  <Link href={`/chat#${message.id}`} key={message.id}>
                    <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-base font-medium">
                            {message.sender === currentUser ? 'You' : message.sender}
                        </CardTitle>
                        <div className="flex items-center text-xs text-muted-foreground">
                            <Star className="h-3 w-3 mr-1 fill-yellow-500 text-yellow-500" />
                            {message.createdAt && format(message.createdAt.toDate(), "MMM d, yyyy")}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {(message.imageUrl || message.thumbnailUrl) && (
                          <div className="mb-2">
                            <Image 
                                src={message.thumbnailUrl || message.imageUrl || ''} 
                                alt="Attached image" 
                                width={150} 
                                height={150} 
                                className="max-w-full h-auto rounded-md" 
                            />
                          </div>
                        )}
                        {message.videoUrl && (
                          <div className="mb-2">
                            <video src={message.videoUrl} controls className="max-w-[200px] h-auto rounded-md" />
                          </div>
                        )}
                        {message.audioUrl && (
                          <div className="my-2">
                            <audio src={message.audioUrl} controls className="w-full max-w-xs" />
                            {message.fileName && <p className="text-xs mt-1 text-muted-foreground/80">{message.fileName}</p>}
                          </div>
                        )}
                        {getMessageText(message).trim() && <LinkifiedText text={getMessageText(message)} />}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </main>
       <footer className="shrink-0 border-t bg-card p-2 md:p-4">
        <div className="flex items-center justify-end">
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout">
              <LogOut className="h-5 w-5" />
            </Button>
        </div>
      </footer>
    </div>
  );
}
