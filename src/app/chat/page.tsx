
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, User, Smile, Paperclip, X } from "lucide-react";

import { scrambleMessage } from "@/ai/flows/scramble-message-llm";
import { cn } from "@/lib/utils";

const SCRAMBLE_METHOD = "Letter substitution (A=B, B=C, etc.)";

const EMOJIS = ['😀', '😂', '😍', '🤔', '👍', '❤️', '🎉', '🔥', '🚀', '💯', '🙏', '🤷‍♂️', '🤧', '🥰'];

interface Message {
  id: string;
  originalText?: string; // Original text is now optional and only for client-side display
  scrambledText: string;
  sender: string;
  createdAt: any;
  imageUrl?: string;
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [showScrambled, setShowScrambled] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        messagesData.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(messagesData);
    });
    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  useEffect(() => {
    const handleLogout = () => {
      sessionStorage.removeItem("isAuthenticated");
      sessionStorage.removeItem("currentUser");
      router.push("/");
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleLogout();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleLogout);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleLogout);
    };
  }, [router]);

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

    if (trimmedInput.toLowerCase() === 'toggle' && !imageFile) {
      setShowScrambled(prev => !prev);
      setInput('');
      inputRef.current?.focus();
      return;
    }

    setIsSending(true);
    setInput("");
    
    let imageUrl: string | undefined = undefined;

    try {
      if (imageFile) {
        const storageRef = ref(storage, `chat_images/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      }

      const scrambleResult = await scrambleMessage({
        message: trimmedInput,
        method: SCRAMBLE_METHOD,
      });

      // Temporarily add message to UI with original text for immediate feedback
      const tempId = Date.now().toString();
      const tempMessage: Message = {
        id: tempId,
        originalText: trimmedInput,
        scrambledText: scrambleResult.scrambledMessage,
        sender: currentUser,
        createdAt: new Date(),
        ...(imageUrl && { imageUrl }),
      };
      setMessages(prev => [...prev, tempMessage]);


      // Only store the scrambled message in Firestore
      const messageToStore: Omit<Message, 'id' | 'originalText'> = {
        scrambledText: scrambleResult.scrambledMessage,
        sender: currentUser,
        createdAt: serverTimestamp(),
        ...(imageUrl && { imageUrl }),
      };

      await addDoc(collection(db, "messages"), messageToStore);
      
      // Remove the temporary message once the DB call is complete
      // The onSnapshot listener will add the persisted message from Firestore
      setMessages(prev => prev.filter(m => m.id !== tempId));

      removeImage();

    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Could not send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isSending) {
      handleSend();
    }
  };

  return (
    <div className="flex h-screen w-full flex-col">
      <header className="flex h-16 items-center justify-center border-b bg-card px-4">
        <h1 className="text-xl font-bold">AgentChat</h1>
      </header>
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          <div className="p-4 md:p-6">
            <div className="flex flex-col gap-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex items-start gap-3",
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
                      "max-w-[75%] rounded-lg p-3 text-sm",
                      message.sender === currentUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {message.imageUrl && (
                      <Image 
                        src={message.imageUrl} 
                        alt="Chat image" 
                        width={300} 
                        height={200}
                        className="rounded-md mb-2 object-cover" 
                      />
                    )}
                    <p>{showScrambled || !message.originalText ? message.scrambledText : message.originalText}</p>
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
      <footer className="border-t bg-card p-4 space-y-2">
        {imagePreview && (
          <div className="relative w-24 h-24">
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
        <div className="relative flex items-center gap-2">
          <Input
            ref={inputRef}
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isSending}
            className="pr-24"
          />
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageChange}
            className="hidden"
            accept="image/*"
          />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-4 w-4" />
              <span className="sr-only">Attach Image</span>
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <Smile className="h-4 w-4" />
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
          <Button
            type="submit"
            size="icon"
            className="h-8 w-8 shrink-0"
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
