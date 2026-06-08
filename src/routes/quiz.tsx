import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  GraduationCap,
  Loader2,
  CheckCircle2,
  ListChecks,
  ToggleLeft,
  MessageSquareText,
  Layers,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateQuizFn } from "@/lib/api/quiz.functions";
import { recordActivity } from "@/lib/dashboard";
import { toast } from "sonner";

export const Route = createFileRoute("/quiz")({
  head: () => ({ meta: [{ title: "Quiz Generator — EduAssist AI" }] }),
  component: QuizPage,
});

type QuizType = "all" | "mcq" | "tf" | "sa";
type MCQ = { q: string; choices: string[]; answer: number };
type TF = { q: string; answer: boolean };
type SA = { q: string; sample: string };

const QUIZ_TYPE_OPTIONS: {
  value: QuizType;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "all",
    label: "All types",
    description: "MCQs + True/False + Short Answer",
    icon: <Layers className="h-5 w-5" />,
  },
  {
    value: "mcq",
    label: "Multiple Choice",
    description: "4-option MCQs with one correct answer",
    icon: <ListChecks className="h-5 w-5" />,
  },
  {
    value: "tf",
    label: "True / False",
    description: "Statements to judge as true or false",
    icon: <ToggleLeft className="h-5 w-5" />,
  },
  {
    value: "sa",
    label: "Short Answer",
    description: "Open-ended questions with sample answers",
    icon: <MessageSquareText className="h-5 w-5" />,
  },
];

function QuizPage() {
  const [doc, setDoc] = useState("");
  const [count, setCount] = useState([5]);
  const [quizType, setQuizType] = useState<QuizType>("all");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [docs, setDocs] = useState<{ id: string; name: string }[]>([]);
  const [generatedType, setGeneratedType] = useState<QuizType>("all");

  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [tfs, setTfs] = useState<TF[]>([]);
  const [sas, setSas] = useState<SA[]>([]);

  // Selected answers for interactive quiz
  const [selectedMcq, setSelectedMcq] = useState<Record<number, number>>({});
  const [selectedTf, setSelectedTf] = useState<Record<number, boolean | null>>({});

  useEffect(() => {
    async function fetchDocs() {
      const { data } = await supabase
        .from("documents")
        .select("id, name")
        .order("created_at", { ascending: false });
      if (data) setDocs(data);
    }
    fetchDocs();
  }, []);

  const generate = async () => {
    if (!doc) return;
    setLoading(true);
    setReady(false);
    setRevealed({});
    setSelectedMcq({});
    setSelectedTf({});
    try {
      const res = await generateQuizFn({
        data: { documentId: doc, count: count[0], quizType },
      });
      if (res.success && res.data) {
        setMcqs(res.data.mcqs || []);
        setTfs(res.data.tf || []);
        setSas(res.data.sa || []);
        setGeneratedType(quizType);
        setReady(true);
        toast.success("Quiz generated successfully!");
        const docName = docs.find((d) => d.id === doc)?.name || "Document";
        recordActivity("quiz", `Quiz: ${docName}`);
      } else {
        toast.error(
          res.error || "Failed to generate quiz. Please try again."
        );
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // Determine which tabs to show based on generated type
  const showMcq = generatedType === "all" || generatedType === "mcq";
  const showTf = generatedType === "all" || generatedType === "tf";
  const showSa = generatedType === "all" || generatedType === "sa";

  const defaultTab = generatedType === "all" ? "mcq" : generatedType;

  // Score calculations
  const mcqScore =
    mcqs.length > 0
      ? mcqs.filter((q, i) => selectedMcq[i] === q.answer).length
      : 0;
  const tfScore =
    tfs.length > 0
      ? tfs.filter((q, i) => selectedTf[i] === q.answer).length
      : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 md:p-10">
      <PageHeader
        eyebrow="AI Tool"
        title="Quiz Generator"
        description="Turn any document into MCQs, true/false, or short-answer questions for active recall."
      />

      {/* ─── Configuration Card ─── */}
      <Card className="border-border/60">
        <CardContent className="space-y-6 p-6">
          {/* Document & Count row */}
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Document</label>
              <Select value={doc} onValueChange={setDoc}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a document" />
                </SelectTrigger>
                <SelectContent>
                  {docs.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                  {docs.length === 0 && (
                    <SelectItem value="none" disabled>
                      No documents uploaded
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Number of questions:{" "}
                <span className="text-primary">{count[0]}</span>
              </label>
              <Slider
                value={count}
                onValueChange={setCount}
                min={3}
                max={20}
                step={1}
              />
            </div>
          </div>

          {/* Question Type Selector */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Question type</label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {QUIZ_TYPE_OPTIONS.map((opt) => {
                const isSelected = quizType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setQuizType(opt.value)}
                    className={`group relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all duration-200 ${
                      isSelected
                        ? "border-primary bg-primary/8 shadow-sm"
                        : "border-border/60 hover:border-primary/40 hover:bg-accent/30"
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-accent text-muted-foreground group-hover:text-foreground"
                      }`}
                    >
                      {opt.icon}
                    </div>
                    <span
                      className={`text-sm font-semibold leading-tight ${
                        isSelected ? "text-primary" : ""
                      }`}
                    >
                      {opt.label}
                    </span>
                    <span className="text-[11px] leading-tight text-muted-foreground">
                      {opt.description}
                    </span>
                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generate Button */}
          <Button onClick={generate} disabled={!doc || loading} size="lg">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GraduationCap className="h-4 w-4" />
            )}
            {loading ? "Generating…" : "Generate quiz"}
          </Button>
        </CardContent>
      </Card>

      {/* ─── Results ─── */}
      {ready && (
        <div className="space-y-6">
          {/* Score banner for types that have definitive answers */}
          {(showMcq || showTf) && Object.keys({ ...selectedMcq, ...selectedTf }).length > 0 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-display text-lg font-semibold">Your Score</p>
                  <p className="text-sm text-muted-foreground">
                    Click on answers to track your progress
                  </p>
                </div>
                <div className="flex gap-4">
                  {showMcq && mcqs.length > 0 && (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">
                        {mcqScore}/{mcqs.length}
                      </p>
                      <p className="text-xs text-muted-foreground">MCQs</p>
                    </div>
                  )}
                  {showTf && tfs.length > 0 && (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">
                        {tfScore}/{tfs.length}
                      </p>
                      <p className="text-xs text-muted-foreground">T/F</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* If only one type, show directly. If all, show tabs. */}
          {generatedType !== "all" ? (
            // Single type — no tabs needed
            <div className="space-y-4">
              {showMcq && <MCQList mcqs={mcqs} selected={selectedMcq} onSelect={setSelectedMcq} revealed={revealed} onReveal={setRevealed} />}
              {showTf && <TFList tfs={tfs} selected={selectedTf} onSelect={setSelectedTf} revealed={revealed} onReveal={setRevealed} />}
              {showSa && <SAList sas={sas} revealed={revealed} onReveal={setRevealed} />}
            </div>
          ) : (
            // All types — use tabs
            <Tabs defaultValue={defaultTab}>
              <TabsList className="grid w-full grid-cols-3 md:w-auto">
                <TabsTrigger value="mcq">
                  <ListChecks className="mr-1.5 h-3.5 w-3.5" />
                  Multiple choice
                </TabsTrigger>
                <TabsTrigger value="tf">
                  <ToggleLeft className="mr-1.5 h-3.5 w-3.5" />
                  True / False
                </TabsTrigger>
                <TabsTrigger value="sa">
                  <MessageSquareText className="mr-1.5 h-3.5 w-3.5" />
                  Short answer
                </TabsTrigger>
              </TabsList>

              <TabsContent value="mcq" className="mt-6 space-y-4">
                <MCQList mcqs={mcqs} selected={selectedMcq} onSelect={setSelectedMcq} revealed={revealed} onReveal={setRevealed} />
              </TabsContent>

              <TabsContent value="tf" className="mt-6 space-y-4">
                <TFList tfs={tfs} selected={selectedTf} onSelect={setSelectedTf} revealed={revealed} onReveal={setRevealed} />
              </TabsContent>

              <TabsContent value="sa" className="mt-6 space-y-4">
                <SAList sas={sas} revealed={revealed} onReveal={setRevealed} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Sub-components ---------- */

function MCQList({
  mcqs,
  selected,
  onSelect,
  revealed,
  onReveal,
}: {
  mcqs: MCQ[];
  selected: Record<number, number>;
  onSelect: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  revealed: Record<string, boolean>;
  onReveal: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  if (mcqs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center p-4">
        No MCQs generated.
      </p>
    );
  }
  return (
    <>
      {mcqs.map((q, i) => {
        const key = `mcq-${i}`;
        const isRevealed = revealed[key];
        const userAnswer = selected[i];
        return (
          <Card key={i} className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                {i + 1}. {q.q}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {q.choices.map((c, j) => {
                const correct = j === q.answer;
                const isUserPick = userAnswer === j;
                let style =
                  "border-border hover:border-primary/40 hover:bg-accent/40";
                if (isRevealed && correct) {
                  style = "border-primary bg-primary/10";
                } else if (isRevealed && isUserPick && !correct) {
                  style = "border-destructive/60 bg-destructive/10";
                }
                return (
                  <button
                    key={j}
                    onClick={() => {
                      onSelect((s) => ({ ...s, [i]: j }));
                      onReveal((r) => ({ ...r, [key]: true }));
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${style}`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold">
                      {String.fromCharCode(65 + j)}
                    </span>
                    <span className="flex-1">{c}</span>
                    {isRevealed && correct && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                  </button>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}

function TFList({
  tfs,
  selected,
  onSelect,
  revealed,
  onReveal,
}: {
  tfs: TF[];
  selected: Record<number, boolean | null>;
  onSelect: React.Dispatch<React.SetStateAction<Record<number, boolean | null>>>;
  revealed: Record<string, boolean>;
  onReveal: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  if (tfs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center p-4">
        No True/False questions generated.
      </p>
    );
  }
  return (
    <>
      {tfs.map((q, i) => {
        const key = `tf-${i}`;
        const isRevealed = revealed[key];
        const userAnswer = selected[i];
        return (
          <Card key={i} className="border-border/60">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <p className="font-medium">
                {i + 1}. {q.q}
              </p>
              <div className="flex gap-2">
                {[true, false].map((v) => {
                  const isCorrect = v === q.answer;
                  const isUserPick = userAnswer === v;
                  let variant: "default" | "outline" | "destructive" = "outline";
                  if (isRevealed && isCorrect) variant = "default";
                  else if (isRevealed && isUserPick && !isCorrect)
                    variant = "destructive";
                  return (
                    <Button
                      key={String(v)}
                      variant={variant}
                      size="sm"
                      onClick={() => {
                        onSelect((s) => ({ ...s, [i]: v }));
                        onReveal((r) => ({ ...r, [key]: true }));
                      }}
                    >
                      {v ? "True" : "False"}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}

function SAList({
  sas,
  revealed,
  onReveal,
}: {
  sas: SA[];
  revealed: Record<string, boolean>;
  onReveal: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  if (sas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center p-4">
        No short answer questions generated.
      </p>
    );
  }
  return (
    <>
      {sas.map((q, i) => {
        const key = `sa-${i}`;
        return (
          <Card key={i} className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                {i + 1}. {q.q}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onReveal((r) => ({ ...r, [key]: !r[key] }))
                }
              >
                {revealed[key] ? "Hide answer" : "Show sample answer"}
              </Button>
              {revealed[key] && (
                <p className="mt-3 rounded-lg bg-accent/40 p-3 text-sm text-muted-foreground">
                  {q.sample}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
