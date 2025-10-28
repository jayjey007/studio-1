
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { collection, serverTimestamp, query, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { useFirebase, useMemoFirebase, addDocumentNonBlocking } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowLeft, LogOut, Send } from "lucide-react";
import { format } from "date-fns";

interface LetterEntry {
  id: string;
  text: string;
  authorUsername: string;
  createdAt: Timestamp;
}

export default function LetterPage() {
  const router = useRouter();
  const { firestore: db } = useFirebase();
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [entries, setEntries] = useState<LetterEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newEntryText, setNewEntryText] = useState("");
  const [isAdding, setIsAdding] = useState(false);

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

  const letterCollectionRef = useMemoFirebase(() => db ? collection(db, 'letter') : null, [db]);

  useEffect(() => {
    if (!letterCollectionRef) return;

    setIsLoading(true);
    const q = query(letterCollectionRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const letterEntries = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LetterEntry));
      setEntries(letterEntries);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching letter entries:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [letterCollectionRef]);

  const handleAddEntry = async () => {
    if (!newEntryText.trim() || !currentUser || !db) return;

    setIsAdding(true);
    try {
      await addDocumentNonBlocking(collection(db, "letter"), {
        text: newEntryText.trim(),
        authorUsername: currentUser,
        createdAt: serverTimestamp(),
      });
      setNewEntryText("");
    } catch (error) {
      console.error("Error adding letter entry:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isAdding) {
      e.preventDefault();
      handleAddEntry();
    }
  };
  
  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6">
        <Button variant="outline" size="icon" className="shrink-0" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back</span>
        </Button>
        <h1 className="flex-1 text-xl font-semibold">Shared Letter</h1>
      </header>
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 md:p-6">
            {isLoading ? (
              <div className="flex justify-center items-center p-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center text-muted-foreground py-10">
                <p>The letter is empty. Write the first paragraph!</p>
              </div>
            ) : (
              <div className="prose prose-invert max-w-none">
                {entries.map((entry) => (
                    <div key={entry.id} className="mb-6">
                        <p className="whitespace-pre-wrap">{entry.text}</p>
                        <p className="text-xs text-muted-foreground mt-2 italic">
                            — {entry.authorUsername} on {entry.createdAt && format(entry.createdAt.toDate(), "MMM d, yyyy")}
                        </p>
                    </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </main>
      <footer className="shrink-0 border-t bg-card p-2 md:p-4">
        <div className="flex items-end gap-2">
           <Textarea
            placeholder="Add to the letter..."
            value={newEntryText}
            onChange={(e) => setNewEntryText(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isAdding}
            className="max-h-40"
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleAddEntry}
            disabled={isAdding || !newEntryText.trim()}
            className="h-10 w-10 shrink-0"
          >
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Add to Letter</span>
          </Button>
           <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout" className="h-10 w-10 shrink-0">
              <LogOut className="h-5 w-5" />
            </Button>
        </div>
      </footer>
    </div>
  );
}

    