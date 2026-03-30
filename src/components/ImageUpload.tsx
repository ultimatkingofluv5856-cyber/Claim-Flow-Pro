import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Upload, Loader2, X, Image as ImageIcon } from 'lucide-react';
import { optimizeImageUpload } from '@/lib/image-optimization';
import { toast } from 'sonner';

interface ImageUploadProps {
  bucket: string;
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  folder?: string;
  variant?: 'avatar' | 'logo';
  fallbackText?: string;
}

export default function ImageUpload({ bucket, currentUrl, onUploaded, folder = '', variant = 'avatar', fallbackText = '?' }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    setUploading(true);
    try {
      let uploadFile = file;

      try {
        uploadFile = await optimizeImageUpload(file, {
          maxDimension: variant === 'logo' ? 1800 : 1400,
          quality: 0.9,
        });
      } catch {
        uploadFile = file;
      }

      if (uploadFile.size > 5 * 1024 * 1024) {
        toast.error('Image must be under 5MB');
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
        return;
      }

      const ext = uploadFile.name.split('.').pop();
      const path = folder ? `${folder}/${Date.now()}.${ext}` : `${Date.now()}.${ext}`;

      const { error } = await supabase.storage.from(bucket).upload(path, uploadFile, { upsert: true });
      if (error) throw error;

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      setPreview(publicUrl);
      onUploaded(publicUrl);
      toast.success('Image uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = () => {
    setPreview(null);
    onUploaded('');
  };

  if (variant === 'logo') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
            {preview ? (
              <img src={preview} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                Upload Logo
              </Button>
              {preview && (
                <Button type="button" variant="ghost" size="sm" onClick={handleRemove}>
                  <X className="h-4 w-4 mr-1" /> Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
          </div>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <Avatar className="h-20 w-20 cursor-pointer border-2 border-border" onClick={() => inputRef.current?.click()}>
        {preview ? (
          <AvatarImage src={preview} alt="Profile" />
        ) : (
          <AvatarFallback className="text-lg bg-primary/10 text-primary">{fallbackText}</AvatarFallback>
        )}
      </Avatar>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
          {preview ? 'Change' : 'Upload'}
        </Button>
        {preview && (
          <Button type="button" variant="ghost" size="sm" onClick={handleRemove}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
    </div>
  );
}
