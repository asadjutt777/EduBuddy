import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTheme } from "@/lib/theme";
import {
  Moon,
  Sun,
  User,
  Shield,
  Bell,
  BookOpen,
  Database,
  Info,
  Save,
  Trash2,
  Download,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Check,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — EduAssist AI" }] }),
  component: SettingsPage,
});

/* ---------- Helpers ---------- */

function loadPref<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(`eduassist_pref_${key}`);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function savePref<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`eduassist_pref_${key}`, JSON.stringify(value));
}

/* ---------- Page ---------- */

function SettingsPage() {
  const { theme, toggle } = useTheme();

  // Profile state
  const [email, setEmail] = useState("Loading...");
  const [displayName, setDisplayName] = useState("Student");
  const [nameEditing, setNameEditing] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);

  // Password state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // Notification preferences
  const [notifyQuiz, setNotifyQuiz] = useState(() => loadPref("notify_quiz", true));
  const [notifyNotes, setNotifyNotes] = useState(() => loadPref("notify_notes", true));
  const [notifySummary, setNotifySummary] = useState(() => loadPref("notify_summary", true));
  const [notifyStreak, setNotifyStreak] = useState(() => loadPref("notify_streak", true));

  // Study preferences
  const [aiResponseLength, setAiResponseLength] = useState(() =>
    loadPref("ai_response_length", "balanced")
  );
  const [defaultQuizCount, setDefaultQuizCount] = useState(() =>
    loadPref("default_quiz_count", "5")
  );
  const [autoSave, setAutoSave] = useState(() => loadPref("auto_save", true));

  // Load user profile
  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email || "");
        if (user.user_metadata?.display_name) {
          setDisplayName(user.user_metadata.display_name);
        } else if (user.email) {
          setDisplayName(user.email.split("@")[0]);
        }
      }
    }
    loadUser();
  }, []);

  // Persist notification prefs
  useEffect(() => { savePref("notify_quiz", notifyQuiz); }, [notifyQuiz]);
  useEffect(() => { savePref("notify_notes", notifyNotes); }, [notifyNotes]);
  useEffect(() => { savePref("notify_summary", notifySummary); }, [notifySummary]);
  useEffect(() => { savePref("notify_streak", notifyStreak); }, [notifyStreak]);

  // Persist study prefs
  useEffect(() => { savePref("ai_response_length", aiResponseLength); }, [aiResponseLength]);
  useEffect(() => { savePref("default_quiz_count", defaultQuizCount); }, [defaultQuizCount]);
  useEffect(() => { savePref("auto_save", autoSave); }, [autoSave]);

  /* --- Handlers --- */

  const handleSaveDisplayName = async () => {
    setNameSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: displayName },
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Display name updated");
        setNameEditing(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update name");
    } finally {
      setNameSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("Passwords do not match");
      return;
    }
    setPwLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Password updated successfully");
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to change password");
    } finally {
      setPwLoading(false);
    }
  };

  const handleClearActivityData = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem("eduassist_recent_activities");
    window.localStorage.removeItem("eduassist_chat_count");
    window.localStorage.removeItem("eduassist_quiz_count");
    window.localStorage.removeItem("eduassist_streak");
    toast.success("Activity data cleared");
  };

  const handleExportData = () => {
    if (typeof window === "undefined") return;
    const data: Record<string, any> = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("eduassist_")) {
        try {
          data[key] = JSON.parse(window.localStorage.getItem(key) || "");
        } catch {
          data[key] = window.localStorage.getItem(key);
        }
      }
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eduassist-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported successfully");
  };

  /* --- UI sections --- */

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-10">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage your profile, preferences, and account settings."
      />

      {/* ─── Profile ─── */}
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <CardTitle className="font-display">Profile</CardTitle>
          </div>
          <CardDescription>Your public profile details used across the workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="settings-name">Display name</Label>
              <div className="flex gap-2">
                <Input
                  id="settings-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={!nameEditing}
                />
                {nameEditing ? (
                  <Button
                    size="sm"
                    onClick={handleSaveDisplayName}
                    disabled={nameSaving}
                    className="shrink-0"
                  >
                    {nameSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setNameEditing(true)}
                    className="shrink-0"
                  >
                    Edit
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email address</Label>
              <Input type="email" value={email} disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Account Security ─── */}
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="font-display">Account Security</CardTitle>
          </div>
          <CardDescription>Keep your account safe with a strong password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="new-pw">New password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-pw"
                    type={showPw ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    className="pl-9 pr-10"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPw ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="confirm-pw">Confirm new password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-pw"
                    type={showPw ? "text" : "password"}
                    placeholder="Re-enter password"
                    className="pl-9"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <Button type="submit" disabled={pwLoading || !newPw || !confirmPw} size="sm">
              {pwLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating…
                </>
              ) : (
                "Update password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ─── Appearance ─── */}
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            {theme === "dark" ? (
              <Moon className="h-5 w-5 text-primary" />
            ) : (
              <Sun className="h-5 w-5 text-primary" />
            )}
            <CardTitle className="font-display">Appearance</CardTitle>
          </div>
          <CardDescription>Customize how EduAssist looks on your device.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {theme === "dark" ? "Dark mode" : "Light mode"}
              </p>
              <p className="text-sm text-muted-foreground">
                Toggle the interface theme.
              </p>
            </div>
            <Switch checked={theme === "dark"} onCheckedChange={toggle} />
          </div>
        </CardContent>
      </Card>

      {/* ─── Notifications ─── */}
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="font-display">Notifications</CardTitle>
          </div>
          <CardDescription>Choose which in-app notifications you want to see.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            {
              id: "notify-quiz",
              label: "Quiz completion",
              desc: "Show a notification when a quiz is generated",
              checked: notifyQuiz,
              onChange: setNotifyQuiz,
            },
            {
              id: "notify-notes",
              label: "Study notes",
              desc: "Notify when study notes are ready",
              checked: notifyNotes,
              onChange: setNotifyNotes,
            },
            {
              id: "notify-summary",
              label: "Summaries",
              desc: "Notify when document summaries complete",
              checked: notifySummary,
              onChange: setNotifySummary,
            },
            {
              id: "notify-streak",
              label: "Study streak reminders",
              desc: "Remind you to maintain your daily streak",
              checked: notifyStreak,
              onChange: setNotifyStreak,
            },
          ].map((n, i, arr) => (
            <div key={n.id}>
              <div className="flex items-center justify-between py-1">
                <div>
                  <Label htmlFor={n.id} className="font-medium cursor-pointer">
                    {n.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">{n.desc}</p>
                </div>
                <Switch
                  id={n.id}
                  checked={n.checked}
                  onCheckedChange={n.onChange}
                />
              </div>
              {i < arr.length - 1 && <Separator className="my-2" />}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ─── Study Preferences ─── */}
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <CardTitle className="font-display">Study Preferences</CardTitle>
          </div>
          <CardDescription>Fine-tune how AI tools work for you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* AI Response Length */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">AI response length</p>
              <p className="text-sm text-muted-foreground">
                How detailed should AI-generated content be?
              </p>
            </div>
            <Select value={aiResponseLength} onValueChange={setAiResponseLength}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="concise">Concise</SelectItem>
                <SelectItem value="balanced">Balanced</SelectItem>
                <SelectItem value="detailed">Detailed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Default quiz question count */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Default quiz questions</p>
              <p className="text-sm text-muted-foreground">
                Number of questions generated per quiz.
              </p>
            </div>
            <Select value={defaultQuizCount} onValueChange={setDefaultQuizCount}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 questions</SelectItem>
                <SelectItem value="5">5 questions</SelectItem>
                <SelectItem value="10">10 questions</SelectItem>
                <SelectItem value="15">15 questions</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Auto-save */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Auto-save results</p>
              <p className="text-sm text-muted-foreground">
                Automatically save quizzes, summaries, and notes.
              </p>
            </div>
            <Switch checked={autoSave} onCheckedChange={setAutoSave} />
          </div>
        </CardContent>
      </Card>

      {/* ─── Data & Storage ─── */}
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle className="font-display">Data & Storage</CardTitle>
          </div>
          <CardDescription>Manage your local data and export options.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Export your data</p>
              <p className="text-sm text-muted-foreground">
                Download all your activity, streaks, and preferences as JSON.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportData}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>

          <Separator />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Clear activity data</p>
              <p className="text-sm text-muted-foreground">
                Reset streaks, activity history, chat and quiz counts.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all activity data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your streaks, activity history,
                    and session counts. Your uploaded documents in the cloud
                    will not be affected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearActivityData}>
                    Yes, clear data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* ─── About ─── */}
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            <CardTitle className="font-display">About</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Application</p>
              <p className="font-medium">EduAssist AI</p>
            </div>
            <div>
              <p className="text-muted-foreground">Version</p>
              <p className="font-medium">1.0.0</p>
            </div>
            <div>
              <p className="text-muted-foreground">AI Chat Model</p>
              <p className="font-medium">Llama 3.1 8B Instruct</p>
            </div>
            <div>
              <p className="text-muted-foreground">Embeddings</p>
              <p className="font-medium">Gemini Embedding 001</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
