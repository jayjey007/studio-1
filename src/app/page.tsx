
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Feather } from "lucide-react";
import { signInAnonymously } from "firebase/auth";
import { auth } from "@/lib/firebase";

const PASSCODES: Record<string, string> = {
  "passcode1": "Crazy_S",
  "passcode2": "Cool_J"
};
const MAX_PASSCODE_LENGTH = 10; // A reasonable max length for passcodes

const contentSets = [
  {
    title: "The Nature of Privacy",
    paragraphs: [
      "In an era of pervasive connectivity, the concept of a private space has become increasingly abstract. What was once a physical boundary is now a complex negotiation of digital permissions and algorithmic trust.",
      "True privacy is not about having something to hide; it is about having the autonomy to choose what to share and with whom. It's the silent, unwritten agreement that our thoughts, our conversations, and our identities are our own to control. Yet, we leave digital footprints with every interaction, every search, every message sent into the void. These fragments, seemingly insignificant on their own, are collected, aggregated, and analyzed, painting a portrait of us that is often more detailed than we realize.",
      "The challenge, then, is not to disappear completely, but to navigate this landscape with intention. To build our own sanctuaries, not with walls of brick, but with layers of encryption and mindful discretion. A space where communication is secure not because it is locked away, but because it is protected by a shared understanding of its value. This is the new frontier of personal liberty."
    ],
    author: "the Scribe"
  },
  {
    title: "On Digital Echoes",
    paragraphs: [
      "Every character we type, every image we share, becomes a digital echo—a faint but permanent vibration in the vast network of servers that constitutes modern memory. These echoes outlive our intentions, carrying fragments of our past into unforeseen futures.",
      "We often speak of the digital world as being separate from the 'real' one, a place of avatars and aliases. Yet, the emotions carried through these networks are real. The connections formed, however fleeting, are real. The data we generate is a direct reflection of our thoughts, desires, and fears. This digital doppelgänger is not a shadow; it is a mirror, reflecting a version of ourselves we may not always recognize but cannot disown.",
      "To exist online is to be in a constant state of performance. We curate our lives, presenting a polished version for public consumption. But what of the unedited drafts? The hesitations, the deleted words, the closed tabs? These moments of unfiltered thought, though unseen, are the true architecture of our digital consciousness. They are the silent spaces between the echoes where our authentic selves reside."
    ],
    author: "the Archivist"
  },
  {
    title: "The Illusion of Anonymity",
    paragraphs: [
      "Anonymity in the digital age is a comforting illusion, a thin veil draped over a network designed for identification. We adopt usernames and avatars, believing they shield us, but our patterns of behavior are as unique as a fingerprint.",
      "The data points we shed—keystroke timing, linguistic choices, browsing habits—form a constellation that points directly back to us. True anonymity would require not just a mask, but a complete erasure of habit and personality, an impossible feat for any thinking being. The machine, in its relentless pursuit of patterns, always finds the ghost.",
      "Perhaps the goal should not be to become invisible, but to be seen on our own terms. To understand that every action is a signature, and to write that signature with purpose. In a world where every whisper is recorded, the only power we have left is to choose our words carefully, knowing they will be etched into the permanent record of the digital age. Authenticity, not anonymity, may be our last form of defiance."
    ],
    author: "the Cypher"
  }
];

const themes = [
  {
    '--background': 'hsl(0 0% 100%)',
    '--foreground': 'hsl(240 10% 3.9%)',
    '--muted-foreground': 'hsl(240 3.8% 46.1%)',
    '--border': 'hsl(240 5.9% 90%)',
  },
  {
    '--background': 'hsl(60 30% 96.1%)',
    '--foreground': 'hsl(60 9.1% 25.1%)',
    '--muted-foreground': 'hsl(60 5.1% 50.1%)',
    '--border': 'hsl(60 9.1% 88.1%)',
  },
  {
    '--background': 'hsl(204 20% 95%)',
    '--foreground': 'hsl(210 10% 23%)',
    '--muted-foreground': 'hsl(210 8% 45%)',
    '--border': 'hsl(204 10% 88%)',
  },
  { // Dark theme
    '--background': 'hsl(240 10% 3.9%)',
    '--foreground': 'hsl(0 0% 98%)',
    '--muted-foreground': 'hsl(240 3.7% 63.9%)',
    '--border': 'hsl(240 3.7% 15.9%)',
  },
];


export default function DisguisedLoginPage() {
  const [input, setInput] = useState("");
  const router = useRouter();
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState(contentSets[0]);
  const [theme, setTheme] = useState(themes[0]);

  useEffect(() => {
    // Randomly select content and theme on the client side to avoid hydration mismatch
    setContent(contentSets[Math.floor(Math.random() * contentSets.length)]);
    setTheme(themes[Math.floor(Math.random() * themes.length)]);
  }, []);

  const handleLogin = useCallback(async (userIdentifier: string) => {
    try {
      await signInAnonymously(auth);
      sessionStorage.setItem("isAuthenticated", "true");
      sessionStorage.setItem("currentUser", userIdentifier);
      router.push("/chat");
    } catch (error) {
      console.error("Anonymous sign-in failed:", error);
      // Fallback redirect to maintain disguise
      router.push("https://news.google.com");
    }
  }, [router]);
  
  const handleInputChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    let currentInput = event.target.value;
    
    if (currentInput.length > MAX_PASSCODE_LENGTH) {
        currentInput = currentInput.slice(currentInput.length - MAX_PASSCODE_LENGTH);
    }
    
    setInput(currentInput);

    const user = PASSCODES[currentInput];
    if (user) {
      await handleLogin(user);
      setInput(""); // Reset input after successful login
    }
  }, [handleLogin]);

  useEffect(() => {
    // Focus the hidden input to bring up the keyboard on mobile
    hiddenInputRef.current?.focus();
    
    // Optional: Refocus on click anywhere to ensure keyboard stays up
    const refocusInput = () => hiddenInputRef.current?.focus();
    document.addEventListener('click', refocusInput);
    
    return () => {
      document.removeEventListener('click', refocusInput);
    };
  }, []);
  
  const handleFormSubmit = useCallback(async (event: React.FormEvent) => {
      event.preventDefault();
      const user = PASSCODES[input];
      if (user) {
        await handleLogin(user);
      } else {
        router.push("https://news.google.com");
      }
      setInput("");
  }, [input, router, handleLogin]);

  return (
    <div 
      className="flex h-screen w-full items-center justify-center p-4 md:p-8 transition-colors duration-500"
      style={theme as React.CSSProperties}
    >
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
            <Feather className="h-5 w-5" />
            <p className="text-sm">Musings on Digital Ephemera</p>
        </div>
        <h1 className="text-4xl font-bold mb-4">{content.title}</h1>
        <p className="text-lg mb-8">
          {content.paragraphs[0]}
        </p>
        <div className="space-y-6">
            <p>
                {content.paragraphs[1]}
            </p>
            <p>
                {content.paragraphs[2]}
            </p>
        </div>
        <div className="mt-12 pt-4 text-center text-sm border-t">
            <p>A thought by {content.author}.</p>
        </div>
        
        {/* Hidden form and input for mobile keyboard support */}
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
    </div>
  );
}
