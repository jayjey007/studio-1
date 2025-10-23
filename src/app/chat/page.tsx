
"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc, Timestamp, where, getDocs, writeBatch, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Smile, X, Trash2, MessageSquareReply, Paperclip, LogOut, Bell, MoreVertical } from "lucide-react";
import { format } from "date-fns";
import { useFirebase, useMemoFirebase, updateDocumentNonBlocking } from "@/firebase";
import { useCollection } from "@/firebase/firestore/use-collection";


import { cn } from "@/lib/utils";
import { sendNotification } from "@/app/actions/send-notification";

const EMOJIS = ['😀', '😂', '😍', '🤔', '👍', '❤️', '🎉', '🔥', '🚀', '💯', '🙏', '🤷‍♂️', '🤧', '🥰'];

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
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [showNotificationButton, setShowNotificationButton] = useState(false);

  const isFilePickerOpen = useRef(false);

  const currentUserObject = useMemo(() => ALL_USERS.find(u => u.username === currentUser), [currentUser]);

  // With open rules, we can just fetch all messages from a single root collection.
  const messagesCollectionRef = useMemoFirebase(() => db ? collection(db, 'messages') : null, [db]);
  const messagesQuery = useMemoFirebase(() => messagesCollectionRef ? query(messagesCollectionRef, orderBy('createdAt', 'asc')) : null, [messagesCollectionRef]);
  const { data: messages, error: messagesError, isLoading: messagesLoading } = useCollection<Message>(messagesQuery);
  
  // Display errors from Firestore
  useEffect(() => {
    if (messagesError) {
        console.error("Error fetching messages:", messagesError);
        toast({
            title: "Error",
            description: messagesError.message,
            variant: "destructive",
        });
    }
  }, [messagesError, toast]);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem("isAuthenticated");
    sessionStorage.removeItem("currentUser");
    router.push("/");
  }, [router]);

    // Effect for user activity heartbeat
  useEffect(() => {
    if (!db || !currentUser) return;

    const userObject = ALL_USERS.find(u => u.username === currentUser);
    if (!userObject) return;

    const userDocRef = doc(db, "users", userObject.uid);

    const intervalId = setInterval(() => {
        // Use non-blocking update to avoid UI lag
        updateDocumentNonBlocking(userDocRef, {
            lastActive: serverTimestamp()
        });
    }, 5000); // Update every 5 seconds

    return () => clearInterval(intervalId);
  }, [db, currentUser]);
  
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
      // Don't log out if the file picker is the reason for the blur
      if (isFilePickerOpen.current) {
        return;
      }
      // handleLogout();
    };

    const handleWindowFocus = () => {
      // Reset the flag when the window regains focus
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


  const scrollToBottom = useCallback(() => {
    const scrollArea = scrollAreaRef.current;
    if (scrollArea) {
      const viewport = scrollArea.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        setTimeout(() => {
          viewport.scrollTop = viewport.scrollHeight;
        }, 100);
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);


  const handleEmojiClick = (emoji: string) => {
    setInput(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    // The window will regain focus now, so the focus handler will reset the ref.
  };
  
  const handleAttachClick = () => {
    // Set the flag right before opening the file picker
    isFilePickerOpen.current = true;
    fileInputRef.current?.click();
  };

  const cancelImagePreview = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  
  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput && !imageFile) return;
    if (!currentUser || !db || !storage || !currentUserObject) return;

    setIsSending(true);

    const recipientUser = ALL_USERS.find(u => u.username !== currentUser);
    if (!recipientUser) {
        toast({ title: "Error", description: "Could not find recipient.", variant: "destructive" });
        setIsSending(false);
        return;
    }

    try {
      let imageUrl: string | undefined = undefined;

      if (imageFile) {
        const imageRef = ref(storage, `chat_images/${currentUserObject.uid}_${Date.now()}_${imageFile.name}`);
        const snapshot = await uploadBytes(imageRef, imageFile);
        imageUrl = await getDownloadURL(snapshot.ref);
      }

      const messageTextToSend = trimmedInput || ' ';
      const encodedMessageText = encodeMessage(messageTextToSend);

      const replyingToData = replyingTo ? {
        replyingToId: replyingTo.id,
        replyingToText: getMessageText(replyingTo, 50),
        replyingToSender: replyingTo.sender,
      } : {};

      const messageData: Omit<Message, 'id' | 'createdAt'> & { createdAt: any } = {
        scrambledText: encodedMessageText,
        sender: currentUser,
        recipient: recipientUser.username,
        senderUid: currentUserObject.uid,
        recipientUid: recipientUser.uid,
        createdAt: serverTimestamp(),
        isEncoded: true,
        ...replyingToData,
      };
      
       if (imageUrl) {
        messageData.imageUrl = imageUrl;
      }
      
      const messagesCollection = collection(db, 'messages');
      const docRef = await addDoc(messagesCollection, messageData);

      const notificationResult = await sendNotification({
        message: messageTextToSend,
        sender: currentUser,
        messageId: docRef.id
      });

      if (!notificationResult.success && !notificationResult.skipped) {
        toast({
            title: "Notification Error",
            description: notificationResult.error || "Could not send notification.",
            variant: "destructive",
        });
      }

      setInput("");
      setReplyingTo(null);
      cancelImagePreview();

    } catch (error: any) {
      console.error("Error sending message:", error);
      let description = `Could not send message. Please try again.`;

      if (error.code) {
        switch (error.code) {
          case 'storage/unauthorized':
            description = "Permission Denied: You don't have permission to upload files. Please check storage security rules.";
            break;
          case 'storage/no-default-bucket':
            description = "Storage Error: Bucket not configured. Please check your Firebase project setup.";
            break;
          case 'permission-denied':
            description = "Permission Denied: You don't have permission to send messages. Please check Firestore security rules.";
            break;
          default:
            description = `An unexpected error occurred: ${error.code} - ${error.message}`;
        }
      } else {
         description = `An unexpected error occurred: ${error.message || String(error)}`;
      }

      toast({
        title: "Error Sending Message",
        description: description,
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
      toast({
        title: "Error",
        description: "Firebase not initialized or user not logged in.",
        variant: "destructive",
      });
      return;
    }

    try {
      const messaging = getMessaging(firebaseApp);
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        setShowNotificationButton(false);
        toast({ title: "Success", description: "Notification permission granted." });
        
        const serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const fcmToken = await getToken(messaging, { 
            vapidKey: 'BL8V7BHhy6nE9WICeE09mNiKFC1u71vroAb3p7JyjFpI5n05yZvMx84o14MFE4O3944a8IDYKyh0dzR1bm5PouU',
            serviceWorkerRegistration,
        });

        if (fcmToken) {
          const tokensCollection = collection(db, 'fcmTokens');
          await addDoc(tokensCollection, {
            token: fcmToken,
            username: currentUser,
            createdAt: serverTimestamp(),
          });
          toast({ title: 'Success', description: 'Notification token saved.' });
        } else {
          toast({ title: "Error", description: "Could not get notification token.", variant: "destructive" });
        }
      } else {
        toast({
          title: "Permission Denied",
          description: "You will not receive notifications.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error getting notification permission:', error);
       if (error.code === 'permission-denied' || error.code === 'messaging/permission-denied') {
             toast({
                title: 'Error Enabling Notifications',
                description: 'Permission to receive notifications was denied. Please check your browser settings.',
                variant: 'destructive',
            });
        } else {
            toast({
                title: "Error Requesting Permission",
                description: error.message || "An error occurred while requesting notification permission.",
                variant: "destructive",
            });
        }
    }
  };


  return (
    <>
      <div className="flex h-screen w-full flex-col bg-background">
      <div className="absolute top-2 right-2 z-10">
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
                <DropdownMenuItem onSelect={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        <main className="flex-1 overflow-hidden">
          <ScrollArea className="h-full" ref={scrollAreaRef}>
             <div className="px-4 py-6 md:px-6">
                <div className="space-y-4" onClick={() => selectedMessageId && setSelectedMessageId(null)}>
                {messages && messages.map((message) => (
                    <div key={message.id} id={message.id} className={cn("flex w-full", message.sender === currentUser && "justify-end")}>
                      <div
                        className={'w-auto max-w-[85%]'}
                      >
                        <Popover open={selectedMessageId === message.id} onOpenChange={(isOpen) => {
                          if (!isOpen) setSelectedMessageId(null);
                        }}>
                          <PopoverTrigger asChild>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMessageSelect(message);
                              }}
                              className={cn(
                                "rounded-lg p-3 text-sm cursor-pointer w-auto",
                                message.sender === currentUser
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-card text-card-foreground",
                                selectedMessageId === message.id ? (message.sender === currentUser ? 'bg-blue-700' : 'bg-muted') : ''
                              )}
                            >
                              {message.replyingToId && message.replyingToSender && (
                                  <a href={`#${message.replyingToId}`} className="block mb-2 p-2 rounded-md bg-black/20 hover:bg-black/30 transition-colors">
                                      <p className="text-xs font-semibold">{message.replyingToSender === currentUser ? 'You' : message.replyingToSender}</p>
                                      <p className="text-xs text-foreground/90">{message.replyingToText}</p>
                                  </a>
                              )}
                              {message.imageUrl && (
                                  <div className="mb-2">
                                    <Image
                                      src={message.imageUrl}
                                      alt="Attached image"
                                      width={300}
                                      height={300}
                                      className="max-w-full h-auto rounded-md"
                                      onLoad={scrollToBottom}
                                    />
                                  </div>
                                )}
                              <LinkifiedText text={getMessageText(message)} />
                              {message.createdAt && (
                                  <p
                                  className={cn(
                                      "text-xs mt-1",
                                      message.sender === currentUser
                                      ? "text-primary-foreground/70"
                                      : "text-muted-foreground/70"
                                  )}
                                  >
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
                                  <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => {
                                    setDeletingMessageId(message.id);
                                    setSelectedMessageId(null);
                                  }}>
                                      <Trash2 className="h-4 w-4" />
                                  </Button>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  ))}
                  {messagesLoading && (
                    <div className="flex justify-center items-center p-4">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  )}
              </div>
            </div>
          </ScrollArea>
        </main>
        <footer className="shrink-0 border-t bg-card p-2 md:p-4">
           {replyingTo && !imagePreview && (
              <div className="relative rounded-t-lg bg-muted/50 p-2 pl-4 pr-8 text-sm">
                <p className="font-semibold text-xs text-muted-foreground">
                  Replying to {replyingTo.sender === currentUser ? 'yourself' : replyingTo.sender}
                </p>
                <p className="truncate text-foreground">{getMessageText(replyingTo, 100)}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1/2 right-1 -translate-y-1/2 h-6 w-6"
                  onClick={() => setReplyingTo(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
             {imagePreview && (
              <div className="relative rounded-t-lg bg-muted/50 p-2">
                <Image
                  src={imagePreview}
                  alt="Image preview"
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded-md object-cover"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6"
                  onClick={cancelImagePreview}
                >
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
                accept="image/*"
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
            <Popover>
                <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                    <Smile className="h-4 w-4" />
                    <span className="sr-only">Add Emoji</span>
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" side="top" align="end">
                <div className="grid grid-cols-6 gap-1">
                    {EMOJIS.map((emoji) => (
                    <Button
                        key={emoji}
                        variant="ghost"
                        size="icon"
                        className="text-xl"
                        onClick={() => handleEmojiClick(emoji)}
                    >
                        {emoji}
                    </Button>
                    ))}
                </div>
                </PopoverContent>
            </Popover>
            <Textarea
              ref={inputRef}
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isSending}
              className={cn("max-h-32", (replyingTo || imagePreview) ? "rounded-t-none" : "")}
              rows={1}
            />
            <Button
                type="submit"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={handleSend}
                disabled={isSending || (!input.trim() && !imageFile)}
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
