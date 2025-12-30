
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { collection, query, where, orderBy, getDocs, Timestamp, or } from "firebase/firestore";
import { useFirebase } from "@/firebase";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowLeft, Image as ImageIcon, Video, Music } from "lucide-react";
import { format } from "date-fns";
import type { Message } from "../chat/page";
import { cn } from "@/lib/utils";

const ALL_USERS = [
    { username: 'Crazy', uid: 'QYTCCLfLg1gxdLLQy34y0T2Pz3g2' },
    { username: 'Cool', uid: 'N2911Sj2g8cT03s5v31s1p9V8s22' }
];

export default function MediaPage() {
  const router = useRouter();
  const { firestore: db } = useFirebase();
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const user = sessionStorage.getItem("currentUser");
    if (!user) {
      router.replace("/");
    } else {
      setCurrentUser(user);
    }
  }, [router]);

  const currentUserObject = useMemo(() => ALL_USERS.find(u => u.username === currentUser), [currentUser]);

  const fetchMedia = useCallback(async () => {
    if (!db || !currentUserObject) return;

    setIsLoading(true);
    const messagesRef = collection(db, "messages");
    
    // Query for messages that have an imageUrl, videoUrl, or audioUrl
    const mediaQuery = query(
      messagesRef,
      or(
        where("imageUrl", "!=", null),
        where("videoUrl", "!=", null),
        where("audioUrl", "!=", null)
      ),
      orderBy("createdAt", "desc")
    );

    try {
      const querySnapshot = await getDocs(mediaQuery);
      const allMedia = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      
      // Filter client-side to ensure user is part of the conversation
      const userMedia = allMedia.filter(
        item => item.senderUid === currentUserObject.uid || item.recipientUid === currentUserObject.uid
      );
      
      setMediaItems(userMedia);
    } catch (error) {
      console.error("Error fetching media:", error);
    } finally {
      setIsLoading(false);
    }
  }, [db, currentUserObject]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const getMediaType = (item: Message) => {
    if (item.imageUrl) return 'image';
    if (item.videoUrl) return 'video';
    if (item.audioUrl) return 'audio';
    return 'unknown';
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
        <h1 className="flex-1 text-xl font-semibold">Shared Media</h1>
      </header>
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 md:p-6">
            {isLoading ? (
              <div className="flex justify-center items-center p-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : mediaItems.length === 0 ? (
              <div className="text-center text-muted-foreground py-10">
                <ImageIcon className="mx-auto h-12 w-12" />
                <p className="mt-4">No media has been shared yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
                {mediaItems.map((item) => (
                  <Link href={`/chat#${item.id}`} key={item.id}>
                    <Card className="group cursor-pointer overflow-hidden aspect-square relative hover:bg-muted/50 transition-colors">
                      {getMediaType(item) === 'image' && item.imageUrl && (
                        <Image
                          src={item.imageUrl}
                          alt={`Shared by ${item.sender}`}
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                        />
                      )}
                      {getMediaType(item) === 'video' && item.videoUrl && (
                        <video
                          src={item.videoUrl}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                      )}
                      {getMediaType(item) === 'audio' && (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-muted p-2">
                           <Music className="h-1/2 w-1/2 text-muted-foreground" />
                           {item.fileName && <p className="text-xs text-center text-muted-foreground mt-2 truncate">{item.fileName}</p>}
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-white text-xs">
                        <p className="font-semibold">{item.sender}</p>
                        <p>{item.createdAt && format(item.createdAt.toDate(), "MMM d, yyyy")}</p>
                      </div>
                       <div className="absolute top-1 right-1 bg-black/50 rounded-full p-1">
                          {getMediaType(item) === 'image' && <ImageIcon className="h-3 w-3 text-white" />}
                          {getMediaType(item) === 'video' && <Video className="h-3 w-3 text-white" />}
                          {getMediaType(item) === 'audio' && <Music className="h-3 w-3 text-white" />}
                       </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
