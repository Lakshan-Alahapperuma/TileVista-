'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Video, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Box, 
  Sparkles, 
  RefreshCw 
} from 'lucide-react';
import { createModelProject, getModelProjectStatus } from '../../services/model-generator.service';
import ModelGenerationProgress from './ModelGenerationProgress';

interface Item3DGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    itemId: number;
    name: string;
    sku: string;
    category?: string;
    price?: number;
  };
  onSuccess: () => void;
}

export default function Item3DGeneratorModal({
  isOpen,
  onClose,
  item,
  onSuccess,
}: Item3DGeneratorModalProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectStatus, setProjectStatus] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setVideoFile(null);
      setError(null);
      setProjectId(null);
      setProjectStatus(null);
      setIsProcessing(false);
      setIsSubmitting(false);
    }
  }, [isOpen, item.itemId]);

  // Polling project status when processing
  useEffect(() => {
    if (!projectId || !isProcessing) return;

    const interval = setInterval(async () => {
      try {
        const data = await getModelProjectStatus(projectId);
        setProjectStatus(data);

        if (data.status === 'COMPLETED') {
          setIsProcessing(false);
          onSuccess();
        } else if (data.status === 'FAILED') {
          setIsProcessing(false);
          setError(data.errorMessage || '3D Model generation failed.');
        }
      } catch (err: any) {
        console.error('Error checking model status:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [projectId, isProcessing, onSuccess]);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
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
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setError(null);
    const supportedTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
    
    if (!supportedTypes.includes(file.type)) {
      setError('Unsupported file type. Please upload an MP4, MOV, or WebM video.');
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      setError('File size exceeds 500MB limit.');
      return;
    }

    setVideoFile(file);
  };

  const handleStartGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) {
      setError('Please select an object scan video to proceed.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createModelProject({
        name: `${item.name} 3D Scan`,
        description: `Item ID ${item.itemId} (${item.sku})`,
        video: videoFile,
        itemId: item.itemId,
      });

      setProjectId(result.id);
      setIsProcessing(true);
      setProjectStatus({
        status: 'QUEUED',
        progress: 0,
        currentStep: 'Uploaded video and initialized 3D model queue...',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to initialize 3D model creation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#121212] border border-gray-800 text-white w-full max-w-2xl p-6 sm:p-8 rounded-2xl shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-start pb-5 border-b border-gray-800">
          <div>
            <div className="flex items-center gap-2 text-[#D4C5B9]">
              <Sparkles size={16} />
              <span className="text-[10px] font-bold tracking-widest uppercase font-mono">3D Object Generator & Auto-Linker</span>
            </div>
            <h3 className="text-xl font-bold tracking-tight text-[#f8fafc] mt-1">{item.name}</h3>
            <p className="text-xs text-gray-400 font-mono mt-0.5">SKU: {item.sku} • Item #{item.itemId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        <div className="mt-6 space-y-6">
          
          {/* If NOT processing yet: Show Upload Form */}
          {!projectId && (
            <form onSubmit={handleStartGeneration} className="space-y-5">
              <div className="bg-[#1A1A1A] p-4 rounded-xl border border-gray-800 text-xs text-gray-300 space-y-1">
                <p className="font-semibold text-[#D4C5B9]">Instructions for 3D Video Reconstruction:</p>
                <ul className="list-disc list-inside space-y-0.5 text-gray-400 text-[11px]">
                  <li>Slowly walk 360° around the product at a steady pace.</li>
                  <li>Keep the object stationary; move the camera around it at several heights.</li>
                  <li>Use diffuse lighting and a textured background. Chrome, mirrors, glass and plain glossy ceramics are difficult to reconstruct.</li>
                  <li>Record 10–180 seconds. Reconstruction is approximate; inspect the result and verify dimensions before using it.</li>
                  <li>Supported formats: <strong>MP4, MOV, WebM</strong> (Up to 500MB).</li>
                </ul>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
                  Upload Product Scan Video
                </label>
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all ${
                    isDragActive
                      ? 'border-[#D4C5B9] bg-[#D4C5B9]/10'
                      : videoFile
                        ? 'border-emerald-500/50 bg-emerald-500/10'
                        : 'border-gray-800 hover:border-gray-600 bg-[#1A1A1A]'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    accept="video/mp4,video/quicktime,video/webm"
                    className="hidden"
                  />

                  {videoFile ? (
                    <div className="flex flex-col items-center text-center space-y-2">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <Video size={24} />
                      </div>
                      <span className="text-sm font-semibold text-white truncate max-w-xs">{videoFile.name}</span>
                      <span className="text-xs text-gray-400">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Video Loaded</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center space-y-2">
                      <div className="w-12 h-12 rounded-full bg-gray-800 text-gray-400 flex items-center justify-center">
                        <Upload size={22} />
                      </div>
                      <span className="text-sm font-semibold text-white">Drag & drop product scan video here</span>
                      <span className="text-xs text-gray-400">or click to browse from device</span>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-xs flex items-center gap-2">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 text-xs font-semibold uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !videoFile}
                  className="px-6 py-2.5 rounded-lg bg-[#D4C5B9] text-[#1A1A1A] hover:bg-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Uploading Video...</span>
                    </>
                  ) : (
                    <>
                      <Box size={14} />
                      <span>Generate 3D Object</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* If Processing or Completed: Show Live Progress */}
          {projectId && projectStatus && (
            <div className="space-y-6">
              <ModelGenerationProgress
                status={projectStatus.status}
                progress={projectStatus.progress ?? 0}
                currentStep={projectStatus.currentStep}
                errorMessage={projectStatus.errorMessage}
              />

              {projectStatus.status === 'COMPLETED' && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-white">3D Model Ready & Linked!</h4>
                      <p className="text-xs text-gray-300 mt-0.5">
                        The reconstructed 3D model was automatically attached to <strong>{item.name}</strong>.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="px-5 py-2 bg-emerald-500 text-black hover:bg-emerald-400 font-bold text-xs uppercase tracking-wider rounded-lg shrink-0 transition-colors"
                  >
                    Done & View Item
                  </button>
                </div>
              )}

              {projectStatus.status === 'FAILED' && (
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                  <button
                    onClick={() => {
                      setProjectId(null);
                      setProjectStatus(null);
                    }}
                    className="px-5 py-2 bg-gray-800 text-white hover:bg-gray-700 font-bold text-xs uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw size={13} />
                    <span>Try Again</span>
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
