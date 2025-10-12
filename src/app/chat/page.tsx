
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, User, Smile, Paperclip, X, Trash2, MessageSquareReply } from "lucide-react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";

const EMOJIS = ['😀', '😂', '😍', '🤔', '👍', '❤️', '🎉', '🔥', '🚀', '💯', '🙏', '🤷‍♂️', '🤧', '🥰'];

interface Message {
  id: string;
  scrambledText: string;
  sender: string;
  createdAt: Timestamp;
  imageUrl?: string;
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  const getDisplayName = useCallback((sender: string) => {
    if (sender === 'user1') return 'Crazy_S';
    if (sender === 'user2') return 'Cool_J';
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

    window.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
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
          isEncoded: data.isEncoded === undefined ? false : data.isEncoded,
          ...data 
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if(fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if ((!trimmedInput && !imageFile) || !currentUser) return;

    setIsSending(true);
    setInput("");
    
    const tempId = `temp_${Date.now()}`;
    const encodedMessageText = encodeMessage(trimmedInput);

    const replyingToData = replyingTo ? {
      replyingToId: replyingTo.id,
      replyingToText: getMessageText(replyingTo, 50),
      replyingToSender: getDisplayName(replyingTo.sender),
    } : {};
    
    setReplyingTo(null);

    // Create a temporary message for optimistic UI update
    const tempMessage: Message = {
      id: tempId,
      scrambledText: encodedMessageText,
      sender: currentUser,
      createdAt: Timestamp.now(),
      isEncoded: true,
      imageUrl: imagePreview || undefined, // Use preview for optimistic update
      ...replyingToData,
    };
    
    // Add temp message to state
    setMessages(prev => [...prev, tempMessage]);
    setSelectedMessageId(null);
    removeImage();

    try {
      let imageUrl: string | undefined = undefined;
      if (imageFile) {
        const storageRef = ref(storage, `chat_images/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      }

      const messageToStore: Omit<Message, 'id'> = {
        scrambledText: encodedMessageText,
        sender: currentUser,
        createdAt: serverTimestamp(),
        isEncoded: true,
        ...(imageUrl && { imageUrl }),
        ...replyingToData,
      };

      await addDoc(collection(db, "messages"), messageToStore);
      
      // The real-time listener will automatically add the confirmed message.
      // We don't need to do anything here on success.

    } catch (error: any) {
      console.error("Error sending message:", error);
      let description = "Could not send message. Please try again.";
      if (error.code === 'storage/unauthorized') {
        description = "You don't have permission to upload images. Please check your Firebase Storage rules."
      } else if (error.code === 'storage/retry-limit-exceeded') {
        description = "Network error: Could not upload image. Please check your connection and Firebase Storage rules."
      }

      toast({
        title: "Error",
        description: description,
        variant: "destructive",
      });
    } finally {
        // Always remove the optimistic message, as the listener will add the real one.
        // If there was an error, this removes the message that failed to send.
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setIsSending(false);
        // Reset textarea height
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
                     {getDisplayName(message.sender) !== currentUser && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback>
                          <User className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                    )}
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
                              : "bg-card border",
                            selectedMessageId === message.id ? (getDisplayName(message.sender) === currentUser ? 'bg-blue-700' : 'bg-muted') : ''
                          )}
                        >
                          {message.replyingToId && message.replyingToSender && (
                              <a href={`#${message.replyingToId}`} className="block mb-2 p-2 rounded-md bg-black/20 hover:bg-black/30 transition-colors">
                                  <p className="text-xs font-semibold">{getDisplayName(message.replyingToSender) === currentUser ? 'You' : getDisplayName(message.replyingToSender)}</p>
                                  <p className="text-xs text-primary-foreground/80">{message.replyingToText}</p>
                              </a>
                          )}
                          {message.imageUrl && (
                              <Image
                              src={message.imageUrl}
                              alt="Chat image"
                              width={300}
                              height={200}
                              className="rounded-md mb-2 object-cover"
                              onLoad={scrollToBottom}
                              />
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
                    {getDisplayName(message.sender) === currentUser && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback>
                          <User className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
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
                <p className="truncate text-muted-foreground">{getMessageText(replyingTo, 100)}</p>
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
            <div className="relative w-24 h-24 mb-2 ml-2">
              <Image src={imagePreview} alt="Image preview" layout="fill" className="rounded-md object-cover" />
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                onClick={removeImage}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={handleAttachClick}>
                <Paperclip className="h-4 w-4" />
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
              className={cn("max-h-32", replyingTo ? "rounded-t-none" : "")}
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
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              className="hidden"
              accept="image/*"
            />
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
