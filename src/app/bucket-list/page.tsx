
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { collection, serverTimestamp, query, orderBy, onSnapshot, doc } from "firebase/firestore";
import { useFirebase, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowLeft, Plus, MoreVertical, Trash2, ArrowUp, ArrowDown, Minus, LogOut } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";

type Priority = 'low' | 'medium' | 'high';

interface BucketListItem {
  id: string;
  text: string;
  authorUsername: string;
  createdAt: any;
  isDone: boolean;
  priority: Priority;
}

const priorityIcons: Record<Priority, React.ReactNode> = {
  high: <ArrowUp className="h-4 w-4 text-red-500" />,
  medium: <Minus className="h-4 w-4 text-yellow-500" />,
  low: <ArrowDown className="h-4 w-4 text-green-500" />,
};

const priorityOrder: Record<Priority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export default function BucketListPage() {
  const router = useRouter();
  const { firestore: db } = useFirebase();
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [items, setItems] = useState<BucketListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newItemText, setNewItemText] = useState("");
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

  const bucketListCollectionRef = useMemoFirebase(() => db ? collection(db, 'bucketList') : null, [db]);

  useEffect(() => {
    if (!bucketListCollectionRef) return;

    setIsLoading(true);
    const q = query(
      bucketListCollectionRef,
      orderBy("isDone", "asc"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const bucketListItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BucketListItem));
      
      // Custom sort on the client
      const sortedItems = bucketListItems.sort((a, b) => {
        if (a.isDone !== b.isDone) {
          return a.isDone ? 1 : -1;
        }
        const priorityA = priorityOrder[a.priority] || 2;
        const priorityB = priorityOrder[b.priority] || 2;
        if (priorityA !== priorityB) {
          return priorityB - priorityA;
        }
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });

      setItems(sortedItems);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching bucket list items:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [bucketListCollectionRef]);

  const handleAddItem = async () => {
    if (!newItemText.trim() || !currentUser || !db) return;

    setIsAdding(true);
    try {
      await addDocumentNonBlocking(collection(db, "bucketList"), {
        text: newItemText.trim(),
        authorUsername: currentUser,
        createdAt: serverTimestamp(),
        isDone: false,
        priority: 'medium',
      });
      setNewItemText("");
    } catch (error) {
      console.error("Error adding bucket list item:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isAdding) {
      e.preventDefault();
      handleAddItem();
    }
  };

  const handleToggleDone = (item: BucketListItem) => {
    if (!db) return;
    const itemRef = doc(db, 'bucketList', item.id);
    updateDocumentNonBlocking(itemRef, { isDone: !item.isDone });
  };

  const handleDeleteItem = (itemId: string) => {
    if (!db) return;
    const itemRef = doc(db, 'bucketList', itemId);
    deleteDocumentNonBlocking(itemRef);
  };
  
  const handleSetPriority = (item: BucketListItem, priority: Priority) => {
    if (!db) return;
    const itemRef = doc(db, 'bucketList', item.id);
    updateDocumentNonBlocking(itemRef, { priority });
  };


  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6">
        <Button variant="outline" size="icon" className="shrink-0" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back</span>
        </Button>
        <h1 className="flex-1 text-xl font-semibold">Shared Bucket List</h1>
      </header>
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 md:p-6">
            {isLoading ? (
              <div className="flex justify-center items-center p-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center text-muted-foreground py-10">
                <p className="mt-4">The bucket list is empty. Add the first item!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <Card key={item.id} className={cn("transition-colors", item.isDone && "bg-muted/50")}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <Checkbox
                        checked={item.isDone}
                        onCheckedChange={() => handleToggleDone(item)}
                        aria-label="Mark as done"
                      />
                      <div className="flex-1">
                        <p className={cn("font-medium", item.isDone && "line-through text-muted-foreground")}>{item.text}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Added by {item.authorUsername} on {item.createdAt && format(item.createdAt.toDate(), "MMM d, yyyy")}
                        </p>
                      </div>
                      {priorityIcons[item.priority]}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">More options</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => handleSetPriority(item, 'high')}>
                            <ArrowUp className="mr-2 h-4 w-4" /> Priority High
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleSetPriority(item, 'medium')}>
                            <Minus className="mr-2 h-4 w-4" /> Priority Medium
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleSetPriority(item, 'low')}>
                            <ArrowDown className="mr-2 h-4 w-4" /> Priority Low
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleDeleteItem(item.id)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </main>
      <footer className="shrink-0 border-t bg-card p-2 md:p-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Add a new bucket list item..."
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isAdding}
          />
          <Button
            size="icon"
            onClick={handleAddItem}
            disabled={isAdding || !newItemText.trim()}
          >
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="sr-only">Add Item</span>
          </Button>
           <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout">
              <LogOut className="h-5 w-5" />
            </Button>
        </div>
      </footer>
    </div>
  );
}
