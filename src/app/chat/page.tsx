
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, User, Smile, Paperclip, X, MoreHorizontal, Trash2, Pencil, Wand2 } from "lucide-react";
import { suggestScrambleMethods } from "@/ai/flows/suggest-scramble-methods";

import { cn } from "@/lib/utils";

const EMOJIS = ['😀', '😂', '😍', '🤔', '👍', '❤️', '🎉', '🔥', '🚀', '💯', '🙏', '🤷‍♂️', '🤧', '🥰'];

interface Message {
  id: string;
  scrambledText: string;
  sender: string;
  createdAt: any;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
}

const scrambleMessage = (message: string): string => {
  if (!message) return "";
  try {
    return btoa(unescape(encodeURIComponent(message)));
  } catch (error) {
    console.error("Error scrambling message:", error);
    return message;
  }
};

const unscrambleMessage = (scrambledMessage: string): string => {
  if (!scrambledMessage) return "";
  try {
    return decodeURIComponent(escape(atob(scrambledMessage)));
  } catch (error) {
    console.error("Error unscrambling message:", error);
    return scrambledMessage;
  }
};

const LinkifyText = ({ text }: { text: string }) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return (
    <p className="whitespace-pre-wrap">
      {parts.map((part, index) => {
        if (part.match(urlRegex)) {
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
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
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [showScrambled, setShowScrambled] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const { toast } = useToast();
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  
  const scrollToBottom = useCallback(() => {
    if (scrollViewportRef.current) {
      setTimeout(() => {
        if (scrollViewportRef.current) {
          scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
        }
      }, 100);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const storedUser = sessionStorage.getItem("currentUser");
        if (storedUser) {
           setCurrentUser(storedUser);
        } else {
           router.push("/");
        }
      } else {
        const isAuthenticated = sessionStorage.getItem("isAuthenticated");
        if (!isAuthenticated) {
            router.push("/");
        }
      }
    });
    return () => unsubscribe();
  }, [router]);
  
  useEffect(() => {
    if (!currentUser) return;
    
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const messagesData: Message[] = [];
      querySnapshot.forEach((doc) => {
        messagesData.push({ id: doc.id, ...doc.data() } as Message);
      });
      
      setMessages(messagesData);
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);


  const handleLogout = useCallback(async () => {
    sessionStorage.removeItem("isAuthenticated");
    sessionStorage.removeItem("currentUser");
    await signOut(auth);
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

  const handleStartEdit = (message: Message) => {
    setEditingMessageId(message.id);
    setEditingText(unscrambleMessage(message.scrambledText));
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  const handleUpdateMessage = async () => {
    if (!editingMessageId || !editingText.trim()) return;

    const messageRef = doc(db, "messages", editingMessageId);
    const newScrambledText = scrambleMessage(editingText);
    
    try {
      await updateDoc(messageRef, {
        scrambledText: newScrambledText,
      });
      handleCancelEdit();
    } catch (error) {
      console.error("Error updating message:", error);
      toast({
        title: "Error",
        description: "Could not update message.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMessage = async () => {
    if (!deletingMessageId) return;
    try {
      await deleteDoc(doc(db, "messages", deletingMessageId));
      setDeletingMessageId(null);
    } catch (error) {
      console.error("Error deleting message:", error);
      toast({
        title: "Error",
        description: "Could not delete message.",
        variant: "destructive",
      });
      setDeletingMessageId(null);
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setInput(prev => prev + emoji);
    textareaRef.current?.focus();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/')) {
        setMediaType('image');
      } else if (file.type.startsWith('video/')) {
        setMediaType('video');
      } else {
        toast({
          title: "Unsupported file type",
          description: "Please select an image or video file.",
          variant: "destructive",
        });
        return;
      }
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    if(fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleToggleScrambled = () => {
    setShowScrambled(prev => !prev);
  };


  const handleSend = async () => {
    const trimmedInput = input.trim();
    if ((!trimmedInput && !mediaFile) || !currentUser) {
      return;
    }

    if (trimmedInput.toLowerCase() === 'toggle' && !mediaFile) {
      handleToggleScrambled();
      setInput('');
      textareaRef.current?.focus();
      return;
    }
    
    setIsSending(true);

    const messageToSend = trimmedInput;
    const mediaFileToSend = mediaFile;
    const mediaTypeToSend = mediaType;
    
    setInput("");
    removeMedia();

    let mediaUrl: string | undefined = undefined;

    try {
      if (mediaFileToSend) {
        const storageRef = ref(storage, `chat_media/${Date.now()}_${mediaFileToSend.name}`);
        await uploadBytes(storageRef, mediaFileToSend);
        mediaUrl = await getDownloadURL(storageRef);
      }

      const scrambledMessageText = scrambleMessage(messageToSend);

      const messageToStore: Omit<Message, 'id'> = {
        scrambledText: scrambledMessageText,
        sender: currentUser,
        createdAt: serverTimestamp(),
        ...(mediaUrl && { mediaUrl, mediaType: mediaTypeToSend! }),
      };
      
      await addDoc(collection(db, "messages"), messageToStore);
      
      scrollToBottom();

    } catch (error: any) {
      console.error("ERROR SENDING MESSAGE:", error);
      let description = "Could not send message. Please try again.";
       if (error.code === 'storage/unauthorized') {
        description = "You don't have permission to upload files. Please check your Firebase Storage rules."
      } else if (error.code === 'storage/retry-limit-exceeded') {
        description = "Network error: Could not upload file. Please check your connection and Firebase Storage rules."
      }

      toast({
        title: "Error sending message",
        description: `${description} (Code: ${error.code})`,
        variant: "destructive",
      });

      setInput(messageToSend);
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const handleEditKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleUpdateMessage();
    }
  };
  
  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          event.preventDefault();
          setMediaType('image');
          setMediaFile(file);
          setMediaPreview(URL.createObjectURL(file));
          break;
        }
      }
    }
  };

  const handleSuggestScramble = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      toast({
        title: "Empty Message",
        description: "Please type a message to get scramble suggestions.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSuggesting(true);
    try {
      const result = await suggestScrambleMethods({ message: trimmedInput });
      if (result.suggestions && result.suggestions.length > 0) {
        const randomIndex = Math.floor(Math.random() * result.suggestions.length);
        const suggestion = result.suggestions[randomIndex];
        setInput(suggestion);
        toast({
          title: "AI Suggestion Applied",
          description: `The AI suggested a new way to scramble your message.`
        });
      } else {
        toast({
          title: "No Suggestions",
          description: "The AI couldn't come up with a suggestion this time.",
          variant: "destructive"
        });
      }
    } catch(e) {
      console.error("Error getting scramble suggestion:", e);
      toast({
        title: "AI Error",
        description: "There was an error communicating with the AI.",
        variant: "destructive"
      });
    } finally {
      setIsSuggesting(false);
      textareaRef.current?.focus();
    }
  };

  const getMessageContent = (message: Message) => {
    if (showScrambled) {
      return message.scrambledText;
    }
    return unscrambleMessage(message.scrambledText);
  };

  return (
    <>
      <div 
        className="flex h-screen w-full flex-col bg-background"
        onMouseLeave={handleLogout}
      >
        <header className="flex h-16 items-center justify-center border-b bg-card px-4 shrink-0">
          <h1 className="text-xl font-semibold">AgentChat</h1>
        </header>
        <main className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
             <ScrollAreaPrimitive.Viewport ref={scrollViewportRef} className="h-full w-full rounded-[inherit]">
              <div className="p-4 md:p-6">
                <div className="flex flex-col gap-2">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex items-start gap-3 w-full group",
                        message.sender === currentUser ? "justify-end" : "justify-start"
                      )}
                    >
                      {message.sender !== currentUser && (
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            <User className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      
                      {message.sender === currentUser && (
                         <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                             <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                             </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleStartEdit(message)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              <span>Edit</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeletingMessageId(message.id)} className="text-red-500">
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                         </DropdownMenu>
                      )}

                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl p-3 text-sm",
                          message.sender === currentUser
                            ? "bg-primary text-primary-foreground rounded-br-none"
                            : "bg-muted rounded-bl-none"
                        )}
                      >
                        {message.mediaUrl && message.mediaType === 'image' && (
                           <div className="mb-2">
                              <Image 
                                src={message.mediaUrl} 
                                alt="Chat image"
                                width={300}
                                height={200}
                                className="rounded-xl object-cover"
                                onLoad={scrollToBottom}
                              />
                          </div>
                        )}
                        {message.mediaUrl && message.mediaType === 'video' && (
                          <video 
                            src={message.mediaUrl} 
                            controls
                            className="rounded-xl mb-2 w-full max-w-[300px]"
                            onLoadedData={scrollToBottom}
                          />
                        )}
                        {editingMessageId === message.id ? (
                          <div className="space-y-2">
                            <Textarea 
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              onKeyDown={handleEditKeyPress}
                              className="bg-background text-foreground resize-none"
                              rows={3}
                            />
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={handleCancelEdit}>Cancel</Button>
                              <Button size="sm" onClick={handleUpdateMessage}>Save</Button>
                            </div>
                          </div>
                        ) : (
                          message.scrambledText && <LinkifyText text={getMessageContent(message)} />
                        )}
                      </div>
                       {message.sender === currentUser && (
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                             <User className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </ScrollAreaPrimitive.Viewport>
            <ScrollBar />
            <ScrollAreaPrimitive.Corner />
          </ScrollArea>
        </main>
        <footer className="border-t bg-card p-2 space-y-2">
          {mediaPreview && (
            <div className="relative w-24 h-24 ml-2">
              {mediaType === 'image' && <Image src={mediaPreview} alt="Image preview" fill className="rounded-md object-cover" />}
              {mediaType === 'video' && <video src={mediaPreview} muted autoPlay loop className="rounded-md object-cover w-full h-full" />}
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                onClick={removeMedia}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="flex items-end gap-2 p-2">
            <div className="flex items-center gap-1">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,video/*"
              />
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={handleAttachClick}>
                  <Paperclip className="h-5 w-5" />
                  <span className="sr-only">Attach File</span>
              </Button>
               <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                    <Smile className="h-5 w-5" />
                    <span className="sr-only">Add Emoji</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2">
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
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={handleSuggestScramble} disabled={isSuggesting}>
                {isSuggesting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />}
                <span className="sr-only">Scramble with AI</span>
              </Button>
            </div>
            <Textarea
              ref={textareaRef}
              placeholder="Type your message..."
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              onPaste={handlePaste}
              disabled={isSending || isSuggesting}
              className="flex-1 rounded-2xl bg-muted resize-none max-h-40 overflow-y-auto"
              rows={1}
            />
            <Button
              type="submit"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full bg-primary text-primary-foreground"
              onClick={handleSend}
              disabled={isSending || isSuggesting || (!input.trim() && !mediaFile)}
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4" />}
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </footer>
      </div>
      <AlertDialog open={!!deletingMessageId} onOpenChange={(open) => !open && setDeletingMessageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your message.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingMessageId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMessage}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

    