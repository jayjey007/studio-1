
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { collection, query, where, orderBy, getDocs, Timestamp, or, limit, startAfter, QueryDocumentSnapshot } from "firebase/firestore";
import { useFirebase } from "@/firebase";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Loader2, ArrowLeft, Image as ImageIcon, Video, Music, LogOut, ExternalLink, Download } from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Message } from "../chat/page";

const ALL_USERS = [
    { username: 'Crazy', uid: 'QYTCCLfLg1gxdLLQy34y0T2Pz3g2' },
    { username: 'Cool', uid: 'N2911Sj2g8cT03s5v31s1p9V8s22' }
];

const PAGE_SIZE = 12;

type MediaTab = 'images' | 'videos' | 'audios';

export default function MediaPage() {
  const router = useRouter();
  const { firestore: db } = useFirebase();
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<MediaTab>('images');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [imageItems, setImageItems] = useState<Message[]>([]);
  const [videoItems, setVideoItems] = useState<Message[]>([]);
  const [audioItems, setAudioItems] = useState<Message[]>([]);

  const [lastVisibleImage, setLastVisibleImage] = useState<QueryDocumentSnapshot | null>(null);
  const [lastVisibleVideo, setLastVisibleVideo] = useState<QueryDocumentSnapshot | null>(null);
  const [lastVisibleAudio, setLastVisibleAudio] = useState<QueryDocumentSnapshot | null>(null);

  const [hasMoreImages, setHasMoreImages] = useState(true);
  const [hasMoreVideos, setHasMoreVideos] = useState(true);
  const [hasMoreAudios, setHasMoreAudios] = useState(true);

  const [selectedMedia, setSelectedMedia] = useState<Message | null>(null);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

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

  const currentUserObject = useMemo(() => ALL_USERS.find(u => u.username === currentUser), [currentUser]);

  const getThumbnailSrc = (item: Message) => {
    if (item.thumbnailUrl) return item.thumbnailUrl;
    if (item.imageUrl) {
        return item.imageUrl.replace('/chat_images%2F', '/chat_images_thumbnail%2F');
    }
    return '';
  };

  const fetchMedia = useCallback(async (mediaType: MediaTab, lastVisible: QueryDocumentSnapshot | null = null) => {
    if (!db || !currentUserObject) return;

    if (lastVisible === null) setIsLoading(true);
    else setIsLoadingMore(true);

    const field = mediaType === 'images' ? 'imageUrl' : mediaType === 'videos' ? 'videoUrl' : 'audioUrl';
    
    let mediaQuery = query(
      collection(db, "messages"),
      where(field, ">", ""),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE)
    );

    if (lastVisible) {
        mediaQuery = query(mediaQuery, startAfter(lastVisible));
    }
    
    try {
      const querySnapshot = await getDocs(mediaQuery);
      const newItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      const newLastVisible = querySnapshot.docs[querySnapshot.docs.length - 1] ?? null;

      if (mediaType === 'images') {
        setImageItems(prev => lastVisible ? [...prev, ...newItems] : newItems);
        setLastVisibleImage(newLastVisible);
        setHasMoreImages(newItems.length === PAGE_SIZE);
      } else if (mediaType === 'videos') {
        setVideoItems(prev => lastVisible ? [...prev, ...newItems] : newItems);
        setLastVisibleVideo(newLastVisible);
        setHasMoreVideos(newItems.length === PAGE_SIZE);
      } else if (mediaType === 'audios') {
        setAudioItems(prev => lastVisible ? [...prev, ...newItems] : newItems);
        setLastVisibleAudio(newLastVisible);
        setHasMoreAudios(newItems.length === PAGE_SIZE);
      }
    } catch (error) {
      console.error("Error fetching media:", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [db, currentUserObject]);
  
  useEffect(() => {
    if(currentUserObject) {
      fetchMedia('images');
    }
  }, [currentUserObject, fetchMedia]);

  const handleTabChange = (value: string) => {
    const newTab = value as MediaTab;
    setActiveTab(newTab);
    if (newTab === 'videos' && videoItems.length === 0) fetchMedia('videos');
    if (newTab === 'audios' && audioItems.length === 0) fetchMedia('audios');
  };

  const loadMoreMedia = useCallback(() => {
    if (activeTab === 'images' && hasMoreImages && !isLoadingMore) {
        fetchMedia('images', lastVisibleImage);
    } else if (activeTab === 'videos' && hasMoreVideos && !isLoadingMore) {
        fetchMedia('videos', lastVisibleVideo);
    } else if (activeTab === 'audios' && hasMoreAudios && !isLoadingMore) {
        fetchMedia('audios', lastVisibleAudio);
    }
  }, [activeTab, hasMoreImages, hasMoreVideos, hasMoreAudios, isLoadingMore, fetchMedia, lastVisibleImage, lastVisibleVideo, lastVisibleAudio]);

  useEffect(() => {
      const options = { root: null, rootMargin: '0px', threshold: 1.0 };
      observerRef.current = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) loadMoreMedia();
      }, options);
      if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
      return () => observerRef.current?.disconnect();
  }, [loadMoreMedia]);

  const renderMediaGrid = (items: Message[], type: MediaTab) => {
    const hasMore = type === 'images' ? hasMoreImages : type === 'videos' ? hasMoreVideos : hasMoreAudios;
    return (
      <div className="p-4 md:p-6">
        {items.length === 0 && !isLoading ? (
          <div className="text-center text-muted-foreground py-10">
            <p>No {type} have been shared yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
            {items.map((item) => (
              <Card 
                key={item.id} 
                className="group cursor-pointer overflow-hidden aspect-square relative hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedMedia(item)}
              >
                {type === 'images' && (item.imageUrl || item.thumbnailUrl) && (
                  <Image
                    src={getThumbnailSrc(item) || item.imageUrl || ''}
                    alt={`Shared by ${item.sender}`}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                )}
                {type === 'videos' && item.videoUrl && (
                  <div className="relative w-full h-full">
                    <video
                      src={item.videoUrl}
                      preload="metadata"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Video className="h-8 w-8 text-white opacity-70" />
                    </div>
                  </div>
                )}
                {type === 'audios' && (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-muted p-2">
                     <Music className="h-1/2 w-1/2 text-muted-foreground" />
                     {item.fileName && <p className="text-xs text-center text-muted-foreground mt-2 truncate w-full">{item.fileName}</p>}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-white text-[10px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="font-semibold truncate">{item.sender}</p>
                  <p>{item.createdAt && format(item.createdAt.toDate(), "MMM d")}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
        <div ref={loadMoreRef} className="h-10 w-full flex justify-center items-center mt-4">
          {isLoadingMore && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
          {!isLoadingMore && !hasMore && items.length > 0 && <p className="text-sm text-muted-foreground">End of results.</p>}
        </div>
      </div>
    );
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
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b bg-card px-4 md:px-6">
        <Button variant="outline" size="icon" className="shrink-0" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back</span>
        </Button>
        <h1 className="flex-1 text-xl font-semibold">Shared Media</h1>
      </header>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col flex-1 overflow-hidden">
        <TabsList className="shrink-0 border-b-0 rounded-none p-0 h-auto">
            <div className="px-4 w-full">
                <div className="inline-flex items-center justify-start rounded-none border-b-2 border-transparent w-full">
                    <TabsTrigger value="images" className="relative h-10 px-4 whitespace-nowrap">Images</TabsTrigger>
                    <TabsTrigger value="videos" className="relative h-10 px-4 whitespace-nowrap">Videos</TabsTrigger>
                    <TabsTrigger value="audios" className="relative h-10 px-4 whitespace-nowrap">Audios</TabsTrigger>
                </div>
            </div>
        </TabsList>
        <main className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
                {isLoading && activeTab === 'images' && imageItems.length === 0 ? (
                    <div className="flex justify-center items-center p-10">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <>
                        <TabsContent value="images">{renderMediaGrid(imageItems, 'images')}</TabsContent>
                        <TabsContent value="videos">{renderMediaGrid(videoItems, 'videos')}</TabsContent>
                        <TabsContent value="audios">{renderMediaGrid(audioItems, 'audios')}</TabsContent>
                    </>
                )}
            </ScrollArea>
        </main>
      </Tabs>

      <Dialog open={!!selectedMedia} onOpenChange={() => setSelectedMedia(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-none bg-black/95">
          <DialogHeader className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
            <DialogTitle className="text-white font-medium flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-sm">Shared by {selectedMedia?.sender}</span>
                <span className="text-[10px] opacity-70">
                  {selectedMedia?.createdAt && format(selectedMedia.createdAt.toDate(), "MMMM d, yyyy 'at' h:mm a")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" asChild>
                  <Link href={`/chat#${selectedMedia?.id}`}>
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
                {selectedMedia && (selectedMedia.imageUrl || selectedMedia.videoUrl || selectedMedia.audioUrl) && (
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" asChild>
                    <a href={selectedMedia.imageUrl || selectedMedia.videoUrl || selectedMedia.audioUrl} download target="_blank">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center min-h-[50vh] max-h-[85vh] p-2 pt-16">
            {selectedMedia?.imageUrl && (
              <div className="relative w-full h-full min-h-[400px]">
                <Image
                  src={selectedMedia.imageUrl}
                  alt="Full resolution"
                  fill
                  className="object-contain"
                  sizes="100vw"
                  priority
                />
              </div>
            )}
            {selectedMedia?.videoUrl && (
              <video
                src={selectedMedia.videoUrl}
                controls
                autoPlay
                className="max-w-full max-h-[80vh] rounded-md"
              />
            )}
            {selectedMedia?.audioUrl && (
              <div className="w-full max-w-md p-8 bg-card rounded-lg flex flex-col items-center gap-4">
                <Music className="h-12 w-12 text-primary" />
                <p className="text-center font-medium">{selectedMedia.fileName || 'Audio Message'}</p>
                <audio src={selectedMedia.audioUrl} controls className="w-full" />
              </div>
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
