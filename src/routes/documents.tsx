import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Search,
  FileText,
  MoreVertical,
  FileType2,
  Loader2,
  Trash2,
  Download,
  Brain,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { recordActivity } from "@/lib/dashboard";
import { indexDocumentFn } from "@/lib/api/indexDocument.functions";

export const Route = createFileRoute("/documents")({
  head: () => ({ meta: [{ title: "Documents — EduAssist AI" }] }),
  component: DocumentsPage,
});

type DocType = "PDF" | "PPTX" | "DOCX";

type Doc = {
  id: string;
  name: string;
  file_type: DocType;
  size_bytes: number;
  storage_path: string;
  created_at: string;
};

const typeColor: Record<DocType, string> = {
  PDF: "bg-red-500/10 text-red-600 dark:text-red-400",
  PPTX: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  DOCX: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

function inferType(name: string): DocType {
  const ext = name.split(".").pop()?.toUpperCase();
  return (["PDF", "PPTX", "DOCX"].includes(ext ?? "") ? ext : "PDF") as DocType;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

type IndexingStatus = "idle" | "indexing" | "done" | "error";

function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [q, setQ] = useState("");
  const [indexingStatus, setIndexingStatus] = useState<Record<string, IndexingStatus>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load documents");
      return;
    }
    setDocs((data ?? []) as Doc[]);
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const filtered = docs.filter((d) =>
    d.name.toLowerCase().includes(q.toLowerCase()),
  );

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    let success = 0;
    for (const file of Array.from(files)) {
      const type = inferType(file.name);
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, file, { contentType: file.type || undefined });
      if (upErr) {
        toast.error(`Upload failed: ${file.name}`);
        continue;
      }
      
      const { data: newDoc, error: dbErr } = await supabase.from("documents").insert({
        name: file.name,
        file_type: type,
        size_bytes: file.size,
        storage_path: path,
      }).select("id").single();

      if (dbErr) {
        toast.error(`Failed to save ${file.name}`);
        await supabase.storage.from("documents").remove([path]);
        continue;
      }
      success++;
      recordActivity("upload", file.name);


      if (newDoc?.id) {
        const docId = newDoc.id;
        setIndexingStatus((prev) => ({ ...prev, [docId]: "indexing" }));
        // Trigger indexing asynchronously (don't await — let it run in background)
        indexDocumentFn({ data: { documentId: docId } })
          .then((result) => {
            if (result.success) {
              setIndexingStatus((prev) => ({ ...prev, [docId]: "done" }));
              toast.success(`"${file.name}" indexed — ${result.chunks} chunks ready for chat`);
            } else {
              setIndexingStatus((prev) => ({ ...prev, [docId]: "error" }));
              toast.error(`Indexing failed for "${file.name}": ${result.error}`);
            }
          })
          .catch(() => {
            setIndexingStatus((prev) => ({ ...prev, [docId]: "error" }));
          });
      }
    }
    if (success > 0) toast.success(`${success} document${success > 1 ? "s" : ""} uploaded`);
    setUploading(false);
    await refresh();
  };

  const onDelete = async (d: Doc) => {
    await supabase.storage.from("documents").remove([d.storage_path]);
    const { error } = await supabase.from("documents").delete().eq("id", d.id);
    if (error) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Document deleted");
    setDocs((cur) => cur.filter((x) => x.id !== d.id));
  };

  const onDownload = async (d: Doc) => {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(d.storage_path, 60);
    if (error || !data) {
      toast.error("Could not create download link");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-10">
      <PageHeader
        eyebrow="Library"
        title="Documents"
        description="Upload PDFs, slide decks, and Word documents. EduAssist makes them queryable."
        actions={
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Upload
          </Button>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.pptx,.docx"
        multiple
        hidden
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <Card
        className="border-2 border-dashed border-border/80 bg-gradient-to-b from-accent/30 to-transparent transition-colors hover:border-primary/50"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onFiles(e.dataTransfer.files);
        }}
      >
        <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl text-primary-foreground"
            style={{ background: "var(--gradient-primary)" }}
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Upload className="h-6 w-6" />
            )}
          </div>
          <div>
            <p className="font-display text-lg font-semibold">
              {uploading ? "Uploading…" : "Drop files here"}
            </p>
            <p className="text-sm text-muted-foreground">
              PDF, PPTX, or DOCX — up to 50 MB each
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            Browse files
          </Button>
        </CardContent>
      </Card>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search documents…"
          className="pl-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {loading && (
              <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading documents…
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="p-10 text-center text-sm text-muted-foreground">
                {docs.length === 0
                  ? "No documents yet. Upload your first file to get started."
                  : "No documents match your search."}
              </div>
            )}
            {filtered.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-4 p-4 transition-colors hover:bg-accent/40"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
                  <FileText className="h-5 w-5 text-accent-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{d.name}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatSize(d.size_bytes)}</span>
                    <span>•</span>
                    <span>{timeAgo(d.created_at)}</span>
                    {/* RAG indexing status */}
                    {indexingStatus[d.id] === "indexing" && (
                      <span className="flex items-center gap-1 text-primary">
                        <Brain className="h-3 w-3 animate-pulse" />
                        Indexing…
                      </span>
                    )}
                    {indexingStatus[d.id] === "done" && (
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-3 w-3" />
                        Ready for chat
                      </span>
                    )}
                    {indexingStatus[d.id] === "error" && (
                      <span className="flex items-center gap-1 text-destructive">
                        <XCircle className="h-3 w-3" />
                        Index failed
                      </span>
                    )}
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className={`gap-1 ${typeColor[d.file_type]} border-0`}
                >
                  <FileType2 className="h-3 w-3" />
                  {d.file_type}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onDownload(d)}>
                      <Download className="h-4 w-4" />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete(d)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
