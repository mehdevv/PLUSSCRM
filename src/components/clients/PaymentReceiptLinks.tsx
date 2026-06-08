import { useEffect, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { getClientFileUrl } from "@/services/clients";
import type { ClientFile } from "@/types";

function isImage(name: string) {
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
}

function ReceiptItem({ file }: { file: ClientFile }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getClientFileUrl(file.file_path).then((signed) => {
      if (active) setUrl(signed);
    });
    return () => { active = false; };
  }, [file.file_path]);

  if (!url) {
    return (
      <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{file.file_name}</span>
    );
  }

  if (isImage(file.file_name)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block shrink-0"
        title={file.file_name}
      >
        <img
          src={url}
          alt={file.file_name}
          className="h-14 w-14 rounded-md border border-border object-cover hover:opacity-90"
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline max-w-[140px] truncate"
      title={file.file_name}
    >
      <FileText className="w-3 h-3 shrink-0" />
      {file.file_name}
      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
    </a>
  );
}

export function PaymentReceiptLinks({ files }: { files: ClientFile[] }) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-border/60">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-full">
        Receipts
      </span>
      {files.map((file) => (
        <ReceiptItem key={file.id} file={file} />
      ))}
    </div>
  );
}
