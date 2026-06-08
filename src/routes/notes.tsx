import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NotebookPen, Loader2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateNotesFn } from "@/lib/api/notes.functions";
import { recordActivity } from "@/lib/dashboard";
import { toast } from "sonner";

export const Route = createFileRoute("/notes")({
  head: () => ({ meta: [{ title: "Study Notes — EduAssist AI" }] }),
  component: NotesPage,
});

type Section = {
  heading: string;
  text?: string;
  bullets?: string[];
  callout?: string;
};

type NotesResult = {
  title: string;
  sections: Section[];
};

function NotesPage() {
  const [doc, setDoc] = useState("");
  const [style, setStyle] = useState("revision");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [docs, setDocs] = useState<{ id: string; name: string }[]>([]);
  const [result, setResult] = useState<NotesResult | null>(null);

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
    setReady(false);
    setResult(null);
    try {
      const res = await generateNotesFn({
        data: {
          documentId: doc,
          style: style as any,
        },
      });
      if (res.success && res.data) {
        setResult(res.data);
        setReady(true);
        toast.success("Study notes generated successfully!");
        const docName = docs.find((d) => d.id === doc)?.name || "Document";
        recordActivity("notes", `Notes: ${docName}`);
      } else {
        toast.error(res.error || "Failed to generate study notes. Make sure you set a valid OPENAI_API_KEY.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!result) return;
    const textContent = `${result.title}\n\n` + result.sections.map((s, idx) => {
      let secText = `## ${idx + 1}. ${s.heading}\n`;
      if (s.text) secText += `${s.text}\n`;
      if (s.bullets && s.bullets.length > 0) {
        secText += s.bullets.map(b => `- ${b}`).join('\n') + '\n';
      }
      if (s.callout) secText += `\n[Focus Note]\n${s.callout}\n`;
      return secText;
    }).join('\n');
    
    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${result.title.replace(/\s+/g, "_")}_notes.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6 md:p-10">
      <PageHeader
        eyebrow="AI Tool"
        title="Study Notes Generator"
        description="Turn dense lectures into structured, revision-ready notes you can actually study from."
      />

      <Card className="border-border/60">
        <CardContent className="grid gap-5 p-6 md:grid-cols-[1fr_1fr_auto] md:items-end">
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
            <label className="text-sm font-medium">Style</label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revision">Revision notes</SelectItem>
                <SelectItem value="cornell">Cornell method</SelectItem>
                <SelectItem value="outline">Outline / bullets</SelectItem>
                <SelectItem value="cheatsheet">Cheat sheet</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={generate} disabled={!doc || loading} size="lg">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <NotebookPen className="h-4 w-4" />}
            {loading ? "Generating…" : "Generate notes"}
          </Button>
        </CardContent>
      </Card>

      {ready && result && (
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="font-display text-2xl">{result.title}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Generated study notes</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Export
            </Button>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none space-y-6 dark:prose-invert">
            {result.sections.map((s, idx) => (
              <section key={idx} className="space-y-2">
                <h3 className="font-display text-lg font-semibold">{idx + 1}. {s.heading}</h3>
                {s.text && (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {s.text}
                  </p>
                )}
                {s.bullets && s.bullets.length > 0 && (
                  <ul className="space-y-1 text-sm">
                    {s.bullets.map((b, bIdx) => (
                      <li key={bIdx}>• {b}</li>
                    ))}
                  </ul>
                )}
                {s.callout && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mt-2">
                    <h4 className="mb-2 font-semibold text-primary text-xs uppercase tracking-wider">Focus Note</h4>
                    <p className="text-sm">{s.callout}</p>
                  </div>
                )}
              </section>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

