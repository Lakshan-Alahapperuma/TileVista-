'use client';

import React from 'react';
import { 
  Video, 
  Cpu, 
  Layers, 
  CheckCircle, 
  AlertOctagon, 
  Loader2,
  Clock
} from 'lucide-react';
import { ModelGenerationStatus } from '@tilevista/types';

interface ModelGenerationProgressProps {
  status: ModelGenerationStatus;
  progress: number;
  currentStep?: string;
  errorMessage?: string;
}

export default function ModelGenerationProgress({
  status,
  progress,
  currentStep,
  errorMessage,
}: ModelGenerationProgressProps) {

  const getStepStatus = (stepIndex: number) => {
    // Current mapping:
    // Step 0: Uploaded / Queued
    // Step 1: Extracting Frames (progress 10)
    // Step 2: Reconstruction (progress 25-75)
    // Step 3: GLB Optimization & Export (progress 80-99)
    // Step 4: Complete (progress 100)

    const mapStatusToStep = (): number => {
      switch (status) {
        case 'UPLOADED':
        case 'QUEUED':
          return 0;
        case 'EXTRACTING_FRAMES':
          return 1;
        case 'RECONSTRUCTING':
        case 'GENERATING_MESH':
        case 'TEXTURING':
          return 2;
        case 'EXPORTING_GLB':
          return 3;
        case 'COMPLETED':
          return 4;
        default:
          return -1;
      }
    };

    const currentActiveStep = mapStatusToStep();

    if (status === 'FAILED') {
      return 'failed';
    }
    if (currentActiveStep === stepIndex) {
      return 'active';
    }
    if (currentActiveStep > stepIndex) {
      return 'completed';
    }
    return 'pending';
  };

  const steps = [
    { label: 'Upload & Queue', icon: Clock, desc: 'File verified and queued' },
    { label: 'Frame Extraction', icon: Video, desc: 'FFmpeg splitting frames' },
    { label: '3D Photogrammetry', icon: Cpu, desc: 'Point-matching algorithms' },
    { label: 'Mesh & Texture', icon: Layers, desc: 'Blender model optimization' },
    { label: 'Export Complete', icon: CheckCircle, desc: 'GLB compiled successfully' },
  ];

  return (
    <div className="bg-slate-900/60 border border-slate-800 backdrop-blur-md p-6 rounded-2xl shadow-xl space-y-6">
      <div>
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-white font-outfit">Processing Status</h3>
            <p className="text-xs text-slate-400 mt-1">{currentStep || 'Initializing pipeline...'}</p>
          </div>
          {status !== 'COMPLETED' && status !== 'FAILED' && status !== 'CANCELLED' && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-semibold animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Active
            </div>
          )}
          {status === 'COMPLETED' && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-semibold">
              <CheckCircle className="w-3.5 h-3.5" />
              Ready
            </div>
          )}
          {status === 'FAILED' && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-xs font-semibold">
              <AlertOctagon className="w-3.5 h-3.5" />
              Failed
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between items-center text-xs text-slate-400 font-semibold mb-2">
            <span>Overall Progress</span>
            <span className="text-white font-bold">{progress}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div 
              className={`h-full transition-all duration-550 rounded-full ${
                status === 'FAILED' 
                  ? 'bg-red-500' 
                  : status === 'COMPLETED'
                    ? 'bg-emerald-500'
                    : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-pulse'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Workflow Step Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-4 border-t border-slate-850">
        {steps.map((step, idx) => {
          const state = getStepStatus(idx);
          const Icon = step.icon;
          
          return (
            <div 
              key={idx} 
              className={`flex md:flex-col gap-3 md:gap-0 p-3 rounded-xl border transition-all duration-300 ${
                state === 'active'
                  ? 'bg-indigo-500/5 border-indigo-500/40 text-indigo-400'
                  : state === 'completed'
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                    : state === 'failed'
                      ? 'bg-red-500/5 border-red-500/20 text-red-400'
                      : 'bg-slate-950/20 border-slate-850/50 text-slate-500'
              }`}
            >
              <div className="flex md:justify-start items-center mb-1">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                  state === 'active'
                    ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-400'
                    : state === 'completed'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : state === 'failed'
                        ? 'bg-red-500/10 border-red-500/20 text-red-400'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}>
                  {state === 'active' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
              </div>
              <div className="flex flex-col md:mt-2">
                <span className="text-xs font-bold font-outfit uppercase tracking-wider">{step.label}</span>
                <span className="text-[10px] text-slate-400 mt-0.5">{step.desc}</span>
              </div>
            </div>
          );
        })}
      </div>

      {status === 'FAILED' && errorMessage && (
        <div className="flex gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-400 leading-normal">
          <AlertOctagon className="w-4.5 h-4.5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Reconstruction Pipeline Failed: </span>
            <p className="mt-1 text-slate-300">{errorMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}
