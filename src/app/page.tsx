
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { KeyRound } from "lucide-react";

const PASSCODES: Record<string, string> = {
  "passcode1": "user1",
  "passcode2": "user2"
};

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = () => {
    setIsLoading(true);
    // Simulate a network request
    setTimeout(() => {
      const user = PASSCODES[passcode];
      if (user) {
        // In a real app, you'd use a more secure session management method
        sessionStorage.setItem("isAuthenticated", "true");
        sessionStorage.setItem("currentUser", user);
        router.push("/chat");
      } else {
        router.push("https://news.google.com");
      }
      setIsLoading(false);
    }, 500);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) {
      handleLogin();
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary rounded-full p-3 w-fit mb-4">
            <KeyRound className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle>Enter Passcode</CardTitle>
          <CardDescription>
            Please enter your passcode to access the chat.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="••••••••"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="text-center text-lg tracking-widest"
            />
            <Button
              onClick={handleLogin}
              disabled={isLoading || !passcode}
              className="w-full"
            >
              {isLoading ? "Verifying..." : "Login"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
