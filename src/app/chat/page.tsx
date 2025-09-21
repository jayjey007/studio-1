
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, User, Smile, Paperclip, X } from "lucide-react";

import { cn } from "@/lib/utils";

const EMOJIS = ['😀', '😂', '😍', '🤔', '👍', '❤️', '🎉', '🔥', '🚀', '💯', '🙏', '🤷‍♂️', '🤧', '🥰'];

interface Message {
  id: string;
  scrambledText: string;
  sender: string;
  createdAt: any;
  imageUrl?: string;
}

const scrambleMessageLocal = (message: string): string => {
  if (!message) return "";
  const emojiRegex = /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g;
  const messageWithoutEmojis = message.replace(emojiRegex, '');

  return messageWithoutEmojis
    .split('')
    .map(char => {
      const charCode = char.charCodeAt(0);
      if (char >= 'a' && char <= 'z') {
        return String.fromCharCode(((charCode - 97 + 1) % 26) + 97);
      } else if (char >= 'A' && char <= 'Z') {
        return String.fromCharCode(((charCode - 65 + 1) % 26) + 65);
      }
      return char;
    })
    .join('');
};

const unscrambleMessageLocal = (scrambledMessage: string): string => {
  if (!scrambledMessage) return "";
  return scrambledMessage
    .split('')
    .map(char => {
      const charCode = char.charCodeAt(0);
      if (char >= 'a' && char <= 'z') {
        return String.fromCharCode(((charCode - 97 - 1 + 26) % 26) + 97);
      } else if (char >= 'A' && char <= 'Z') {
        return String.fromCharCode(((charCode - 65 - 1 + 26) % 26) + 65);
      }
      return char;
    })
    .join('');
};

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [unscrambledMessages, setUnscrambledMessages] = useState<Record<string, string>>({});
  const [input, setInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isUnscrambling, setIsUnscrambling] = useState(false);
  const [showScrambled, setShowScrambled] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPickingFile = useRef(false);

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
  }, [messages, unscrambledMessages]);

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

  const handleToggleScrambled = async () => {
    const newShowScrambled = !showScrambled;
    setShowScrambled(newShowScrambled);

    if (!newShowScrambled) {
      setIsUnscrambling(true);
      try {
        const newUnscrambledMessages: Record<string, string> = {};
        for (const message of messages) {
          if (!unscrambledMessages[message.id] && message.scrambledText) {
            const unscrambledText = unscrambleMessageLocal(message.scrambledText);
            newUnscrambledMessages[message.id] = unscrambledText;
          }
        }
        setUnscrambledMessages(prev => ({ ...prev, ...newUnscrambledMessages }));
      } catch (error) {
        console.error("Error unscrambling messages:", error);
        toast({
          title: "Error",
          description: "Could not unscramble messages.",
          variant: "destructive",
        });
      } finally {
        setIsUnscrambling(false);
      }
    }
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
    let scrambledMessage = "";

    try {
      console.log("1. Starting handleSend");
      if (imageFileToSend) {
        console.log("2. Image file exists, preparing to upload.");
        const storageRef = ref(storage, `chat_images/${Date.now()}_${imageFileToSend.name}`);
        console.log("3. Created storage reference:", storageRef.fullPath);
        await uploadBytes(storageRef, imageFileToSend);
        console.log("4. Upload complete.");
        imageUrl = await getDownloadURL(storageRef);
        console.log("5. Got download URL:", imageUrl);
      }

      if (messageToSend) {
        scrambledMessage = scrambleMessageLocal(messageToSend);
         console.log("6. Scrambled message:", scrambledMessage);
      }

      const messageToStore: Omit<Message, 'id'> = {
        scrambledText: scrambledMessage,
        sender: currentUser,
        createdAt: serverTimestamp(),
        ...(imageUrl && { imageUrl }),
      };
      
      console.log("7. Preparing to add document to Firestore:", messageToStore);
      await addDoc(collection(db, "messages"), messageToStore);
      console.log("8. Document added to Firestore successfully.");
      
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
      console.log("9. handleSend finished.");
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

  const getMessageContent = (message: Message) => {
    if (showScrambled) {
      return message.scrambledText;
    }
    return unscrambledMessages[message.id] || "Unscrambling...";
  };

  return (
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
                    "flex items-start gap-3 w-full",
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
                    <p className="whitespace-pre-wrap">{getMessageContent(message)}</p>
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
               {(isUnscrambling) && (
                <div className="flex justify-center items-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
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
  );
}

    