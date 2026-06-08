import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, FileText, Loader2, CheckCircle2, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateSummaryFn } from "@/lib/api/summarize.functions";
import { recordActivity } from "@/lib/dashboard";
import { toast } from "sonner";

export const Route = createFileRoute("/summaries")({
  head: () => ({ meta: [{ title: "Summaries — EduAssist AI" }] }),
  component: SummariesPage,
});

function SummariesPage() {
  const [doc, setDoc] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | {
    summary: string;
    keyPoints: string[];
    concepts: string[];
  }>(null);
  const [docs, setDocs] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    async function fetchDocs() {
      const { data } = await supabase.from("documents").select("id, name").order("created_at", { ascending: false });
      if (data) setDocs(data);
    }
    fetchDocs();
  }, []);

  const generate = async () => {
    if (!doc) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await generateSummaryFn({ data: { documentId: doc } });
      if (res.success && res.data) {
        setResult(res.data);
        toast.success("Summary generated successfully!");
        const docName = docs.find((d) => d.id === doc)?.name || "Document";
        recordActivity("summary", `Summary: ${docName}`);
      } else {
        toast.error(res.error || "Failed to generate summary. Make sure you set a valid OPENAI_API_KEY.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 md:p-10">
      <PageHeader
        eyebrow="AI Tool"
        title="Summarization"
        description="Generate concise summaries, key points, and core concepts from any uploaded document."
      />

      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-end">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">Document</label>
            <Select value={doc} onValueChange={setDoc}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a document to summarize" />
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
          <Button onClick={generate} disabled={!doc || loading} size="lg">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Generating…" : "Generate summary"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="border-border/60 lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <FileText className="h-5 w-5 text-primary" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-relaxed text-muted-foreground">{result.summary}</p>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Lightbulb className="h-5 w-5 text-primary" />
                Key concepts
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {result.concepts.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
                >
                  {c}
                </span>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60 lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Key points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {result.keyPoints.map((p, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {i + 1}
                    </span>
                    <span className="text-sm leading-relaxed">{p}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
