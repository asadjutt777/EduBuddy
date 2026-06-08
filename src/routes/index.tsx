import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { getDashboardData, Activity } from "@/lib/dashboard";
import {
  Upload,
  MessageSquare,
  Sparkles,
  GraduationCap,
  NotebookPen,
  FileText,
  TrendingUp,
  Clock,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — EduAssist AI" },
      { name: "description", content: "Your AI-powered study dashboard." },
    ],
  }),
  component: Dashboard,
});

const quickActions = [
  { title: "Upload document", desc: "Add a PDF, PPTX, or DOCX", icon: Upload, to: "/documents" },
  { title: "Start a chat", desc: "Ask questions about your notes", icon: MessageSquare, to: "/chat" },
  { title: "Generate summary", desc: "Distill key points instantly", icon: Sparkles, to: "/summaries" },
  { title: "Create a quiz", desc: "MCQs, T/F, short answer", icon: GraduationCap, to: "/quiz" },
];

const iconMap: Record<string, any> = {
  Upload,
  MessageSquare,
  Sparkles,
  GraduationCap,
  NotebookPen
};

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function Dashboard() {
  const [statsData, setStatsData] = useState<{
    documents: number;
    chatSessions: number;
    quizzesGenerated: number;
    studyStreak: number;
  } | null>(null);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);

  useEffect(() => {
    async function loadData() {
      const { stats, recent } = await getDashboardData();
      setStatsData(stats);
      setRecentActivities(recent);
    }
    loadData();
  }, []);

  const stats = [
    { label: "Documents", value: statsData ? String(statsData.documents) : "...", icon: FileText, hint: "Total uploaded" },
    { label: "Chat sessions", value: statsData ? String(statsData.chatSessions) : "...", icon: MessageSquare, hint: "Total sessions" },
    { label: "Quizzes generated", value: statsData ? String(statsData.quizzesGenerated) : "...", icon: GraduationCap, hint: "Total quizzes" },
    { label: "Study streak", value: statsData ? `${statsData.studyStreak}d` : "...", icon: TrendingUp, hint: statsData && statsData.studyStreak > 0 ? "Keep going!" : "Start studying today!" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-10">
      <PageHeader
        eyebrow="Welcome back"
        title="Your study workspace"
        description="Upload course materials and let EduAssist turn them into summaries, quizzes, and study notes."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/chat">
                <MessageSquare className="h-4 w-4" />
                Open chat
              </Link>
            </Button>
            <Button asChild>
              <Link to="/documents">
                <Upload className="h-4 w-4" />
                Upload document
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
                  <p className="mt-2 font-display text-3xl font-semibold">{s.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
                </div>
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-primary-foreground"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  <s.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <section>
        <h3 className="mb-4 font-display text-lg font-semibold">Quick actions</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((a) => (
            <Link key={a.title} to={a.to} className="group">
              <Card className="h-full border-border/60 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-elegant)]">
                <CardContent className="space-y-3 p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <a.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{a.title}</p>
                    <p className="text-sm text-muted-foreground">{a.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="font-display">Recent activity</CardTitle>
            <CardDescription>Everything you've done across EduAssist.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {recentActivities.map((r, index) => {
              const IconComponent = iconMap[r.icon] || Sparkles;
              return (
                <div key={index} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <IconComponent className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{r.action}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {timeAgo(r.time)}
                  </div>
                </div>
              );
            })}
            {recentActivities.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No recent activity. Start by uploading a document!</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
