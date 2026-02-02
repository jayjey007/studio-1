
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { collection, serverTimestamp, query, orderBy, onSnapshot, doc } from "firebase/firestore";
import { useFirebase, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ArrowLeft, LogOut, Send, MoreVertical, Trash2, Edit, X, Save } from "lucide-react";
import { format } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface LetterEntry {
  id: string;
  text: string;
  authorUsername: string;
  createdAt: any;
}

export default function LetterPage() {
  const router = useRouter();
  const { firestore: db } = useFirebase();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [entries, setEntries] = useState<LetterEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newEntryText, setNewEntryText] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);


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
  
  const handleStartEdit = (entry: LetterEntry) => {
    setEditingEntryId(entry.id);
    setEditingText(entry.text);
  };

  const handleCancelEdit = () => {
    setEditingEntryId(null);
    setEditingText("");
  };

  const handleUpdateEntry = async () => {
    if (!editingEntryId || !editingText.trim() || !db) return;

    setIsUpdating(true);
    const entryRef = doc(db, "letter", editingEntryId);
    try {
      await updateDocumentNonBlocking(entryRef, { text: editingText.trim() });
      toast({ title: "Success", description: "Entry updated." });
      handleCancelEdit();
    } catch (error) {
      console.error("Error updating entry:", error);
      toast({ title: "Error", description: "Could not update entry.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleDeleteEntry = async () => {
    if (!deletingEntryId || !db) return;

    const entryRef = doc(db, "letter", deletingEntryId);
    try {
        await deleteDocumentNonBlocking(entryRef);
        toast({ title: "Success", description: "Entry deleted." });
    } catch (error) {
        console.error("Error deleting entry:", error);
        toast({ title: "Error", description: "Could not delete entry.", variant: "destructive" });
    } finally {
        setDeletingEntryId(null);
    }
  };

  return (
    <>
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
                <div className="prose prose-invert max-w-none prose-p:my-2 prose-p:leading-relaxed">
                  {entries.map((entry) => (
                      <div key={entry.id} className="group relative mb-6 rounded-md p-2 -m-2 transition-colors hover:bg-muted/50">
                          {editingEntryId === entry.id ? (
                            <div className="space-y-2">
                              <Textarea 
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                className="w-full max-h-60"
                                autoFocus
                                disabled={isUpdating}
                              />
                              <div className="flex items-center gap-2">
                                <Button size="sm" onClick={handleUpdateEntry} disabled={isUpdating}>
                                  {isUpdating ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4" />}
                                  Save
                                </Button>
                                <Button size="sm" variant="ghost" onClick={handleCancelEdit} disabled={isUpdating}>
                                  <X className="h-4 w-4" /> Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="whitespace-pre-wrap">{entry.text}</p>
                              <p className="text-xs text-muted-foreground mt-2 not-prose italic">
                                  — {entry.authorUsername} on {entry.createdAt && format(entry.createdAt.toDate(), "MMM d, yyyy")}
                              </p>
                              {currentUser === entry.authorUsername && (
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onSelect={() => handleStartEdit(entry)}>
                                        <Edit className="mr-2 h-4 w-4"/> Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onSelect={() => setDeletingEntryId(entry.id)} className="text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4"/> Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              )}
                            </>
                          )}
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

      <AlertDialog
        open={!!deletingEntryId}
        onOpenChange={(open) => !open && setDeletingEntryId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your entry from the letter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEntry}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
