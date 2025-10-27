
"use client";

import { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc, Timestamp, limit, startAfter, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, X, Trash2, MessageSquareReply, Paperclip, LogOut, Bell, MoreVertical } from "lucide-react";
import { format } from "date-fns";
import { useFirebase, useMemoFirebase, setDocumentMergeNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { cn } from "@/lib/utils";
import { sendNotification } from "@/app/actions/send-notification";

const MESSAGE_PAGE_SIZE = 20;

const ALL_USERS = [
    { username: 'Crazy', uid: 'QYTCCLfLg1gxdLLQy34y0T2Pz3g2' },
    { username: 'Cool', uid: 'N2911Sj2g8cT03s5v31s1p9V8s22' }
];

interface Message {
  id: string;
  scrambledText: string;
  sender: string; // username
  recipient: string; //username
  senderUid: string;
  recipientUid: string;
  createdAt: Timestamp;
  isEncoded: boolean;
  replyingToId?: string;
  replyingToText?: string;
  replyingToSender?: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  fileName?: string;
}

// Simple Caesar cipher for encoding
const encodeMessage = (text: string, shift: number = 1): string => {
  return text
    .split('')
    .map(char => {
      const charCode = char.charCodeAt(0);
      // Simple check for basic ASCII printable characters to avoid scrambling symbols/emojis too much
      if (charCode >= 32 && charCode <= 126) {
        return String.fromCharCode(charCode + shift);
      }
      return char;
    })
    .join('');
};

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
  
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio' | null>(null);

  const [showNotificationButton, setShowNotificationButton] = useState(false);

  const isFilePickerOpen = useRef(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  
  const currentUserObject = useMemo(() => ALL_USERS.find(u => u.username === currentUser), [currentUser]);

  const messagesCollectionRef = useMemoFirebase(() => db ? collection(db, 'messages') : null, [db]);
  const prevScrollHeightRef = useRef(0);
  const atBottomRef = useRef(true);


  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) {
      if (atBottomRef.current) {
        viewport.scrollTop = viewport.scrollHeight;
      } else {
        const newScrollHeight = viewport.scrollHeight;
        if (newScrollHeight > prevScrollHeightRef.current) {
          viewport.scrollTop += newScrollHeight - prevScrollHeightRef.current;
        }
      }
      prevScrollHeightRef.current = viewport.scrollHeight;
    }
  }, [messages]);


  // Effect for fetching messages
  useEffect(() => {
    if (!messagesCollectionRef) return;

    setIsLoading(true);

    const q = query(messagesCollectionRef, orderBy('createdAt', 'desc'), limit(MESSAGE_PAGE_SIZE));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const newMessages = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)).reverse();
        
        setMessages(prevMessages => {
          // A simple way to merge new real-time updates with existing messages
          const messageMap = new Map(prevMessages.map(m => [m.id, m]));
          newMessages.forEach(m => messageMap.set(m.id, m));
          return Array.from(messageMap.values()).sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
        });
        
        const lastDoc = querySnapshot.docs[querySnapshot.docs.length > 0 ? querySnapshot.docs.length - 1 : 0];

        setLastVisible(lastDoc);
        
        setHasMore(querySnapshot.docs.length >= MESSAGE_PAGE_SIZE);
        
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching initial messages:", error);
        toast({ title: "Error", description: "Could not load messages.", variant: "destructive" });
        setIsLoading(false);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesCollectionRef]);


  const loadMoreMessages = useCallback(async () => {
      if (!messagesCollectionRef || !hasMore || isLoadingMore || !lastVisible) return;
      
      setIsLoadingMore(true);
      
      const q = query(messagesCollectionRef, orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(MESSAGE_PAGE_SIZE));

      try {
          const documentSnapshots = await getDocs(q);
          const newMessages = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)).reverse();
          
          if (documentSnapshots.docs.length > 0) {
            const newLastVisible = documentSnapshots.docs[documentSnapshots.docs.length - 1];
            
            setMessages(prev => [...newMessages, ...prev]);
            setLastVisible(newLastVisible);
          }
          
          if(documentSnapshots.docs.length < MESSAGE_PAGE_SIZE){
              setHasMore(false);
          }
      } catch (error: any) {
          console.error("Error fetching more messages:", error);
          toast({ title: "Error", description: "Could not load older messages.", variant: "destructive" });
      } finally {
          setIsLoadingMore(false);
      }
  }, [messagesCollectionRef, hasMore, lastVisible, isLoadingMore, toast]);
  
  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          loadMoreMessages();
        }
      },
      { threshold: 1.0, root: viewportRef.current }
    );

    const currentRef = topOfListRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, isLoading, isLoadingMore, loadMoreMessages]);


  const handleLogout = useCallback(() => {
    sessionStorage.removeItem("isAuthenticated");
    sessionStorage.removeItem("currentUser");
    router.push("/");
  }, [router]);

    // Effect for user activity heartbeat
  useEffect(() => {
    if (!db || !currentUserObject) return;
    
    const userDocRef = doc(db, "users", currentUserObject.uid);
  
    const intervalId = setInterval(() => {
      setDocumentMergeNonBlocking(userDocRef, {
        lastActive: serverTimestamp()
      });
    }, 5000); 
  
    return () => clearInterval(intervalId);
  }, [db, currentUserObject]);
  
  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem("isAuthenticated");
    const user = sessionStorage.getItem("currentUser");
    if (!isAuthenticated || !user) {
      router.push("/");
    } else {
      setCurrentUser(user);
    }
  }, [router]);
  
  useEffect(() => {
    const handleWindowBlur = () => {
      if (isFilePickerOpen.current) {
        return;
      }
      handleLogout();
    };

    const handleWindowFocus = () => {
      if (isFilePickerOpen.current) {
        isFilePickerOpen.current = false;
      }
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
        if (supported && Notification.permission !== 'granted') {
            setShowNotificationButton(true);
        }
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
        reader.onloadend = () => {
          setMediaPreview(reader.result as string);
        };
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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  
  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput && !mediaFile) return;
    if (!currentUser || !db || !storage || !currentUserObject) return;

    setIsSending(true);
    atBottomRef.current = true;

    const recipientUser = ALL_USERS.find(u => u.username !== currentUser);
    if (!recipientUser) {
        toast({ title: "Error", description: "Could not find recipient.", variant: "destructive" });
        setIsSending(false);
        return;
    }

    try {
      const messageData: Omit<Message, 'id' | 'createdAt'> & { createdAt: any } = {
        scrambledText: encodeMessage(trimmedInput || ' '),
        sender: currentUser,
        recipient: recipientUser.username,
        senderUid: currentUserObject.uid,
        recipientUid: recipientUser.uid,
        createdAt: serverTimestamp(),
        isEncoded: true,
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
      
      await sendNotification({
        message: trimmedInput,
        sender: currentUser,
        messageId: docRef?.id || ''
      });

      setInput("");
      setReplyingTo(null);
      cancelMediaPreview();

    } catch (error: any) {
      console.error("Error sending message:", error);
      toast({
        title: "Error Sending Message",
        description: `An unexpected error occurred: ${error.message || String(error)}`,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }
      inputRef.current?.focus();
    }
  };


  const handleDeleteMessage = async () => {
    if (!deletingMessageId || !db) return;

    try {
      const msgRef = doc(db, "messages", deletingMessageId);
      await deleteDoc(msgRef);
      toast({
        title: "Success",
        description: "Message deleted.",
      });
    } catch (error) {
      console.error("Error deleting message:", error);
      toast({
        title: "Error",
        description: "Could not delete message. Please check your permissions.",
        variant: "destructive",
      });
    } finally {
      setDeletingMessageId(null);
      setSelectedMessageId(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isSending) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const getMessageText = (message: Message, truncate?: number) => {
    const text = message.isEncoded ? decodeMessage(message.scrambledText) : message.scrambledText;
    if (truncate && text.length > truncate) {
      return text.substring(0, truncate) + "...";
    }
    return text;
  }
  
  const handleReplyClick = (message: Message) => {
    setReplyingTo(message);
    setSelectedMessageId(null);
    inputRef.current?.focus();
  }

  const handleMessageSelect = (message: Message) => {
    if (selectedMessageId === message.id) {
      setSelectedMessageId(null);
    } else {
      setSelectedMessageId(message.id);
    }
  };

  const handleRequestPermission = async () => {
    if (!firebaseApp || !db || !currentUser) {
      toast({ title: "Error", description: "Firebase not initialized or user not logged in.", variant: "destructive" });
      return;
    }
    try {
      const messaging = getMessaging(firebaseApp);
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setShowNotificationButton(false);
        toast({ title: "Success", description: "Notification permission granted." });
        const serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const fcmToken = await getToken(messaging, { vapidKey: 'BL8V7BHhy6nE9WICeE09mNiKFC1u71vroAb3p7JyjFpI5n05yZvMx84o14MFE4O3944a8IDYKyh0dzR1bm5PouU', serviceWorkerRegistration });
        if (fcmToken) {
          const tokenRef = doc(db, 'fcmTokens', currentUser);
          await setDocumentMergeNonBlocking(tokenRef, { token: fcmToken, username: currentUser, createdAt: serverTimestamp() });
          toast({ title: 'Success', description: 'Notification token saved.' });
        } else {
          toast({ title: "Error", description: "Could not get notification token.", variant: "destructive" });
        }
      } else {
        toast({ title: "Permission Denied", description: "You will not receive notifications.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error('Error getting notification permission:', error);
      toast({ title: "Error Requesting Permission", description: error.message || "An error occurred.", variant: "destructive" });
    }
  };

  const handleScroll = () => {
    const viewport = viewportRef.current;
    if (viewport) {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 1;
      atBottomRef.current = isAtBottom;
    }
  };


  return (
    <>
      <div className="flex h-screen w-full flex-col bg-background">
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                  <span className="sr-only">More options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {showNotificationButton && (
                  <DropdownMenuItem onSelect={handleRequestPermission}>
                    <Bell className="mr-2 h-4 w-4" />
                    <span>Enable Notifications</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => toast({title: "This button is redundant", description: "You can use the dedicated logout button now."})}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout (in menu)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        <main className="flex-1 overflow-hidden">
          <ScrollArea className="h-full" viewportRef={viewportRef} onScroll={handleScroll}>
             <div className="px-4 py-6 md:px-6">
                <div className="space-y-4" onClick={() => selectedMessageId && setSelectedMessageId(null)}>
                  
                  {isLoading && (
                      <div className="flex justify-center items-center p-4">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                  )}
                  
                  {hasMore && !isLoading && <div ref={topOfListRef} className="h-1"/>}

                   {isLoadingMore && (
                       <div className="flex justify-center py-2">
                           <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                       </div>
                   )}

                  {messages.map((message) => (
                    <div key={message.id} id={message.id} className={cn("flex w-full", message.sender === currentUser && "justify-end")}>
                      <div className={'w-auto max-w-[85%]'}>
                        <Popover open={selectedMessageId === message.id} onOpenChange={(isOpen) => { if (!isOpen) setSelectedMessageId(null); }}>
                          <PopoverTrigger asChild>
                            <div
                              onClick={(e) => { e.stopPropagation(); handleMessageSelect(message); }}
                              className={cn("rounded-lg p-3 text-sm cursor-pointer w-auto", message.sender === currentUser ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground", selectedMessageId === message.id ? (message.sender === currentUser ? 'bg-blue-700' : 'bg-muted') : '')}
                            >
                              {message.replyingToId && message.replyingToSender && (
                                  <a href={`#${message.replyingToId}`} className="block mb-2 p-2 rounded-md bg-black/20 hover:bg-black/30 transition-colors">
                                      <p className="text-xs font-semibold">{message.replyingToSender === currentUser ? 'You' : message.replyingToSender}</p>
                                      <p className="text-xs text-foreground/90">{message.replyingToText}</p>
                                  </a>
                              )}
                              {message.imageUrl && (
                                <div className="mb-2">
                                  <Image src={message.imageUrl} alt="Attached image" width={300} height={300} className="max-w-full h-auto rounded-md" />
                                </div>
                              )}
                              {message.videoUrl && (
                                <div className="mb-2">
                                  <video src={message.videoUrl} controls className="max-w-full h-auto rounded-md" />
                                </div>
                              )}
                              {message.audioUrl && (
                                <div className="my-2">
                                  <audio src={message.audioUrl} controls className="w-full" />
                                  {message.fileName && <p className="text-xs mt-1 text-muted-foreground/80">{message.fileName}</p>}
                                </div>
                              )}
                              {getMessageText(message).trim() && <LinkifiedText text={getMessageText(message)} />}
                              {message.createdAt && (
                                <p className={cn("text-xs mt-1", message.sender === currentUser ? "text-primary-foreground/70" : "text-muted-foreground/70")}>
                                  {format(message.createdAt.toDate(), "h:mm a")}
                                </p>
                              )}
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-1" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleReplyClick(message)}>
                                <MessageSquareReply className="h-4 w-4" />
                              </Button>
                              {message.sender === currentUser && (
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => { setDeletingMessageId(message.id); setSelectedMessageId(null); }}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
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
           {replyingTo && !mediaPreview && (
              <div className="relative rounded-t-lg bg-muted/50 p-2 pl-4 pr-8 text-sm">
                <p className="font-semibold text-xs text-muted-foreground">
                  Replying to {replyingTo.sender === currentUser ? 'yourself' : replyingTo.sender}
                </p>
                <p className="truncate text-foreground">{getMessageText(replyingTo, 100)}</p>
                <Button variant="ghost" size="icon" className="absolute top-1/2 right-1 -translate-y-1/2 h-6 w-6" onClick={() => setReplyingTo(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
             {mediaPreview && (
              <div className="relative rounded-t-lg bg-muted/50 p-2">
                {mediaType === 'image' && <Image src={mediaPreview} alt="Image preview" width={80} height={80} className="h-20 w-20 rounded-md object-cover" />}
                {mediaType === 'video' && <video src={mediaPreview} className="h-20 w-auto rounded-md" />}
                {mediaType === 'audio' && <audio src={mediaPreview} controls className="h-10 w-full" />}
                <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={cancelMediaPreview}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          <div className="flex items-end gap-2">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,video/*,audio/*"
            />
             <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={handleAttachClick}
                disabled={isSending}
              >
                <Paperclip className="h-4 w-4" />
                <span className="sr-only">Attach File</span>
              </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout" className="h-10 w-10 shrink-0">
              <LogOut className="h-4 w-4" />
            </Button>
            <Textarea
              ref={inputRef}
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isSending}
              className={cn("max-h-32", (replyingTo || mediaPreview) ? "rounded-t-none" : "")}
              rows={1}
            />
            <Button
                type="submit"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={handleSend}
                disabled={isSending || (!input.trim() && !mediaFile)}
            >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4" />}
                <span className="sr-only">Send</span>
            </Button>
          </div>
        </footer>
      </div>
      <AlertDialog
        open={!!deletingMessageId}
        onOpenChange={(open) => !open && setDeletingMessageId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              message.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMessage}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

    