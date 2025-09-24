
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, User, Smile, Paperclip, X, MoreHorizontal, Trash2, Pencil } from "lucide-react";

import { cn } from "@/lib/utils";

const EMOJIS = ['😀', '😂', '😍', '🤔', '👍', '❤️', '🎉', '🔥', '🚀', '💯', '🙏', '🤷‍♂️', '🤧', '🥰'];

interface Message {
  id: string;
  scrambledText: string;
  sender: string;
  createdAt: any;
  imageUrl?: string;
}

const scrambleMessage = (message: string): string => {
  if (!message) return "";
  try {
    // Handles Unicode characters correctly
    return btoa(unescape(encodeURIComponent(message)));
  } catch (error) {
    console.error("Error scrambling message:", error);
    return message; // Fallback to original message
  }
};

const unscrambleMessage = (scrambledMessage: string): string => {
  if (!scrambledMessage) return "";
  try {
    // Handles Unicode characters correctly
    return decodeURIComponent(escape(atob(scrambledMessage)));
  } catch (error) {
    console.error("Error unscrambling message:", error);
    // This might happen if the message was not scrambled correctly (e.g., old data)
    return scrambledMessage; // Fallback to scrambled message
  }
};


export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(isSending);
  const [showScrambled, setShowScrambled] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPickingFile = useRef(false);

  // State for editing and deleting messages
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);

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
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth',
        });
      }
    }
  }, [messages, editingMessageId]);

  const handleLogout = useCallback(async () => {
    sessionStorage.removeItem("isAuthenticated");
    sessionStorage.removeItem("currentUser");
    await signOut(auth);
    router.push("/");
  }, [router]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleLogout();
        setShowScrambled(true);
      }
    };
    
    const handleFocus = () => {
        if(isPickingFile.current) {
            setTimeout(() => {
              isPickingFile.current = false;
            }, 500)
        }
    }

    const handleBlur = () => {
        if (!isPickingFile.current) {
          handleLogout();
        }
    }
    
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleAttachClick = () => {
    isPickingFile.current = true;
    fileInputRef.current?.click();
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if(fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleToggleScrambled = () => {
    setShowScrambled(prev => !prev);
  };


  const handleSend = async () => {
    const trimmedInput = input.trim();
    if ((!trimmedInput && !imageFile) || !currentUser) {
      return;
    }

    if (trimmedInput.toLowerCase() === 'toggle' && !imageFile) {
      handleToggleScrambled();
      setInput('');
      textareaRef.current?.focus();
      return;
    }
    
    setIsSending(true);

    const messageToSend = trimmedInput;
    const imageFileToSend = imageFile;
    
    setInput("");
    removeImage();

    let imageUrl: string | undefined = undefined;
    let scrambledMessageText = "";

    try {
      if (imageFileToSend) {
        const storageRef = ref(storage, `chat_images/${Date.now()}_${imageFileToSend.name}`);
        await uploadBytes(storageRef, imageFileToSend);
        imageUrl = await getDownloadURL(storageRef);
      }

      if (messageToSend) {
        scrambledMessageText = scrambleMessage(messageToSend);
      }

      const messageToStore: Omit<Message, 'id'> = {
        scrambledText: scrambledMessageText,
        sender: currentUser,
        createdAt: serverTimestamp(),
        ...(imageUrl && { imageUrl }),
      };
      
      await addDoc(collection(db, "messages"), messageToStore);
      
    } catch (error: any) {
      console.error("ERROR SENDING MESSAGE:", error);
      let description = "Could not send message. Please try again.";
       if (error.code === 'storage/unauthorized') {
        description = "You don't have permission to upload images. Please check your Firebase Storage rules."
      } else if (error.code === 'storage/retry-limit-exceeded') {
        description = "Network error: Could not upload image. Please check your connection and Firebase Storage rules."
      }

      toast({
        title: "Error sending message",
        description: `${description} (Code: ${error.code})`,
        variant: "destructive",
      });

      // Restore input if sending failed
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

  const getMessageContent = (message: Message) => {
    if (showScrambled) {
      return message.scrambledText;
    }
    return unscrambleMessage(message.scrambledText);
  };

  return (
    <>
      <div className="flex h-screen w-full flex-col bg-background">
        <header className="flex h-16 items-center justify-center border-b bg-card px-4 shrink-0">
          <h1 className="text-xl font-semibold">AgentChat</h1>
        </header>
        <main className="flex-1 overflow-hidden">
          <ScrollArea className="h-full" ref={scrollAreaRef}>
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
                      {message.imageUrl && (
                        <Image 
                          src={message.imageUrl} 
                          alt="Chat image" 
                          width={300} 
                          height={200}
                          className="rounded-xl mb-2 object-cover" 
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
                        <p className="whitespace-pre-wrap">{getMessageContent(message)}</p>
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
          </ScrollArea>
        </main>
        <footer className="border-t bg-card p-2 space-y-2">
          {imagePreview && (
            <div className="relative w-24 h-24 ml-2">
              <Image src={imagePreview} alt="Image preview" fill className="rounded-md object-cover" />
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
          <div className="flex items-end gap-2 p-2">
            <div className="flex items-center gap-1">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                className="hidden"
                accept="image/*"
              />
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={handleAttachClick}>
                  <Paperclip className="h-5 w-5" />
                  <span className="sr-only">Attach Image</span>
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
            </div>
            <Textarea
              ref={textareaRef}
              placeholder="Type your message..."
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              disabled={isSending}
              className="flex-1 rounded-2xl bg-muted resize-none max-h-40 overflow-y-auto"
              rows={1}
            />
            <Button
              type="submit"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full bg-primary text-primary-foreground"
              onClick={handleSend}
              disabled={isSending || (!input.trim() && !imageFile)}
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
          </AlertDialogHeader>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your message.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingMessageId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMessage} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

    