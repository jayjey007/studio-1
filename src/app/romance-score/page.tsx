
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { useFirebase } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowLeft, Heart, Sparkles, TrendingUp, Info } from "lucide-react";
import { analyzeRomance, type AnalyzeRomanceOutput } from "@/ai/flows/analyze-romance";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export default function RomanceScorePage() {
  const router = useRouter();
  const { firestore: db } = useFirebase();
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalyzeRomanceOutput | null>(null);

  useEffect(() => {
    const user = sessionStorage.getItem("currentUser");
    if (!user) {
      router.replace("/");
    } else {
      setCurrentUser(user);
    }
  }, [router]);

  const handleAnalyze = async () => {
    if (!db) return;
    setIsAnalyzing(true);
    setResult(null);

    try {
      const q = query(collection(db, "messages"), orderBy("createdAt", "desc"), limit(100));
      const querySnapshot = await getDocs(q);
      const scrambledMessages = querySnapshot.docs
        .map(doc => doc.data().scrambledText)
        .filter(text => !!text);

      if (scrambledMessages.length < 5) {
        throw new Error("Not enough messages to analyze. Keep chatting!");
      }

      const analysis = await analyzeRomance({ scrambledMessages });
      setResult(analysis);
    } catch (error: any) {
      console.error("Analysis failed:", error);
      alert(error.message || "Something went wrong during analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const scoreData = result ? [
    { name: "Score", value: result.score },
    { name: "Remaining", value: 100 - result.score },
  ] : [];

  const COLORS = ["#ff2e63", "#252a34"];

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6">
        <Button variant="outline" size="icon" className="shrink-0" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back</span>
        </Button>
        <h1 className="flex-1 text-xl font-semibold">AI Romance Analysis</h1>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="mx-auto max-w-2xl space-y-8">
          <section className="text-center space-y-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Heart className="h-8 w-8 fill-current" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">How's the spark?</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Our AI analyzes your recent conversations to gauge the romantic connection and provide insights into your relationship vibe.
            </p>
            <Button 
              size="lg" 
              onClick={handleAnalyze} 
              disabled={isAnalyzing}
              className="px-8"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Analyzing Vibes...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Calculate Romance Score
                </>
              )}
            </Button>
          </section>

          {result && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="overflow-hidden border-primary/20 bg-primary/5">
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-4xl font-black text-primary">
                    {result.score}%
                  </CardTitle>
                  <CardDescription className="text-lg font-medium text-foreground">
                    Vibe: <span className="text-primary italic">"{result.vibe}"</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center">
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={scoreData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          startAngle={180}
                          endAngle={0}
                        >
                          {scoreData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-sm leading-relaxed max-w-md mx-auto italic opacity-90">
                      "{result.summary}"
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      Relationship Highlights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      {result.highlights.map((highlight, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <Info className="h-4 w-4 text-blue-500" />
                      What this means
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      This analysis is based on your most recent 100 messages. Scores vary as conversations evolve. Use this as a fun way to reflect on your shared journey!
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
