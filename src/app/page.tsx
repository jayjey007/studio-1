
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Button } from "@/components/ui/button";

const USERS: Record<string, { username: string, uid: string }> = {
  "passcode1": { username: "Crazy", uid: "QYTCCLfLg1gxdLLQy34y0T2Pz3g2" },
  "passcode2": { username: "Cool", uid: "N2911Sj2g8cT03s5v31s1p9V8s22" }
};
const MAX_PASSCODE_LENGTH = 10;

const NavItem = ({ children }: { children: React.ReactNode }) => (
  <button className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
    {children}
  </button>
);

export default function NewsLoginPage() {
  const [input, setInput] = useState("");
  const router = useRouter();
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const heroImage = PlaceHolderImages.find(p => p.id === 'news-hero');
  const articleImages = PlaceHolderImages.filter(p => p.id.startsWith('news-article'));

  useEffect(() => {
    sessionStorage.removeItem("isAuthenticated");
    sessionStorage.removeItem("currentUser");
  }, []);

  const handleLogin = useCallback((user: {username: string, uid: string}) => {
    sessionStorage.setItem("isAuthenticated", "true");
    sessionStorage.setItem("currentUser", user.username);
    router.push("/chat");
  }, [router]);

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    let currentInput = event.target.value;
    
    if (currentInput.length > MAX_PASSCODE_LENGTH) {
        currentInput = currentInput.slice(currentInput.length - MAX_PASSCODE_LENGTH);
    }
    
    setInput(currentInput);

    const user = USERS[currentInput];
    if (user) {
      handleLogin(user);
      setInput("");
    }
  }, [handleLogin]);

  useEffect(() => {
    const refocusInput = () => hiddenInputRef.current?.focus();
    document.addEventListener('click', refocusInput);
    refocusInput();
    
    return () => {
      document.removeEventListener('click', refocusInput);
    };
  }, []);

  const handleFormSubmit = useCallback((event: React.FormEvent) => {
      event.preventDefault();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <div className="text-2xl font-bold tracking-tight">
            The Digital Times
          </div>
          <nav className="hidden items-center space-x-6 md:flex">
            <NavItem>World</NavItem>
            <NavItem>Tech</NavItem>
            <NavItem>Culture</NavItem>
            <NavItem>Politics</NavItem>
            <NavItem>Science</NavItem>
            <NavItem>Style</NavItem>
          </nav>
          <Button variant="outline" size="sm">Subscribe</Button>
        </div>
      </header>
      
      <main 
        className="flex-1 container mx-auto px-4 md:px-6 py-8"
        onClick={() => hiddenInputRef.current?.focus()}
      >
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="group cursor-pointer">
              {heroImage && (
                <div className="overflow-hidden rounded-lg">
                  <Image
                    src={heroImage.imageUrl}
                    alt={heroImage.description}
                    width={800}
                    height={450}
                    priority
                    className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    data-ai-hint={heroImage.imageHint}
                  />
                </div>
              )}
              <div className="mt-4">
                <span className="text-sm font-medium uppercase text-primary">Breaking News</span>
                <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight lg:text-4xl">
                  Digital Realms & Private Sanctuaries: A New Frontier
                </h1>
                <p className="mt-4 text-muted-foreground">
                  In an era of pervasive connectivity, the concept of a private space has become increasingly abstract. What was once a physical boundary is now a complex negotiation of digital permissions and algorithmic trust.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">By The Scribe</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-8">
            {articleImages.map((article, index) => (
              <div key={article.id} className="group grid grid-cols-3 gap-4 cursor-pointer">
                <div className="col-span-1 overflow-hidden rounded-md">
                   <Image
                    src={article.imageUrl}
                    alt={article.description}
                    width={150}
                    height={100}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    data-ai-hint={article.imageHint}
                  />
                </div>
                <div className="col-span-2">
                   <h2 className="text-base font-semibold leading-snug">
                    {index === 0 ? "The Illusion of Anonymity" : "On Digital Echoes"}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {index === 0 ? "By The Cypher" : "By The Archivist"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t">
        <div className="container mx-auto flex items-center justify-between px-4 md:px-6 py-4 text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} The Digital Times. All Rights Reserved.</p>
          <div className="flex space-x-4">
            <a href="#" className="hover:text-foreground">About</a>
            <a href="#" className="hover:text-foreground">Contact</a>
            <a href="#" className="hover:text-foreground">Privacy Policy</a>
          </div>
        </div>
      </footer>

      {/* Hidden form and input for passcode capture */}
      <form onSubmit={handleFormSubmit} className="absolute">
           <input
              ref={hiddenInputRef}
              type="text"
              value={input}
              onChange={handleInputChange}
              autoComplete="off"
              autoCapitalize="none"
              aria-hidden="true"
              style={{
                  position: 'absolute',
                  top: '-9999px',
                  left: '-9999px',
                  opacity: 0,
                  width: '1px',
                  height: '1px',
                  caretColor: 'transparent',
              }}
          />
      </form>
    </div>
  );
}
