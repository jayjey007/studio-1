
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Feather } from "lucide-react";
import { signInAnonymously } from "firebase/auth";
import { auth } from "@/lib/firebase";

const PASSCODES: Record<string, string> = {
  "passcode1": "user1",
  "passcode2": "user2"
};
const MAX_PASSCODE_LENGTH = 10; // A reasonable max length for passcodes

export default function DisguisedLoginPage() {
  const [input, setInput] = useState("");
  const router = useRouter();

  const handleLogin = useCallback(async (passcode: string) => {
    const user = PASSCODES[passcode];
    if (user) {
      try {
        await signInAnonymously(auth);
        sessionStorage.setItem("isAuthenticated", "true");
        sessionStorage.setItem("currentUser", user);
        router.push("/chat");
      } catch (error) {
        console.error("Anonymous sign-in failed:", error);
        router.push("https://news.google.com");
      }
    } else {
      router.push("https://news.google.com");
    }
  }, [router]);
  
  const handleKeyPress = useCallback(async (event: KeyboardEvent) => {
    let currentInput = input;

    if (event.key === 'Enter') {
      if(currentInput.length > 0) {
        await handleLogin(currentInput);
        setInput(""); 
      }
      return;
    }
    
    if (event.key === 'Backspace') {
      currentInput = currentInput.slice(0, -1);
    } else if (event.key.length === 1) { // Only capture single characters
      currentInput += event.key;
    }

    if (currentInput.length > MAX_PASSCODE_LENGTH) {
        currentInput = currentInput.slice(currentInput.length - MAX_PASSCODE_LENGTH);
    }

    setInput(currentInput);

    // Check for passcode match on every keypress
    if (PASSCODES[currentInput]) {
      await handleLogin(currentInput);
      setInput("");
    }

  }, [input, router, handleLogin]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [handleKeyPress]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background text-foreground/80 p-4 md:p-8">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-6 text-muted-foreground">
            <Feather className="h-5 w-5" />
            <p className="text-sm">Musings on Digital Ephemera</p>
        </div>
        <h1 className="text-4xl font-bold mb-4 text-foreground">The Nature of Privacy</h1>
        <p className="text-lg text-muted-foreground mb-8">
          In an era of pervasive connectivity, the concept of a private space has become increasingly abstract. What was once a physical boundary is now a complex negotiation of digital permissions and algorithmic trust.
        </p>
        <div className="space-y-6 text-foreground/90">
            <p>
                True privacy is not about having something to hide; it is about having the autonomy to choose what to share and with whom. It's the silent, unwritten agreement that our thoughts, our conversations, and our identities are our own to control. Yet, we leave digital footprints with every interaction, every search, every message sent into the void. These fragments, seemingly insignificant on their own, are collected, aggregated, and analyzed, painting a portrait of us that is often more detailed than we realize.
            </p>
            <p>
                The challenge, then, is not to disappear completely, but to navigate this landscape with intention. To build our own sanctuaries, not with walls of brick, but with layers of encryption and mindful discretion. A space where communication is secure not because it is locked away, but because it is protected by a shared understanding of its value. This is the new frontier of personal liberty.
            </p>
        </div>
        <div className="mt-12 border-t border-border pt-4 text-center text-sm text-muted-foreground">
            <p>A thought by the Scribe.</p>
        </div>
      </div>
    </div>
  );
}
