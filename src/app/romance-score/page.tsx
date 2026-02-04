"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { useFirebase } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowLeft, Heart, Sparkles, TrendingUp, Info, User } from "lucide-react";
import { analyzeRomance, type AnalyzeRomanceOutput } from "@/ai/flows/analyze-romance";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

const ALL_USERS = [
    { username: 'Crazy', uid: 'QYTCCLfLg1gxdLLQy34y0T2Pz3g2' },
    { username: 'Cool', uid: 'N2911Sj2g8cT03s5v31s1p9V8s22' }
];

const decodeMessage = (text: string, shift: number = 1): string => {
  return text
    .split('')
    .map(char => {
      const charCode = char.charCodeAt(0);
       if (charCode >= 32 + shift && charCode <= 126 + shift) {
        return String.fromCharCode(charCode - shift);
      }
      return char;
    })
    .join('');
};

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
      const messagesData = querySnapshot.docs
        .map(doc => {
            const data = doc.data();
            return {
                text: data.isEncoded ? decodeMessage(data.scrambledText) : data.scrambledText,
                sender: data.sender
            };
        })
        .filter(m => !!m.text);

      if (messagesData.length < 5) {
        throw new Error("Not enough messages to analyze. Keep chatting!");
      }

      const analysis = await analyzeRomance({ messages: messagesData });
      setResult(analysis);
    } catch (error: any) {
      console.error("Analysis failed:", error);
      alert(error.message || "Something went wrong during analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getChartData = (score: number) => [
    { name: "Score", value: score },
    { name: "Remaining", value: 100 - score },
  ];

  const COLORS = ["#ff2e63", "#252a34"];

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6">
        <Button variant="outline" size="icon" className="shrink-0" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back</span>
        </Button>
        <h1 className="flex-1 text-xl font-semibold">Relationship Insights</h1>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="mx-auto max-w-4xl space-y-8">
          <section className="text-center space-y-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Heart className="h-8 w-8 fill-current" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">The Love Lab</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Comparing your romantic contributions and checking the overall spark levels.
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
                  Decoding Vibes...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Analyze Connection
                </>
              )}
            </Button>
          </section>

          {result && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Overall Relationship Card */}
              <Card className="overflow-hidden border-primary/20 bg-primary/5">
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-5xl font-black text-primary">
                    {result.overallScore}%
                  </CardTitle>
                  <CardDescription className="text-lg font-medium text-foreground">
                    Combined Vibe: <span className="text-primary italic">"{result.vibe}"</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center">
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={getChartData(result.overallScore)}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={5}
                          dataKey="value"
                          startAngle={180}
                          endAngle={0}
                        >
                          {getChartData(result.overallScore).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="text-center max-w-lg">
                    <p className="text-sm leading-relaxed italic opacity-90">
                      "{result.summary}"
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Individual User Scores */}
              <div className="grid gap-6 md:grid-cols-2">
                {result.userScores.map((userScore, idx) => (
                  <Card key={userScore.username} className="relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <User className="h-12 w-12" />
                    </div>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {userScore.username}
                        {userScore.username === currentUser && (
                            <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase">You</span>
                        )}
                      </CardTitle>
                      <CardDescription>Romantic Sentiment</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-bold text-primary">{userScore.score}%</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden mb-2">
                            <div 
                                className="h-full bg-primary transition-all duration-1000" 
                                style={{ width: `${userScore.score}%` }}
                            />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {userScore.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Highlights & Info */}
              <div className="grid gap-6 md:grid-cols-2">
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
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
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
                      About this Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      This analysis looks at the last 100 messages to identify patterns in how each person communicates affection and intimacy. It's meant for fun reflection and is calculated based on current conversation trends.
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
