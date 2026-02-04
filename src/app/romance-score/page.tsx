'use client';

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowLeft, Heart, Sparkles, TrendingUp, Info, User, Activity, LogOut } from "lucide-react";
import { calculateOverallRomanceScore, type AnalyzeRomanceOutput } from "@/ai/flows/analyze-romance";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const COLORS = ["#ff2e63", "#252a34"];

export default function RomanceScorePage() {
  const router = useRouter();
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

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem("isAuthenticated");
    sessionStorage.removeItem("currentUser");
    router.replace("/");
  }, [router]);

  useEffect(() => {
    const handleWindowBlur = () => {
      handleLogout();
    };

    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [handleLogout]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setResult(null);

    try {
      const analysis = await calculateOverallRomanceScore();
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

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6">
        <Button variant="outline" size="icon" className="shrink-0" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back</span>
        </Button>
        <h1 className="flex-1 text-xl font-semibold">The Love Lab</h1>
        <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout">
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="mx-auto max-w-4xl space-y-8">
          <section className="text-center space-y-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Activity className="h-8 w-8" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Romance Deep Scan</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              We securely analyze your shared history on the server to calculate your deep connection score.
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
                  Analyzing 500 Messages...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Calculate the Vibe
                </>
              )}
            </Button>
          </section>

          {result && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="overflow-hidden border-primary/20 bg-primary/5">
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Overall Bond
                  </CardTitle>
                  <div className="flex justify-center items-center gap-4">
                     <Heart className="h-10 w-10 text-primary animate-pulse fill-primary" />
                     <span className="text-7xl font-black text-primary">{result.overallScore}%</span>
                     <Heart className="h-10 w-10 text-primary animate-pulse fill-primary" />
                  </div>
                  <CardDescription className="text-lg font-medium text-foreground mt-4">
                    Relationship Vibe: <span className="text-primary italic">"{result.vibe}"</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center">
                  <div className="h-48 w-full max-w-xs">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={getChartData(result.overallScore)}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
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
                  <div className="text-center max-w-lg mt-[-40px]">
                    <p className="text-base leading-relaxed italic opacity-90 px-6">
                      "{result.summary}"
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 md:grid-cols-2">
                {result.userScores.map((userScore) => (
                  <Card key={userScore.username} className="relative overflow-hidden border-muted">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <User className="h-16 w-16" />
                    </div>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {userScore.username}
                        {userScore.username === currentUser && (
                            <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase font-bold">You</span>
                        )}
                      </CardTitle>
                      <CardDescription>Individual Contribution</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-bold text-primary">{userScore.score}%</span>
                        <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden mb-2">
                            <div 
                                className="h-full bg-primary transition-all duration-1000" 
                                style={{ width: `${userScore.score}%` }}
                            />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                        {userScore.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card className="bg-card/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Bond Highlights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 text-sm">
                      {result.highlights.map((highlight, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <Heart className="mt-1 h-3 w-3 text-primary shrink-0 fill-primary" />
                          <span className="opacity-90">{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="bg-muted/30 border-dashed">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                      <Info className="h-4 w-4 text-muted-foreground" />
                      Server-Side Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      This calculation analyzes up to 500 recent messages securely on the server. It considers sentiment, responsiveness, and affection expressed by both users. No message data is stored after the analysis is complete.
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