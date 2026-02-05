
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowLeft, MessageSquare, ShieldCheck, Bug } from "lucide-react";

/**
 * @fileOverview Manual verification page for chat scroll behavior.
 * This tool allows testing login flow and visual scroll performance 
 * without needing to manually send hundreds of messages.
 */

export default function TestScrollPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string>("Ready to test");

  const runTest = async (user: "Crazy" | "Cool") => {
    setStatus(`Logging in as ${user}...`);
    sessionStorage.setItem("isAuthenticated", "true");
    sessionStorage.setItem("currentUser", user);
    
    setStatus("Redirecting to chat...");
    router.push("/chat");
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background p-4 md:p-8">
      <header className="mb-8">
        <Button variant="outline" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bug className="h-8 w-8 text-primary" />
          Scroll & Auth Test Suite
        </h1>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-500" />
              Login & Initial Scroll Test
            </CardTitle>
            <CardDescription>
              Test if the chat correctly scrolls to the latest message immediately after login.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a user to simulate a login. You should be redirected to the chat, and it should automatically snap to the bottom.
            </p>
            <div className="flex gap-4">
              <Button onClick={() => runTest("Crazy")} className="flex-1">Login as Crazy</Button>
              <Button onClick={() => runTest("Cool")} className="flex-1" variant="secondary">Login as Cool</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              Manual Verification Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>Open this page on an iPhone/Mobile Safari.</li>
              <li>Perform a login using the buttons on the left.</li>
              <li>Verify the scroll starts at the <strong>latest</strong> message.</li>
              <li>Scroll up slowly to trigger "Load More".</li>
              <li>Verify that loading older messages <strong>does not</strong> cause the screen to jump down.</li>
              <li>Verify that sending a message while scrolled up stays in position, but sending while at the bottom scrolls with the new message.</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 p-4 bg-muted rounded-lg text-center font-mono text-sm">
        Status: <span className="text-primary font-bold">{status}</span>
      </div>
    </div>
  );
}
