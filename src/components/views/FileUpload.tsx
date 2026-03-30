import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import {
  Camera,
  CheckCircle2,
  FileText,
  ImagePlus,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { optimizeImageUpload } from '@/lib/image-optimization';
import { toast } from 'sonner';

const ACCEPTED_EXT = 'image/*,.pdf';
const TOTAL_LIMIT_MB = 50;

interface FileUploadProps {
  claimId: string;
  onFilesUploaded?: (fileIds: string[]) => void;
  onFileCountChange?: (count: number) => void;
  onBusyChange?: (busy: boolean) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

interface UploadItem {
  file: File;
  preview?: string;
  uploading: boolean;
  uploaded: boolean;
  path?: string;
  optimized?: boolean;
  originalSize?: number;
}

export interface FileUploadHandle {
  uploadAll: () => Promise<string[]>;
  getFileCount: () => number;
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

const FileUpload = forwardRef<FileUploadHandle, FileUploadProps>(
  ({ claimId, onFilesUploaded, onFileCountChange, onBusyChange, maxFiles = 10, maxSizeMB = 5 }, ref) => {
    const [files, setFiles] = useState<UploadItem[]>([]);
    const [uploading, setUploading] = useState(false);
    const [preparing, setPreparing] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const totalSize = useMemo(
      () => files.reduce((sum, current) => sum + current.file.size, 0),
      [files],
    );

    const validateFile = (file: File): string | null => {
      const isAcceptedImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      if (!isAcceptedImage && !isPdf) return `${file.name}: only PDF and image files are allowed.`;
      if (file.size > maxSizeMB * 1024 * 1024) return `${file.name}: file size exceeds ${maxSizeMB} MB.`;
      return null;
    };

    const handleFiles = async (selectedFiles: FileList | null, source: 'files' | 'camera' = 'files') => {
      if (!selectedFiles) return;

      setPreparing(true);
      let runningTotal = totalSize;
      const newFiles: UploadItem[] = [];
      try {
        for (let i = 0; i < selectedFiles.length; i += 1) {
          if (files.length + newFiles.length >= maxFiles) {
            toast.error(`Maximum ${maxFiles} files allowed.`);
            break;
          }

          const originalFile = selectedFiles[i];
          let file = originalFile;

          if (originalFile.type.startsWith('image/')) {
            try {
              file = await optimizeImageUpload(originalFile, {
                maxDimension: source === 'camera' ? 2400 : 2200,
                quality: 0.9,
              });
            } catch {
              file = originalFile;
            }
          }

          const error = validateFile(file);
          if (error) {
            toast.error(error);
            continue;
          }

          if (runningTotal + file.size > TOTAL_LIMIT_MB * 1024 * 1024) {
            toast.error(`Total upload limit is ${TOTAL_LIMIT_MB} MB.`);
            break;
          }

          runningTotal += file.size;
          const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
          newFiles.push({
            file,
            preview,
            uploading: false,
            uploaded: false,
            optimized: file.size < originalFile.size || file.name !== originalFile.name || file.type !== originalFile.type,
            originalSize: originalFile.size,
          });
        }
      } finally {
        setPreparing(false);
      }

      if (newFiles.length > 0) {
        setFiles((prev) => [...prev, ...newFiles]);
      }
    };

    const removeFile = (idx: number) => {
      setFiles((prev) => {
        const updated = [...prev];
        if (updated[idx]?.preview) URL.revokeObjectURL(updated[idx].preview as string);
        updated.splice(idx, 1);
        return updated;
      });
    };

    const uploadAll = async (): Promise<string[]> => {
      if (files.length === 0) return [];

      setUploading(true);
      const uploadedPaths: string[] = [];

      for (let i = 0; i < files.length; i += 1) {
        if (files[i].uploaded && files[i].path) {
          uploadedPaths.push(files[i].path as string);
          continue;
        }

        setFiles((prev) => prev.map((item, idx) => (idx === i ? { ...item, uploading: true } : item)));

        const ext = files[i].file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${claimId}/${Date.now()}-${i}.${ext}`;

        const { error } = await supabase.storage.from('claim-attachments').upload(path, files[i].file, {
          contentType: files[i].file.type,
        });

        if (error) {
          toast.error(`Failed to upload ${files[i].file.name}.`);
          setFiles((prev) => prev.map((item, idx) => (idx === i ? { ...item, uploading: false } : item)));
        } else {
          uploadedPaths.push(path);
          setFiles((prev) => prev.map((item, idx) => (
            idx === i ? { ...item, uploading: false, uploaded: true, path } : item
          )));
        }
      }

      setUploading(false);
      if (onFilesUploaded) onFilesUploaded(uploadedPaths);
      return uploadedPaths;
    };

    useImperativeHandle(ref, () => ({
      uploadAll,
      getFileCount: () => files.length,
    }));

    useEffect(() => {
      onFileCountChange?.(files.length);
    }, [files.length, onFileCountChange]);

    useEffect(() => {
      onBusyChange?.(preparing || uploading);
    }, [onBusyChange, preparing, uploading]);

    return (
      <div className="space-y-3">
        <div
          className={`rounded-[22px] border border-dashed p-4 transition-all sm:p-5 ${
            dragActive ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/80 bg-card/70'
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDragActive(false);
            void handleFiles(event.dataTransfer.files);
          }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Upload className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">Drop files here or choose from your device</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Upload receipts and supporting bills in PDF or image format. Large images are optimized on your device before upload.
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-muted px-3 py-1">PDF / Camera / Gallery</span>
                  <span className="rounded-full bg-muted px-3 py-1">Up to {maxSizeMB} MB each</span>
                  <span className="rounded-full bg-muted px-3 py-1">Up to {maxFiles} files</span>
                  <span className="rounded-full bg-muted px-3 py-1">Total {TOTAL_LIMIT_MB} MB</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus className="mr-2 h-4 w-4" />
                Choose files
              </Button>
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => cameraInputRef.current?.click()}>
                <Camera className="mr-2 h-4 w-4" />
                Use camera
              </Button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXT}
            multiple
            className="hidden"
            onChange={(event) => {
              void handleFiles(event.target.files, 'files');
              event.target.value = '';
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              void handleFiles(event.target.files, 'camera');
              event.target.value = '';
            }}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="soft-panel px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Files selected</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{files.length}</p>
          </div>
          <div className="soft-panel px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Uploaded</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{files.filter((file) => file.uploaded).length}</p>
          </div>
          <div className="soft-panel px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Current size</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{formatFileSize(totalSize || 0)}</p>
          </div>
        </div>

        {files.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {files.map((item, idx) => (
              <div key={`${item.file.name}-${idx}`} className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/90">
                <div className="relative h-32 bg-muted/40">
                  {item.preview ? (
                    <img src={item.preview} alt={item.file.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card text-muted-foreground shadow-sm">
                        <FileText className="h-8 w-8" />
                      </div>
                    </div>
                  )}

                  {item.uploading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : null}

                  {item.uploaded ? (
                    <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-success/90 px-2.5 py-1 text-xs font-semibold text-success-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Uploaded
                    </div>
                  ) : (
                    <div className="absolute left-3 top-3 rounded-full bg-card/90 px-2.5 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
                      Ready
                    </div>
                  )}

                  {!item.uploading ? (
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-card/95 text-muted-foreground shadow-sm transition-colors hover:text-destructive"
                      aria-label={`Remove ${item.file.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <div className="space-y-2 p-4">
                  <p className="truncate text-sm font-semibold text-foreground">{item.file.name}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.file.type === 'application/pdf' ? 'PDF document' : 'Image file'}</span>
                    <span>{formatFileSize(item.file.size)}</span>
                  </div>
                  {item.optimized && item.originalSize && item.originalSize > item.file.size ? (
                    <p className="text-xs font-medium text-success">Optimized from {formatFileSize(item.originalSize)}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-border/80 bg-muted/15 px-6 py-10 text-center">
            <p className="text-sm font-semibold text-foreground">No files selected yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add receipts now, or continue and upload them before you submit the claim.
            </p>
          </div>
        )}

        {files.length > 0 && !files.every((file) => file.uploaded) ? (
          <Button type="button" variant="outline" className="rounded-xl" onClick={uploadAll} disabled={uploading}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload {files.filter((file) => !file.uploaded).length} file(s)
          </Button>
        ) : null}
      </div>
    );
  },
);

FileUpload.displayName = 'FileUpload';

export default FileUpload;
