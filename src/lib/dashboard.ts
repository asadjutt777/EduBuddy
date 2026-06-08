import { supabase } from "@/integrations/supabase/client";

export interface Activity {
  title: string;
  action: string;
  time: string; // ISO string
  icon: string;
}

export interface DashboardStats {
  documents: number;
  chatSessions: number;
  quizzesGenerated: number;
  studyStreak: number;
}

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getYesterdayString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Update and return the streak
function updateStreak(): number {
  if (typeof window === "undefined") return 0;
  
  const today = getTodayString();
  const yesterday = getYesterdayString();
  const rawStreak = window.localStorage.getItem("eduassist_streak");
  
  if (!rawStreak) {
    const initialStreak = { lastActiveDate: today, streakCount: 1 };
    window.localStorage.setItem("eduassist_streak", JSON.stringify(initialStreak));
    return 1;
  }

  try {
    const streakData = JSON.parse(rawStreak);
    const { lastActiveDate, streakCount } = streakData;

    if (lastActiveDate === today) {
      return streakCount;
    } else if (lastActiveDate === yesterday) {
      const updatedStreak = { lastActiveDate: today, streakCount: streakCount + 1 };
      window.localStorage.setItem("eduassist_streak", JSON.stringify(updatedStreak));
      return streakCount + 1;
    } else {
      const resetStreak = { lastActiveDate: today, streakCount: 1 };
      window.localStorage.setItem("eduassist_streak", JSON.stringify(resetStreak));
      return 1;
    }
  } catch {
    const initialStreak = { lastActiveDate: today, streakCount: 1 };
    window.localStorage.setItem("eduassist_streak", JSON.stringify(initialStreak));
    return 1;
  }
}

// Log a user activity
export function recordActivity(
  type: "upload" | "chat" | "quiz" | "summary" | "notes",
  title: string
) {
  if (typeof window === "undefined") return;

  const today = getTodayString();
  
  // 1. Update Streak
  updateStreak();

  // 2. Update stats count
  if (type === "chat") {
    const cur = Number(window.localStorage.getItem("eduassist_chat_count") || "0");
    window.localStorage.setItem("eduassist_chat_count", String(cur + 1));
  } else if (type === "quiz") {
    const cur = Number(window.localStorage.getItem("eduassist_quiz_count") || "0");
    window.localStorage.setItem("eduassist_quiz_count", String(cur + 1));
  }

  // 3. Log activity
  const actionMap = {
    upload: { action: "Uploaded", icon: "Upload" },
    chat: { action: "Chat session started", icon: "MessageSquare" },
    quiz: { action: "Quiz generated", icon: "GraduationCap" },
    summary: { action: "Summarized", icon: "Sparkles" },
    notes: { action: "Study notes created", icon: "NotebookPen" }
  };

  const newActivity: Activity = {
    title,
    action: actionMap[type].action,
    time: new Date().toISOString(),
    icon: actionMap[type].icon
  };

  let activities: Activity[] = [];
  try {
    activities = JSON.parse(window.localStorage.getItem("eduassist_recent_activities") || "[]");
  } catch {
    activities = [];
  }

  // Insert at front, limit to 6
  activities.unshift(newActivity);
  activities = activities.slice(0, 6);

  window.localStorage.setItem("eduassist_recent_activities", JSON.stringify(activities));
}

// Get all dashboard metrics
export async function getDashboardData(): Promise<{
  stats: DashboardStats;
  recent: Activity[];
}> {
  if (typeof window === "undefined") {
    return {
      stats: { documents: 0, chatSessions: 0, quizzesGenerated: 0, studyStreak: 0 },
      recent: []
    };
  }

  // Get current streak count without resetting unless it's past yesterday
  let streak = 0;
  const today = getTodayString();
  const yesterday = getYesterdayString();
  const rawStreak = window.localStorage.getItem("eduassist_streak");
  if (rawStreak) {
    try {
      const streakData = JSON.parse(rawStreak);
      const { lastActiveDate, streakCount } = streakData;
      if (lastActiveDate === today || lastActiveDate === yesterday) {
        streak = streakCount;
      } else {
        // Streak has broken
        streak = 0;
      }
    } catch {
      streak = 0;
    }
  }

  // Count documents from Supabase database
  let docCount = 0;
  try {
    const { count, error } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true });
    if (!error && count !== null) {
      docCount = count;
    }
  } catch (err) {
    console.error("Failed to query documents count:", err);
  }

  const chatSessions = Number(window.localStorage.getItem("eduassist_chat_count") || "0");
  const quizzesGenerated = Number(window.localStorage.getItem("eduassist_quiz_count") || "0");

  let recent: Activity[] = [];
  try {
    recent = JSON.parse(window.localStorage.getItem("eduassist_recent_activities") || "[]");
  } catch {
    recent = [];
  }

  return {
    stats: {
      documents: docCount,
      chatSessions,
      quizzesGenerated,
      studyStreak: streak
    },
    recent
  };
}
