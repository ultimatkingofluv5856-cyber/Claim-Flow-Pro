import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ResponsiveOverlay } from '@/components/ui/responsive-overlay';
import { Image, FileText, Download, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AttachmentPreviewProps {
  fileIds: string[];
  claimId: string;
  compact?: boolean;
}

function getPublicUrl(fileId: string) {
  const { data } = supabase.storage.from('claim-attachments').getPublicUrl(fileId);
  return data?.publicUrl || '';
}

function isImage(name: string) {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(name);
}

function isPdf(name: string) {
  return /\.pdf$/i.test(name);
}

function getFileName(fileId: string) {
  const parts = fileId.split('/');
  return parts[parts.length - 1] || fileId;
}

export default function AttachmentPreview({ fileIds, compact = false }: AttachmentPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | 'other'>('other');

  if (!fileIds || fileIds.length === 0) {
    return <p className="text-sm italic text-muted-foreground">No attachments</p>;
  }

  const openPreview = (fileId: string) => {
    const url = getPublicUrl(fileId);
    setPreviewType(isImage(fileId) ? 'image' : isPdf(fileId) ? 'pdf' : 'other');
    setPreviewFileId(fileId);
    setPreviewUrl(url);
  };

  const closePreview = () => {
    setPreviewUrl(null);
    setPreviewFileId(null);
  };

  const downloadFile = async (fileId: string) => {
    try {
      const { data, error } = await supabase.storage.from('claim-attachments').download(fileId);
      if (error || !data) throw error || new Error('Download failed');

      const objectUrl = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = getFileName(fileId);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Attachment download failed:', error);
      toast.error('Attachment download failed');
    }
  };

  const footer = (
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
      <Button variant="outline" asChild>
        <a href={previewUrl || ''} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="mr-1 h-4 w-4" /> Open
        </a>
      </Button>
      <Button variant="outline" onClick={() => previewFileId && void downloadFile(previewFileId)}>
        <Download className="mr-1 h-4 w-4" /> Download
      </Button>
      <Button variant="outline" onClick={closePreview}>Close</Button>
    </div>
  );

  return (
    <div>
      {!compact && (
        <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold">
          <Image className="h-4 w-4" /> Attachments ({fileIds.length})
        </h4>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {fileIds.map((fileId, idx) => {
          const url = getPublicUrl(fileId);
          const name = getFileName(fileId);
          const imageFile = isImage(fileId);

          return (
            <div
              key={idx}
              className="group relative overflow-hidden rounded-lg border border-border transition-all hover:ring-2 hover:ring-primary/50"
            >
              <div className="cursor-pointer" onClick={() => openPreview(fileId)}>
                {imageFile ? (
                  <div className="aspect-square overflow-hidden bg-muted/30">
                    <img src={url} alt={name} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                  </div>
                ) : (
                  <div className="flex aspect-square flex-col items-center justify-center gap-1 bg-muted/30 p-2">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <span className="w-full truncate text-center text-xs text-muted-foreground">{name}</span>
                  </div>
                )}
              </div>
              <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-1 bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-10 w-10 bg-white/90 hover:bg-white md:h-7 md:w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    void downloadFile(fileId);
                  }}
                  title="Download"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <ResponsiveOverlay
        open={!!previewUrl}
        onOpenChange={(open) => {
          if (!open) closePreview();
        }}
        title="Attachment Preview"
        desktopClassName="max-w-4xl"
        mobileClassName="max-h-[94svh]"
        bodyClassName="overflow-auto max-h-[70vh] flex items-center justify-center"
        footer={previewUrl ? footer : undefined}
      >
        {previewType === 'image' && previewUrl && (
          <img src={previewUrl} alt="Preview" className="max-h-[65vh] max-w-full rounded object-contain" />
        )}
        {previewType === 'pdf' && previewUrl && (
          <iframe src={previewUrl} className="h-[65vh] w-full rounded border" title="PDF Preview" />
        )}
        {previewType === 'other' && (
          <div className="p-8 text-center">
            <FileText className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
            <p className="text-muted-foreground">Preview not available for this file type.</p>
            <Button variant="outline" className="mt-4" onClick={() => previewFileId && void downloadFile(previewFileId)}>
              <Download className="mr-1 h-4 w-4" /> Download File
            </Button>
          </div>
        )}
      </ResponsiveOverlay>
    </div>
  );
}
