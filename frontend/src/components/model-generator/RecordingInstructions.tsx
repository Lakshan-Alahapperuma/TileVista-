'use client';

import React from 'react';
import { Camera, Sun, RefreshCw, AlertTriangle } from 'lucide-react';

export default function RecordingInstructions() {
  const rules = [
    {
      title: '360° Closed Circle',
      desc: 'Walk around the object in a complete loop, capturing it from all sides.',
      icon: RefreshCw,
    },
    {
      title: 'Consistent Bright Light',
      desc: 'Avoid shadows or changing light sources. Direct, ambient lighting is best.',
      icon: Sun,
    },
    {
      title: 'Slow, Stable Movement',
      desc: 'Move the camera slowly to avoid motion blur. Keep focus on the details.',
      icon: Camera,
    },
    {
      title: 'Avoid Reflections',
      desc: 'Highly glossy or mirror surfaces can distort the points matching pipeline.',
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="bg-slate-900/60 border border-slate-800 backdrop-blur-md p-6 rounded-2xl shadow-xl space-y-4">
      <div>
        <h3 className="text-md font-bold text-white font-outfit uppercase tracking-wider">Object Scanning Instructions</h3>
        <p className="text-xs text-slate-400 mt-1">Follow these best practices to ensure high fidelity 3D mesh outputs.</p>
      </div>

      <div className="space-y-4">
        {rules.map((rule, idx) => {
          const Icon = rule.icon;
          return (
            <div key={idx} className="flex gap-4 p-3 rounded-xl bg-slate-950/40 border border-slate-850 hover:border-slate-800 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-200">{rule.title}</span>
                <span className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{rule.desc}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
