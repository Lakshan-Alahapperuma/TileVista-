'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Box, 
  Trash2, 
  Calendar, 
  HardDrive, 
  Loader2, 
  CheckCircle, 
  AlertTriangle,
  FileVideo,
  ExternalLink
} from 'lucide-react';
import AdminGuard from '../../features/auth/AdminGuard';
import VideoUploadForm from '../../components/model-generator/VideoUploadForm';
import RecordingInstructions from '../../components/model-generator/RecordingInstructions';
import { 
  createModelProject, 
  findUserProjects, 
  removeProject 
} from '../../services/model-generator.service';

export default function ModelGeneratorDashboard() {
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const data = await findUserProjects();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve projects');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleUploadSubmit = async (data: { name: string; description: string; video: File }) => {
    setIsUploading(true);
    try {
      await createModelProject(data);
      await fetchProjects();
    } catch (err) {
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this 3D model project? All processed mesh files will be permanently removed.')) {
      return;
    }

    try {
      await removeProject(id);
      setProjects(projects.filter(p => p.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <CheckCircle className="w-3 h-3" /> Ready
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 border border-red-500/20 text-red-400">
            <AlertTriangle className="w-3 h-3" /> Failed
          </span>
        );
      case 'UPLOADED':
      case 'QUEUED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 border border-slate-700 text-slate-400">
            Queued
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" /> Processing
          </span>
        );
    }
  };

  return (
    <AdminGuard>
      <div className="min-h-screen bg-[#090d16] text-[#f8fafc] p-6 md:p-12 font-sans selection:bg-[#4f46e5] selection:text-white">
        
        {/* Top Navbar */}
        <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10 border-b border-slate-850 pb-6">
          <div className="flex items-center gap-4">
            <Link 
              href="/admin/dashboard" 
              className="w-10 h-10 rounded-full border border-slate-800 bg-slate-900/60 hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Box className="w-6 h-6 text-indigo-400" />
                <h1 className="text-2xl font-extrabold tracking-tight font-outfit">3D Object Generator</h1>
              </div>
              <p className="text-xs text-slate-400 mt-1">Showroom OS Administrator tool for converting product videos into 3D assets.</p>
            </div>
          </div>
          <Link 
            href="/admin/dashboard"
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 border border-indigo-500/20 hover:border-indigo-500/50 bg-indigo-500/5 px-4 py-2 rounded-xl transition-all"
          >
            Showroom Control Panel
            <ExternalLink className="w-3 h-3" />
          </Link>
        </header>

        <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left panel - uploading */}
          <div className="lg:col-span-1 space-y-6">
            <VideoUploadForm onSubmit={handleUploadSubmit} isLoading={isUploading} />
            <RecordingInstructions />
          </div>

          {/* Right panel - projects list */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 backdrop-blur-md p-6 rounded-2xl shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold text-white font-outfit">Your Reconstruction Projects</h3>
                  <p className="text-xs text-slate-400 mt-1">Monitor active generation processes or preview compiled models.</p>
                </div>
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  <span className="text-xs text-slate-400 font-semibold font-outfit">Loading scanning history...</span>
                </div>
              ) : error ? (
                <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              ) : projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-850 rounded-2xl p-6 bg-slate-950/20">
                  <Box className="w-12 h-12 text-slate-700 mb-3" />
                  <span className="text-sm font-semibold text-slate-400">No projects found</span>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">Upload a showroom video on the left panel to trigger your first 3D model conversion.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projects.map((project) => (
                    <Link 
                      href={`/model-generator/${project.id}`}
                      key={project.id}
                      className="group flex flex-col justify-between p-5 rounded-2xl bg-slate-950/40 border border-slate-850 hover:border-slate-750 hover:bg-slate-950/60 transition-all duration-300 relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-2xl group-hover:bg-indigo-500/10 transition-colors pointer-events-none" />
                      
                      <div className="space-y-3 z-10">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-bold text-white text-md font-outfit group-hover:text-indigo-400 transition-colors truncate max-w-[70%]">
                            {project.name}
                          </h4>
                          {getStatusBadge(project.status)}
                        </div>
                        {project.description && (
                          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {project.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-850 mt-5 pt-3 text-[10px] text-slate-500 font-semibold font-sans z-10">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                        </div>
                        {project.fileSize && (
                          <div className="flex items-center gap-1.5">
                            <HardDrive className="w-3.5 h-3.5" />
                            <span>{(Number(project.fileSize) / (1024 * 1024)).toFixed(1)} MB</span>
                          </div>
                        )}
                        <button
                          onClick={(e) => handleDeleteProject(project.id, e)}
                          className="p-1 text-slate-500 hover:text-red-400 transition-colors rounded hover:bg-red-500/10"
                          title="Delete Project"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </AdminGuard>
  );
}
