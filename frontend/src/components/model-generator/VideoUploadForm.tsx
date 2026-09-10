'use client';

import React, { useState, useRef } from 'react';
import { Upload, Video, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '../Button';

interface VideoUploadFormProps {
  onSubmit: (data: { name: string; description: string; video: File }) => Promise<void>;
  isLoading: boolean;
}

export default function VideoUploadForm({ onSubmit, isLoading }: VideoUploadFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setError(null);
    const supportedTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
    
    if (!supportedTypes.includes(file.type)) {
      setError('Unsupported file type. Please upload MP4, MOV, or WebM.');
      return;
    }
    
    if (file.size > 500 * 1024 * 1024) {
      setError('File size too large. Maximum size allowed is 500MB.');
      return;
    }

    setVideoFile(file);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a name for the 3D model project.');
      return;
    }
    if (!videoFile) {
      setError('Please upload a scanning video.');
      return;
    }

    setError(null);
    try {
      await onSubmit({ name, description, video: videoFile });
      // Reset form
      setName('');
      setDescription('');
      setVideoFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong during submission.');
    }
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6 bg-slate-900/60 border border-slate-800 backdrop-blur-md p-6 rounded-2xl shadow-xl">
      <div>
        <h3 className="text-lg font-bold text-white font-outfit">Create 3D Model Reconstruction</h3>
        <p className="text-xs text-slate-400 mt-1">Upload a video of the product to convert it into a textured 3D GLB mesh.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Object Name</label>
          <input
            type="text"
            placeholder="e.g., Ceramic Shower Faucet Model A"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-sans"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Description (Optional)</label>
          <textarea
            placeholder="Provide context about the asset (e.g., dimensions, showroom position)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isLoading}
            rows={3}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-sans resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 font-outfit">Scan Video File</label>
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`w-full flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-all duration-350 ${
              isDragActive 
                ? 'border-indigo-500 bg-indigo-500/10' 
                : videoFile 
                  ? 'border-emerald-500/50 bg-emerald-500/5' 
                  : 'border-slate-850 hover:border-indigo-500/50 hover:bg-slate-950/50 bg-slate-950/20'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleChange}
              disabled={isLoading}
              accept="video/mp4,video/quicktime,video/webm"
              className="hidden"
            />

            {videoFile ? (
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-3">
                  <Video className="w-6 h-6 text-emerald-400" />
                </div>
                <span className="text-sm font-semibold text-white truncate max-w-xs">{videoFile.name}</span>
                <span className="text-xs text-slate-400 mt-1">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                <span className="text-[10px] text-emerald-400 font-bold uppercase mt-2 tracking-wider">Ready to upload</span>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-slate-800/40 border border-slate-800 flex items-center justify-center mb-3 text-slate-400 hover:text-indigo-400 transition-colors">
                  <Upload className="w-6 h-6" />
                </div>
                <span className="text-sm font-semibold text-white">Drag & drop your object scan video</span>
                <span className="text-xs text-slate-400 mt-1">Supports MP4, MOV, WebM (Max 500MB)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-400 font-sans">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button
        type="submit"
        disabled={isLoading || !name || !videoFile}
        variant="primary"
        className="w-full flex items-center justify-center gap-2 py-3.5 hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Uploading & Starting Reconstruction...
          </>
        ) : (
          <>
            <Video className="w-4 h-4" />
            Generate 3D Model
          </>
        )}
      </Button>
    </form>
  );
}
