
"use client";

import { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { collection, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc, Timestamp, limit, startAfter, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, X, Trash2, MessageSquareReply, Paperclip, LogOut, Bell, MoreVertical, Star, Heart, ListPlus, BookText, Mic, StopCircle, Video, GalleryVertical, Download, Zap } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { useFirebase, useMemoFirebase, setDocumentMergeNonBlocking, addDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { cn } from "@/lib/utils";
import { sendNotification } from "@/app/actions/send-notification";
import Link from "next/link";

const MESSAGE_PAGE_SIZE = 25;

const ALL_USERS = [
    { username: 'Crazy', uid: 'QYTCCLfLg1gxdLLQy34y0T2Pz3g2' },
    { username: 'Cool', uid: 'N2911Sj2g8cT03s5v31s1p9V8s22' }
];

export interface Message {
  id: string;
  scrambledText: string;
  sender: string;
  recipient: string;
  senderUid: string;
  recipientUid: string;
  createdAt: Timestamp;
  isEncoded: boolean;
  replyingToId?: string;
  replyingToText?: string;
  replyingToSender?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  fileName?: string;
  isFavorited?: boolean;
}

const encodeMessage = (text: string, shift: number = 1): string => {
  return text
    .split('')
    .map(char => {
      const charCode = char.charCodeAt(0);
      if (charCode >= 32 && charCode <= 126) {
        return String.fromCharCode(charCode + shift);
      }
      return char;
    })
    .join('');
};

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
                            onClick={(e) => e.stopPropagation()}
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

const HeartIcon = ({ className }: { className?: string }) => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="url(#heart-gradient)"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="heart-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#FF8A8A', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#FFB2B2', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );

const ThumbnailImage = ({ message, className }: { message: Message, className?: string }) => {
  const [src, setSrc] = useState<string>(() => {
    if (message.thumbnailUrl) return message.thumbnailUrl;
    if (message.imageUrl) {
        return message.imageUrl.replace('/chat_images%2F', '/chat_images_thumbnail%2F');
    }
    return '';
  });

  const handleError = () => {
    if (message.imageUrl && src !== message.imageUrl) {
      setSrc(message.imageUrl);
    }
  };

  if (!src && !message.imageUrl) return null;

  return (
    <div className="relative aspect-square w-full max-w-[280px] overflow-hidden rounded-md bg-muted/20">
      <Image 
        src={src || message.imageUrl || ""} 
        alt="Attached image" 
        fill
        className={cn("object-cover hover:opacity-90 transition-opacity", className)}
        onError={handleError}
        sizes="(max-width: 768px) 280px, 300px"
      />
    </div>
  );
};

export default function ChatPage() {
  const router = useRouter();
  const { firestore: db, storage, firebaseApp } = useFirebase();
  
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const { toast } = useToast();
  
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const topOfListRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [viewingMedia, setViewingMedia] = useState<Message | null>(null);
  
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio' | null>(null);

  const [showNotificationButton, setShowNotificationButton] = useState(false);

  const isFilePickerOpen = useRef(false);
  const isPermissionPromptOpen = useRef(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  
  const currentUserObject = useMemo(() => ALL_USERS.find(u => u.username === currentUser), [currentUser]);

  const messagesCollectionRef = useMemoFirebase(() => db ? collection(db, 'messages') : null, [db]);
  const prevScrollHeightRef = useRef(0);
  const atBottomRef = useRef(true);
  const shouldScrollToBottomRef = useRef(true);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const [daysUntil, setDaysUntil] = useState<number | null>(null);

  useEffect(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    let targetDate = new Date(currentYear, 5, 26); // June 26
    if (today > targetDate) targetDate.setFullYear(currentYear + 1);
    setDaysUntil(differenceInCalendarDays(targetDate, today));
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    if (viewportRef.current) {
        viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
        // Fallback for tricky browsers
        requestAnimationFrame(() => {
          if (viewportRef.current) {
            viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
          }
        });
    }
  }, []);

  // Handle scroll position maintenance
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    if (shouldScrollToBottomRef.current) {
        viewport.scrollTop = viewport.scrollHeight;
        shouldScrollToBottomRef.current = false;
        // Second pass for mobile settlement
        setTimeout(() => {
          if (viewportRef.current) viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
        }, 100);
    } else if (prevScrollHeightRef.current > 0 && !atBottomRef.current) {
        const diff = viewport.scrollHeight - prevScrollHeightRef.current;
        if (diff > 0) {
            viewport.scrollTop += diff;
        }
    }
    prevScrollHeightRef.current = viewport.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!messagesCollectionRef) return;

    setIsLoading(true);
    const q = query(messagesCollectionRef, orderBy('createdAt', 'desc'), limit(MESSAGE_PAGE_SIZE));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const newMessages = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)).reverse();
        
        setMessages(prevMessages => {
          const messageMap = new Map(prevMessages.map(m => [m.id, m]));
          newMessages.forEach(m => messageMap.set(m.id, m));
          const updatedMessages = Array.from(messageMap.values()).sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));

          const isInitialLoad = prevMessages.length === 0;
          const lastMessage = updatedMessages[updatedMessages.length - 1];
          const userSentMessage = lastMessage?.sender === currentUser && updatedMessages.length > prevMessages.length;
          
          if (isInitialLoad || userSentMessage || atBottomRef.current) {
            shouldScrollToBottomRef.current = true;
          }

          return updatedMessages;
        });
        
        if (querySnapshot.docs.length > 0 && !lastVisible) {
            setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
        }
        setHasMore(querySnapshot.docs.length >= MESSAGE_PAGE_SIZE);
        setIsLoading(false);
    }, (error) => {
        console.error("Snapshot error:", error);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [messagesCollectionRef, currentUser, lastVisible]);

  const loadMoreMessages = useCallback(async () => {
      if (!messagesCollectionRef || !hasMore || isLoadingMore || !lastVisible) return;
      
      setIsLoadingMore(true);
      const viewport = viewportRef.current;
      if (viewport) {
          prevScrollHeightRef.current = viewport.scrollHeight;
      }
      
      const q = query(messagesCollectionRef, orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(MESSAGE_PAGE_SIZE));

      try {
          const documentSnapshots = await getDocs(q);
          const newMessages = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)).reverse();
          
          if (documentSnapshots.docs.length > 0) {
            setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
            shouldScrollToBottomRef.current = false;
            
            setMessages(prev => {
                const messageMap = new Map([...newMessages, ...prev].map(m => [m.id, m]));
                return Array.from(messageMap.values()).sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
            });
          }
          
          if(documentSnapshots.docs.length < MESSAGE_PAGE_SIZE) setHasMore(false);
      } catch (error: any) {
          toast({ title: "Error", description: "Could not load older messages.", variant: "destructive" });
      } finally {
          setIsLoadingMore(false);
      }
  }, [messagesCollectionRef, hasMore, lastVisible, isLoadingMore, toast]);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          loadMoreMessages();
        }
      },
      { threshold: 0.1, root: viewportRef.current }
    );

    const currentRef = topOfListRef.current;
    if (currentRef) observer.observe(currentRef);
    return () => { if (currentRef) observer.unobserve(currentRef); };
  }, [hasMore, isLoading, isLoadingMore, loadMoreMessages]);


  const handleLogout = useCallback(() => {
    sessionStorage.removeItem("isAuthenticated");
    sessionStorage.removeItem("currentUser");
    router.replace("/");
  }, [router]);

  useEffect(() => {
    if (!db || !currentUserObject) return;
    const userDocRef = doc(db, "users", currentUserObject.uid);
    const intervalId = setInterval(() => {
      setDocumentMergeNonBlocking(userDocRef, { lastActive: serverTimestamp() });
    }, 5000); 
    return () => clearInterval(intervalId);
  }, [db, currentUserObject]);
  
  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem("isAuthenticated");
    const user = sessionStorage.getItem("currentUser");
    if (!isAuthenticated || !user) {
      router.replace("/");
    } else {
      setCurrentUser(user);
    }
  }, [router]);
  
  useEffect(() => {
    const handleWindowBlur = () => {
      if (isFilePickerOpen.current || isPermissionPromptOpen.current) return;
      handleLogout();
    };

    const handleWindowFocus = () => {
      if (isFilePickerOpen.current) isFilePickerOpen.current = false;
      if (isPermissionPromptOpen.current) isPermissionPromptOpen.current = false;
    };

    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [handleLogout]);
  
  useEffect(() => {
    const checkSupport = async () => {
        const supported = await isSupported();
        if (supported && Notification.permission !== 'granted') setShowNotificationButton(true);
    };
    checkSupport();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const fileType = file.type.split('/')[0];
      if (['image', 'video', 'audio'].includes(fileType)) {
        setMediaFile(file);
        setMediaType(fileType as 'image' | 'video' | 'audio');
        const reader = new FileReader();
        reader.onloadend = () => setMediaPreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        toast({ title: "Unsupported File", description: "Please select an image, video, or audio file.", variant: "destructive" });
      }
    }
    isFilePickerOpen.current = false;
  };
  
  const handleAttachClick = () => {
    isFilePickerOpen.current = true;
    fileInputRef.current?.click();
  };

  const cancelMediaPreview = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  
  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput && !mediaFile) return;
    if (!currentUser || !db || !storage || !currentUserObject) return;

    setIsSending(true);
    shouldScrollToBottomRef.current = true;

    const recipientUser = ALL_USERS.find(u => u.username !== currentUser);
    if (!recipientUser) {
        setIsSending(false);
        return;
    }

    try {
      const messageData: any = {
        scrambledText: encodeMessage(trimmedInput || ' '),
        sender: currentUser,
        recipient: recipientUser.username,
        senderUid: currentUserObject.uid,
        recipientUid: recipientUser.uid,
        createdAt: serverTimestamp(),
        isEncoded: true,
        isFavorited: false,
      };

      if (mediaFile && mediaType) {
        const folder = mediaType === 'image' ? 'chat_images' : mediaType === 'video' ? 'chat_videos' : 'chat_audios';
        const mediaRef = ref(storage, `${folder}/${currentUserObject.uid}_${Date.now()}_${mediaFile.name}`);
        const snapshot = await uploadBytes(mediaRef, mediaFile);
        const downloadURL = await getDownloadURL(snapshot.ref);

        if (mediaType === 'image') messageData.imageUrl = downloadURL;
        if (mediaType === 'video') messageData.videoUrl = downloadURL;
        if (mediaType === 'audio') {
            messageData.audioUrl = downloadURL;
            messageData.fileName = mediaFile.name;
        }
      }

      if (replyingTo) {
        messageData.replyingToId = replyingTo.id;
        messageData.replyingToText = getMessageText(replyingTo, 50);
        messageData.replyingToSender = replyingTo.sender;
      }
      
      const docRef = await addDocumentNonBlocking(collection(db, 'messages'), messageData);
      await sendNotification({ message: trimmedInput, sender: currentUser, messageId: docRef?.id || '' });

      setInput("");
      setReplyingTo(null);
      cancelMediaPreview();
    } catch (error: any) {
      toast({ title: "Error", description: `Could not send: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSending(false);
      if (inputRef.current) inputRef.current.style.height = "auto";
      inputRef.current?.focus();
    }
  };


  const handleDeleteMessage = async () => {
    if (!deletingMessageId || !db) return;
    try {
      await deleteDoc(doc(db, "messages", deletingMessageId));
    } catch (error) {
      toast({ title: "Error", description: "Could not delete message.", variant: "destructive" });
    } finally {
      setDeletingMessageId(null);
      setSelectedMessageId(null);
    }
  };

  const handleToggleFavorite = (message: Message) => {
    if (!db) return;
    updateDocumentNonBlocking(doc(db, "messages", message.id), { isFavorited: !message.isFavorited });
    setSelectedMessageId(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isSending) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const getMessageText = (message: Message, truncate?: number) => {
    const text = message.isEncoded ? decodeMessage(message.scrambledText) : message.scrambledText;
    if (truncate && text.length > truncate) return text.substring(0, truncate) + "...";
    return text;
  }
  
  const handleReplyClick = (message: Message) => {
    setReplyingTo(message);
    setSelectedMessageId(null);
    inputRef.current?.focus();
  }

  const handleMessageSelect = (message: Message) => {
    setSelectedMessageId(prev => prev === message.id ? null : message.id);
  };

  const handleRequestPermission = async () => {
    if (!firebaseApp || !db || !currentUser) return;
    try {
      const messaging = getMessaging(firebaseApp);
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setShowNotificationButton(false);
        const serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const fcmToken = await getToken(messaging, { vapidKey: 'BL8V7BHhy6nE9WICeE09mNiKFC1u71vroAb3p7JyjFpI5n05yZvMx84o14MFE4O3944a8IDYKyh0dzR1bm5PouU', serviceWorkerRegistration });
        if (fcmToken) {
          await setDocumentMergeNonBlocking(doc(db, 'fcmTokens', currentUser), { token: fcmToken, username: currentUser, createdAt: serverTimestamp() });
        }
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const viewport = e.currentTarget;
    if (viewport) {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 50;
      atBottomRef.current = isAtBottom;
    }
  };

  const startRecording = async () => {
    try {
        isPermissionPromptOpen.current = true;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isPermissionPromptOpen.current = false;
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        mediaRecorderRef.current.ondataavailable = event => audioChunksRef.current.push(event.data);
        mediaRecorderRef.current.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp4' });
            const audioUrl = URL.createObjectURL(audioBlob);
            setMediaFile(new File([audioBlob], `voice-note-${Date.now()}.mp4`, { type: 'audio/mp4' }));
            setMediaPreview(audioUrl);
            setMediaType('audio');
        };
        mediaRecorderRef.current.start();
        setIsRecording(true);
    } catch (err) {
        isPermissionPromptOpen.current = false;
        toast({ title: "Microphone Error", description: "Could not access microphone.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
  };

  return (
    <>
      <div className="flex h-screen w-full flex-col bg-background overflow-hidden">
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          {daysUntil !== null && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background/50 backdrop-blur-sm px-2 py-1 rounded-full shadow border">
              <HeartIcon className="h-4 w-4" />
              <span className="font-medium text-foreground">
                {daysUntil} {daysUntil === 1 ? 'day' : 'days'} left
              </span>
              <HeartIcon className="h-4 w-4" />
            </div>
          )}
        </div>
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {showNotificationButton && (
                  <DropdownMenuItem onSelect={handleRequestPermission}>
                    <Bell className="mr-2 h-4 w-4" /> Enable Notifications
                  </DropdownMenuItem>
                )}
                 <DropdownMenuItem asChild>
                    <Link href="/favorites"><Heart className="mr-2 h-4 w-4" /> Favorites</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/romance-score"><Zap className="mr-2 h-4 w-4 text-primary" /> Romance Score</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/media"><GalleryVertical className="mr-2 h-4 w-4" /> Shared Media</Link>
                  </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/bucket-list"><ListPlus className="mr-2 h-4 w-4" /> Bucket List</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/letter"><BookText className="mr-2 h-4 w-4" /> Shared Letter</Link>
                </DropdownMenuItem>
                 <DropdownMenuItem asChild>
                  <Link href="/video" onClick={() => isPermissionPromptOpen.current = true}><Video className="mr-2 h-4 w-4" /> Video Call</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        <main className="flex-1 overflow-hidden relative">
          <ScrollArea className="h-full" viewportRef={viewportRef} onScroll={handleScroll}>
             <div className="px-4 py-6 md:px-6 min-h-full flex flex-col justify-end">
                <div className="space-y-4" onClick={() => selectedMessageId && setSelectedMessageId(null)}>
                  <div ref={topOfListRef} className="h-4 w-full flex justify-center">
                    {hasMore && !isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground opacity-30" />}
                  </div>
                  {messages.map((message) => (
                    <div key={message.id} id={message.id} className={cn("flex w-full", message.sender === currentUser ? "justify-end" : "justify-start")}>
                      <div className="max-w-[85%] group">
                        <Popover open={selectedMessageId === message.id} onOpenChange={(isOpen) => { if (!isOpen) setSelectedMessageId(null); }}>
                          <PopoverTrigger asChild>
                            <div
                              onClick={(e) => { e.stopPropagation(); handleMessageSelect(message); }}
                              className={cn("rounded-lg p-3 text-sm cursor-pointer transition-colors", 
                                message.sender === currentUser ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground border",
                                selectedMessageId === message.id && (message.sender === currentUser ? "ring-2 ring-primary-foreground/50" : "ring-2 ring-primary/50")
                              )}
                            >
                              {message.replyingToId && (
                                  <a href={`#${message.replyingToId}`} className="block mb-2 p-2 rounded-md bg-black/10 hover:bg-black/20 transition-colors border-l-2 border-primary">
                                      <p className="text-[10px] font-bold opacity-70 uppercase">{message.replyingToSender === currentUser ? 'You' : message.replyingToSender}</p>
                                      <p className="text-xs truncate opacity-90">{message.replyingToText}</p>
                                  </a>
                              )}
                              {message.imageUrl && (
                                <div className="mb-2" onClick={(e) => { e.stopPropagation(); setViewingMedia(message); }}>
                                  <ThumbnailImage message={message} />
                                </div>
                              )}
                              {message.videoUrl && (
                                <div className="mb-2" onClick={(e) => { e.stopPropagation(); setViewingMedia(message); }}>
                                  <div className="relative aspect-video w-[280px] cursor-pointer group bg-muted rounded-md overflow-hidden">
                                    <video src={message.videoUrl} preload="metadata" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                                        <Video className="h-10 w-10 text-white opacity-80" />
                                    </div>
                                  </div>
                                </div>
                              )}
                              {message.audioUrl && (
                                <div className="my-2" onClick={(e) => e.stopPropagation()}>
                                  <audio src={message.audioUrl} controls className="w-full h-8" />
                                </div>
                              )}
                              {getMessageText(message).trim() && <LinkifiedText text={getMessageText(message)} />}
                              <div className={cn("flex items-center text-[10px] mt-1 opacity-70", message.sender === currentUser ? "justify-end" : "justify-start")}>
                                {message.isFavorited && <Star className="h-2.5 w-2.5 mr-1 fill-current" />}
                                <span>{message.createdAt ? format(message.createdAt.toDate(), "h:mm a") : 'Sending...'}</span>
                              </div>
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-1 flex gap-1 bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleReplyClick(message)}><MessageSquareReply className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleFavorite(message)}><Star className={cn("h-4 w-4", message.isFavorited && "fill-yellow-500 text-yellow-500")} /></Button>
                              {message.sender === currentUser && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setDeletingMessageId(message.id); setSelectedMessageId(null); }}><Trash2 className="h-4 w-4" /></Button>}
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </ScrollArea>
        </main>
        <footer className="shrink-0 border-t bg-card p-2 md:p-4">
           {replyingTo && (
              <div className="relative rounded-t-lg bg-muted/50 p-2 pl-4 pr-8 text-xs border-b">
                <p className="font-bold opacity-60 uppercase">Replying to {replyingTo.sender === currentUser ? 'yourself' : replyingTo.sender}</p>
                <p className="truncate opacity-90">{getMessageText(replyingTo, 100)}</p>
                <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-5 w-5" onClick={() => setReplyingTo(null)}><X className="h-3 w-3" /></Button>
              </div>
            )}
             {mediaPreview && (
              <div className="relative rounded-t-lg bg-muted/50 p-2 flex items-center gap-2 border-b">
                {mediaType === 'image' && <div className="relative h-16 w-16"><Image src={mediaPreview} alt="" fill className="rounded-md object-cover border" /></div>}
                {mediaType === 'video' && <video src={mediaPreview} className="h-16 w-auto rounded-md border" />}
                {mediaType === 'audio' && <audio src={mediaPreview} controls className="h-8 flex-1" />}
                <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-5 w-5" onClick={cancelMediaPreview}><X className="h-3 w-3" /></Button>
              </div>
            )}
          <div className="flex items-end gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*,audio/*" />
             <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={handleAttachClick} disabled={isSending || isRecording}><Paperclip className="h-5 w-5" /></Button>
             <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={handleLogout} aria-label="Logout">
              <LogOut className="h-5 w-5" />
            </Button>
            <Textarea
              ref={inputRef}
              placeholder={isRecording ? "Recording..." : "Type your message..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isSending || isRecording || !!mediaFile}
              className={cn("max-h-32 min-h-[40px] transition-all", (replyingTo || mediaPreview) ? "rounded-t-none" : "")}
              rows={1}
            />
             {isRecording ? (
                <Button size="icon" variant="destructive" className="h-10 w-10 shrink-0 rounded-full animate-pulse" onClick={stopRecording}><StopCircle className="h-5 w-5" /></Button>
            ) : (
                <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0" onClick={startRecording} disabled={isSending || !!mediaFile}><Mic className="h-5 w-5" /></Button>
            )}
            <Button size="icon" className="h-10 w-10 shrink-0 rounded-full" onClick={handleSend} disabled={isSending || (!input.trim() && !mediaFile) || isRecording}>
                {isSending ? <Loader2 className="h-5 w-5 animate-spin"/> : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </footer>
      </div>

      <Dialog open={!!viewingMedia} onOpenChange={() => setViewingMedia(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-none bg-black/95 sm:rounded-none">
          <DialogHeader className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
            <DialogTitle className="text-white font-medium flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" asChild>
                  <a href={viewingMedia?.imageUrl || viewingMedia?.videoUrl} download target="_blank"><Download className="h-4 w-4" /></a>
                </Button>
              </div>
              <div className="flex flex-col text-right">
                <span>Shared by {viewingMedia?.sender}</span>
                <span className="text-[10px] opacity-60">{viewingMedia?.createdAt && format(viewingMedia.createdAt.toDate(), "MMM d, yyyy h:mm a")}</span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center min-h-[60vh] max-h-[90vh] p-2">
            {viewingMedia?.imageUrl && <div className="relative w-full h-[60vh] sm:h-[80vh]"><Image src={viewingMedia.imageUrl} alt="" fill className="object-contain" priority /></div>}
            {viewingMedia?.videoUrl && <video src={viewingMedia.videoUrl} controls autoPlay className="max-w-full max-h-[85vh] rounded-md" />}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingMessageId} onOpenChange={(open) => !open && setDeletingMessageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete message?</AlertDialogTitle><AlertDialogDescription>This will permanently remove this message for everyone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteMessage}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
