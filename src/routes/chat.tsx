import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Plus,
  MessageSquare,
  Sparkles,
  BookOpen,
  Loader2,
  Database,
  Globe,
  AlertCircle,
} from "lucide-react";
import { sendChatMessage } from "@/lib/api/chat.functions";
import { recordActivity } from "@/lib/dashboard";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "Chat — EduAssist AI" }] }),
  component: ChatPage,
});

type Msg = {
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
};

const SUGGESTIONS = [
  "Explain the key concepts from my uploaded documents",
  "Summarize the main points in 5 bullets",
  "Quiz me on the content of my documents",
  "What are the most important topics I should study?",
];

function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [useRAG, setUseRAG] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    if (messages.length === 0) {
      const displayTitle = trimmed.length > 35 ? trimmed.slice(0, 35) + "..." : trimmed;
      recordActivity("chat", `Chat: "${displayTitle}"`);
    }

    const userMsg: Msg = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const result = await sendChatMessage({
        data: {
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          useRAG,
        },
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.message,
          isError: !result.success,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Connection error: ${err.message}. Make sure the dev server is running and your API keys are configured in .env.`,
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  };

  const newChat = () => {
    setMessages([]);
    setInput("");
    textareaRef.current?.focus();
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-sidebar/40 md:flex">
        <div className="p-4 space-y-3">
          <Button className="w-full justify-start gap-2" onClick={newChat}>
            <Plus className="h-4 w-4" />
            New chat
          </Button>

          {/* RAG Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              {useRAG ? (
                <Database className="h-4 w-4 text-primary" />
              ) : (
                <Globe className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <Label className="text-xs font-medium cursor-pointer" htmlFor="rag-toggle">
                  {useRAG ? "Using documents" : "General knowledge"}
                </Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {useRAG ? "Answers from your files" : "No document context"}
                </p>
              </div>
            </div>
            <Switch
              id="rag-toggle"
              checked={useRAG}
              onCheckedChange={setUseRAG}
            />
          </div>
        </div>

        <div className="px-3 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Tips
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1 px-3 pb-4 text-xs text-muted-foreground">
            <div className="rounded-lg bg-accent/50 p-3 space-y-1.5">
              <p className="font-medium text-foreground">Getting started</p>
              <p>Upload documents on the <strong>Documents</strong> page first, then ask questions here.</p>
              <p>Enable the <strong>Using documents</strong> toggle to answer from your files.</p>
            </div>
          </div>
        </ScrollArea>
      </aside>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col min-h-0">
        {/* RAG badge on mobile */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 md:hidden">
          <Badge
            variant="outline"
            className={`gap-1.5 text-xs ${useRAG ? "border-primary/50 text-primary" : ""}`}
          >
            {useRAG ? <Database className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
            {useRAG ? "Documents mode" : "General mode"}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setUseRAG((v) => !v)}
          >
            Switch
          </Button>
        </div>

        <ScrollArea className="flex-1" ref={scrollRef as any}>
          <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
            {messages.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div
                  className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-primary-foreground shadow-[var(--shadow-elegant)]"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  <Sparkles className="h-7 w-7" />
                </div>
                <h2 className="font-display text-2xl font-semibold">
                  Ask anything about your documents
                </h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Upload notes, slides, or papers — then ask EduAssist to explain,
                  summarize, or quiz you using Gemini AI.
                </p>
                <div className="mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setInput(p)}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-left text-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
                    >
                      <BookOpen className="h-4 w-4 shrink-0 text-primary" />
                      <span>{p}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Message list */
              <div className="space-y-6">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}
                  >
                    {m.role === "assistant" && (
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-primary-foreground"
                        style={{ background: "var(--gradient-primary)" }}
                      >
                        <Sparkles className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : m.isError
                          ? "bg-destructive/10 text-destructive border border-destructive/20"
                          : "bg-accent text-accent-foreground"
                      }`}
                    >
                      {m.isError && (
                        <div className="flex items-center gap-1.5 mb-2 text-xs font-medium">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Error
                        </div>
                      )}
                      {m.content}
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {loading && (
                  <div className="flex gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-primary-foreground"
                      style={{ background: "var(--gradient-primary)" }}
                    >
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {useRAG
                        ? "Searching your documents and generating response…"
                        : "Generating response…"}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input bar */}
        <div className="border-t border-border bg-background/80 backdrop-blur-md">
          <div className="mx-auto max-w-3xl p-4">
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-soft)] focus-within:border-primary/50 transition-colors">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={
                  useRAG
                    ? "Ask about your uploaded documents…"
                    : "Ask EduAssist anything…"
                }
                className="min-h-[44px] max-h-40 resize-none border-0 bg-transparent focus-visible:ring-0"
                disabled={loading}
              />
              <Button
                size="icon"
                onClick={send}
                disabled={!input.trim() || loading}
                className="shrink-0"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Powered by Google Gemini · EduAssist may produce inaccurate info — always verify with source material.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
