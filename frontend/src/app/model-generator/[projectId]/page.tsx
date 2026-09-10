'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { 
  ArrowLeft, 
  Trash2, 
  Download, 
  Box, 
  Calendar, 
  HardDrive,
  RefreshCw,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import AdminGuard from '../../../features/auth/AdminGuard';
import GlbModelViewer from '../../../components/canvas/GlbModelViewer';
import ModelGenerationProgress from '../../../components/model-generator/ModelGenerationProgress';
import { 
  findProject, 
  getModelProjectStatus, 
  removeProject 
} from '../../../services/model-generator.service';

export default function ProjectDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  
  const [project, setProject] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProjectDetails = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const data = await findProject(projectId);
      setProject(data);
      
      // Stop polling if completed or failed
      if (data.status === 'COMPLETED' || data.status === 'FAILED' || data.status === 'CANCELLED') {
        clearPolling();
      } else if (!pollIntervalRef.current) {
        // Start polling if not already started
        startPolling();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve project details');
      clearPolling();
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const startPolling = () => {
    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusData = await getModelProjectStatus(projectId);
        setProject((prev: any) => {
          if (!prev) return null;
          
          // If status changes or progress updates
          if (prev.status !== statusData.status || prev.progress !== statusData.progress || prev.currentStep !== statusData.currentStep) {
            // If completed, fetch full project to get the newly created modelUrl
            if (statusData.status === 'COMPLETED') {
              fetchProjectDetails(false);
            }
            return {
              ...prev,
              status: statusData.status,
              progress: statusData.progress,
              currentStep: statusData.currentStep,
              outputGlbPath: statusData.outputGlbPath,
              errorMessage: statusData.errorMessage,
              modelUrl: statusData.modelUrl,
            };
          }
          return prev;
        });

        if (statusData.status === 'COMPLETED' || statusData.status === 'FAILED' || statusData.status === 'CANCELLED') {
          clearPolling();
        }
      } catch (err) {
        console.error('Error polling status', err);
      }
    }, 2000); // Poll status every 2 seconds
  };

  const clearPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  useEffect(() => {
    fetchProjectDetails();
    return () => clearPolling();
  }, [projectId]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to permanently delete this project? All associated GLB models and folders will be destroyed.')) {
      return;
    }

    try {
      await removeProject(projectId);
      router.push('/model-generator');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  const handleDownload = () => {
    if (!project || !project.modelUrl) return;
    
    // Determine the full backend url to download GLB directly
    const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:4000';
    const downloadUrl = `${backendUrl}${project.modelUrl}`;
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${project.name.replace(/\s+/g, '_')}.glb`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isActiveProcessing = project && project.status !== 'COMPLETED' && project.status !== 'FAILED' && project.status !== 'CANCELLED';

  return (
    <AdminGuard>
      <div className="min-h-screen bg-[#090d16] text-[#f8fafc] p-6 md:p-12 font-sans selection:bg-[#4f46e5] selection:text-white">
        
        {/* Header */}
        <header className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-slate-850 pb-6">
          <div className="flex items-center gap-4">
            <Link 
              href="/model-generator" 
              className="w-10 h-10 rounded-full border border-slate-800 bg-slate-900/60 hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Box className="w-6 h-6 text-indigo-400 animate-pulse" />
                <h1 className="text-2xl font-extrabold tracking-tight font-outfit">{project?.name || 'Project Details'}</h1>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {project?.description ? project.description : 'Reconstruction project profile and viewport.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchProjectDetails(true)}
              className="p-2.5 rounded-xl border border-slate-850 hover:border-slate-750 bg-slate-950/20 text-slate-400 hover:text-white transition-all"
              title="Refresh project details"
            >
              <RefreshCw className="w-4.5 h-4.5" />
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 text-xs font-bold text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/50 bg-red-500/5 px-4 py-2.5 rounded-xl transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Remove Project
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="max-w-6xl mx-auto flex flex-col items-center justify-center py-40 gap-3">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            <span className="text-sm font-semibold text-slate-400 font-outfit">Retrieving 3D project configuration...</span>
          </div>
        ) : error ? (
          <div className="max-w-6xl mx-auto p-6 rounded-2xl border border-red-500/20 bg-red-500/5 text-sm text-red-400 flex flex-col items-center text-center gap-3">
            <AlertTriangle className="w-12 h-12" />
            <div>
              <h3 className="font-bold text-lg text-white">Project Connection Error</h3>
              <p className="text-xs text-slate-400 mt-1">{error}</p>
            </div>
            <Link 
              href="/model-generator" 
              className="mt-4 px-6 py-2.5 bg-slate-800 hover:bg-slate-750 rounded-xl text-xs font-bold transition-all text-white"
            >
              Return to Dashboard
            </Link>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left sidebar info details */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-4">
                <h3 className="text-md font-bold text-white font-outfit uppercase tracking-wider">Project Information</h3>
                
                <div className="space-y-3 divide-y divide-slate-850">
                  <div className="flex justify-between items-center py-2 text-xs">
                    <span className="text-slate-400 font-semibold">Input Type</span>
                    <span className="text-white font-bold uppercase">{project.inputType}</span>
                  </div>
                  <div className="flex justify-between items-center py-3.5 text-xs">
                    <span className="text-slate-400 font-semibold">Project ID</span>
                    <span className="text-slate-300 font-mono text-[10px] bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                      {project.id}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3.5 text-xs">
                    <span className="text-slate-400 font-semibold">Created On</span>
                    <span className="text-white font-bold flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {project.fileSize && (
                    <div className="flex justify-between items-center py-3.5 text-xs">
                      <span className="text-slate-400 font-semibold">Source Size</span>
                      <span className="text-white font-bold flex items-center gap-1">
                        <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                        {(Number(project.fileSize) / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                  )}
                </div>

                {project.status === 'COMPLETED' && project.modelUrl && (
                  <button
                    onClick={handleDownload}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-650 to-indigo-500 hover:from-indigo-600 hover:to-indigo-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 transition-all mt-4"
                  >
                    <Download className="w-4 h-4" />
                    Download GLB Model
                  </button>
                )}
              </div>
            </div>

            {/* Right main workspace details */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Show progress tracker if active processing or if failed */}
              {(isActiveProcessing || project.status === 'FAILED') && (
                <ModelGenerationProgress 
                  status={project.status}
                  progress={project.progress}
                  currentStep={project.currentStep}
                  errorMessage={project.errorMessage}
                />
              )}

              {/* Show 3D preview viewport if completed */}
              {project.status === 'COMPLETED' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-md font-bold text-white font-outfit uppercase tracking-wider">3D Mesh Viewport</h3>
                      <p className="text-xs text-slate-400 mt-1">Interact with your fully textured 3D asset using drag/scroll controls.</p>
                    </div>
                  </div>

                  {project.modelUrl ? (
                    <GlbModelViewer modelUrl={
                      // Construct full url prefix
                      `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:4000'}${project.modelUrl}`
                    } />
                  ) : (
                    <div className="h-[400px] w-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/20 text-slate-400">
                      <AlertTriangle className="w-12 h-12 text-amber-500 mb-2 animate-bounce" />
                      <span className="text-sm font-semibold">GLB output reference is missing.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
