
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ArrowLeft, Star, LogOut, Download, ExternalLink, Video } from "lucide-react";
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
  const [viewingMedia, setViewingMedia] = useState<Message | null>(null);

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

  const getThumbnailSrc = (item: Message) => {
    if (item.thumbnailUrl) return item.thumbnailUrl;
    if (item.imageUrl) {
        return item.imageUrl.replace('/chat_images%2F', '/chat_images_thumbnail%2F');
    }
    return '';
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {favorites.map((message) => (
                  <Card key={message.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => { if(message.imageUrl || message.videoUrl) setViewingMedia(message); }}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">
                          {message.sender === currentUser ? 'You' : message.sender}
                      </CardTitle>
                      <div className="flex items-center text-[10px] text-muted-foreground">
                          <Star className="h-3 w-3 mr-1 fill-yellow-500 text-yellow-500" />
                          {message.createdAt && format(message.createdAt.toDate(), "MMM d, yyyy")}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {(message.imageUrl || message.thumbnailUrl) && (
                        <div className="mb-2 relative aspect-video rounded-md overflow-hidden">
                          <Image 
                              src={getThumbnailSrc(message) || message.imageUrl || ''} 
                              alt="Attached image" 
                              fill
                              className="object-cover" 
                          />
                        </div>
                      )}
                      {message.videoUrl && (
                        <div className="mb-2 relative aspect-video rounded-md overflow-hidden bg-black">
                          <video src={message.videoUrl} preload="metadata" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                             <Video className="h-6 w-6 text-white opacity-70" />
                          </div>
                        </div>
                      )}
                      {message.audioUrl && (
                        <div className="my-2" onClick={(e) => e.stopPropagation()}>
                          <audio src={message.audioUrl} controls className="w-full" />
                          {message.fileName && <p className="text-[10px] mt-1 text-muted-foreground/80">{message.fileName}</p>}
                        </div>
                      )}
                      {getMessageText(message).trim() && (
                        <div onClick={(e) => e.stopPropagation()}>
                            <LinkifiedText text={getMessageText(message)} />
                        </div>
                      )}
                      <div className="mt-4 flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
                              <Link href={`/chat#${message.id}`}>
                                  <ExternalLink className="h-3 w-3 mr-1" /> View in Chat
                              </Link>
                          </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </main>

      <Dialog open={!!viewingMedia} onOpenChange={() => setViewingMedia(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-none bg-black/95">
          <DialogHeader className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
            <DialogTitle className="text-white font-medium flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-sm">Shared by {viewingMedia?.sender}</span>
                <span className="text-[10px] opacity-70">
                  {viewingMedia?.createdAt && format(viewingMedia.createdAt.toDate(), "MMMM d, yyyy 'at' h:mm a")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {viewingMedia && (viewingMedia.imageUrl || viewingMedia.videoUrl) && (
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" asChild>
                    <a href={viewingMedia.imageUrl || viewingMedia.videoUrl} download target="_blank">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center min-h-[50vh] max-h-[85vh] p-2 pt-16">
            {viewingMedia?.imageUrl && (
              <div className="relative w-full h-full min-h-[400px]">
                <Image
                  src={viewingMedia.imageUrl}
                  alt="Full resolution"
                  fill
                  className="object-contain"
                  sizes="100vw"
                  priority
                />
              </div>
            )}
            {viewingMedia?.videoUrl && (
              <video
                src={viewingMedia.videoUrl}
                controls
                autoPlay
                className="max-w-full max-h-[80vh] rounded-md"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

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
