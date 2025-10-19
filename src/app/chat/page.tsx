
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc, Timestamp, setDoc } from "firebase/firestore";
import { db, messaging } from "@/lib/firebase";
import { getToken, Messaging } from "firebase/messaging";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Smile, X, Trash2, MessageSquareReply, Bell } from "lucide-react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";

const EMOJIS = ['😀', '😂', '😍', '🤔', '👍', '❤️', '🎉', '🔥', '🚀', '💯', '🙏', '🤷‍♂️', '🤧', '🥰'];

interface Message {
  id: string;
  scrambledText: string;
  sender: string;
  createdAt: Timestamp;
  isEncoded: boolean;
  replyingToId?: string;
  replyingToText?: string;
  replyingToSender?: string;
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [showNotificationButton, setShowNotificationButton] = useState(false);

  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      setShowNotificationButton(true);
    }
  }, []);

  const handleNotificationPermission = async () => {
    if (!currentUser) return;
    
    const messagingInstance = await messaging;
    
    if (!messagingInstance) {
      toast({
        title: "Unsupported Browser",
        description: "Push notifications are not supported on this browser or device.",
        variant: "destructive",
      });
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setShowNotificationButton(false);
        toast({
          title: "Success",
          description: "Push notifications enabled!",
        });

        const currentToken = await getToken(messagingInstance, { vapidKey: "YOUR_VAPID_KEY_HERE" });
        if (currentToken) {
          const tokenRef = doc(db, "fcmTokens", currentUser);
          await setDoc(tokenRef, {
            uid: currentUser,
            token: currentToken,
            createdAt: serverTimestamp(),
          });
        } else {
          console.log('No registration token available. Request permission to generate one.');
          toast({
            title: "Token Error",
            description: "Could not get push token. This can happen on iOS if the app is not added to the home screen.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Info",
          description: "Push notifications were not enabled.",
          variant: "default",
        });
      }
    } catch (error) {
      console.error('An error occurred while requesting permission ', error);
      toast({
        title: "Permission Error",
        description: "An error occurred while enabling notifications. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getDisplayName = useCallback((sender: string) => {
    if (sender === 'Crazy') return 'Crazy';
    if (sender === 'Cool') return 'Cool';
    if (sender === 'user1') return 'Crazy';
    if (sender === 'user2') return 'Cool';
    if (sender === 'Crazy_S') return 'Crazy';
    if (sender === 'Cool_J') return 'Cool';
    return sender;
  }, []);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem("isAuthenticated");
    sessionStorage.removeItem("currentUser");
    router.push("/");
  }, [router]);
  
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleLogout();
      }
    };
    
    const handlePageHide = (event: PageTransitionEvent) => {
      if (!event.persisted) {
        handleLogout();
      }
    }

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('blur', handleLogout);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('blur', handleLogout);
    };
  }, [handleLogout]);

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
    if (!currentUser) return;
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const messagesData: Message[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        messagesData.push({ 
          id: doc.id, 
          scrambledText: data.scrambledText,
          sender: data.sender,
          createdAt: data.createdAt,
          isEncoded: data.isEncoded === undefined ? false : data.isEncoded,
          replyingToId: data.replyingToId,
          replyingToText: data.replyingToText,
          replyingToSender: data.replyingToSender
        } as Message);
      });
      setMessages(messagesData);
    }, (error) => {
        console.error("Error fetching real-time messages:", error);
        toast({
            title: "Error",
            description: "Could not fetch messages. Please check your connection and permissions.",
            variant: "destructive",
        });
    });

    return () => unsubscribe();
  }, [currentUser, toast]);

  const scrollToBottom = () => {
    const scrollArea = scrollAreaRef.current;
    if (scrollArea) {
      const viewport = scrollArea.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        setTimeout(() => {
          viewport.scrollTop = viewport.scrollHeight;
        }, 0);
      }
    }
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  const handleEmojiClick = (emoji: string) => {
    setInput(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || !currentUser) return;
  
    setIsSending(true);
    
    const encodedMessageText = encodeMessage(trimmedInput);
  
    const replyingToData = replyingTo ? {
      replyingToId: replyingTo.id,
      replyingToText: getMessageText(replyingTo, 50),
      replyingToSender: getDisplayName(replyingTo.sender),
    } : {};
    
    setInput("");
    setReplyingTo(null);
    setSelectedMessageId(null);
  
    try {
      const messageToStore = {
        scrambledText: encodedMessageText,
        sender: currentUser,
        createdAt: serverTimestamp(),
        isEncoded: true,
        ...replyingToData,
      };
  
      await addDoc(collection(db, "messages"), messageToStore);
      
    } catch (error: any) {
      console.error("Error sending message:", error);
      let description = "Could not send message. Please try again.";
      if (error.code === 'permission-denied') {
        description = "You don't have permission to send messages. Please check your Firestore rules."
      }
  
      toast({
        title: "Error sending message",
        description: description,
        variant: "destructive",
      });
      // Restore input if sending failed
      setInput(trimmedInput);
    } finally {
        setIsSending(false);
        if (inputRef.current) {
            inputRef.current.style.height = "auto";
        }
        inputRef.current?.focus();
    }
  };

  const handleDeleteMessage = async () => {
    if (!deletingMessageId) return;

    try {
      await deleteDoc(doc(db, "messages", deletingMessageId));
      toast({
        title: "Success",
        description: "Message deleted.",
      });
    } catch (error) {
      console.error("Error deleting message:", error);
      toast({
        title: "Error",
        description: "Could not delete message. Please try again.",
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


  return (
    <>
      <div className="flex h-screen w-full flex-col bg-background">
        <main className="flex-1 overflow-hidden">
          <ScrollArea className="h-full" ref={scrollAreaRef}>
            <div className="p-4 md:p-6" onClick={() => selectedMessageId && setSelectedMessageId(null)}>
              <div className="flex flex-col gap-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    id={message.id}
                    className={cn(
                      "group flex w-full items-start gap-3",
                      getDisplayName(message.sender) === currentUser
                        ? "justify-end"
                        : "justify-start"
                    )}
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
                            "max-w-[75%] rounded-lg p-3 text-sm cursor-pointer",
                            getDisplayName(message.sender) === currentUser
                              ? "bg-primary text-primary-foreground"
                              : "bg-card text-card-foreground",
                            selectedMessageId === message.id ? (getDisplayName(message.sender) === currentUser ? 'bg-blue-700' : 'bg-muted') : ''
                          )}
                        >
                          {message.replyingToId && message.replyingToSender && (
                              <a href={`#${message.replyingToId}`} className="block mb-2 p-2 rounded-md bg-black/20 hover:bg-black/30 transition-colors">
                                  <p className="text-xs font-semibold">{getDisplayName(message.replyingToSender) === currentUser ? 'You' : getDisplayName(message.replyingToSender)}</p>
                                  <p className="text-xs text-foreground/90">{message.replyingToText}</p>
                              </a>
                          )}
                          <LinkifiedText text={getMessageText(message)} />
                          {message.createdAt && (
                              <p
                              className={cn(
                                  "text-xs mt-1",
                                  getDisplayName(message.sender) === currentUser
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
                          {getDisplayName(message.sender) === currentUser && (
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
                ))}
                 {showNotificationButton && (
                    <div className="flex justify-center p-4">
                        <Button onClick={handleNotificationPermission}>
                            <Bell className="mr-2 h-4 w-4" /> Enable Notifications
                        </Button>
                    </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </main>
        <footer className="shrink-0 border-t bg-card p-2 md:p-4">
           {replyingTo && (
              <div className="relative rounded-t-lg bg-muted/50 p-2 pl-4 pr-8 text-sm">
                <p className="font-semibold text-xs text-muted-foreground">
                  Replying to {getDisplayName(replyingTo.sender) === currentUser ? 'yourself' : getDisplayName(replyingTo.sender)}
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
          <div className="flex items-end gap-2">
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
              className={cn("max-h-32", replyingTo ? "rounded-t-none" : "")}
              rows={1}
            />
            <Button
                type="submit"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={handleSend}
                disabled={isSending || !input.trim()}
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
