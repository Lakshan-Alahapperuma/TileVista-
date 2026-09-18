'use client';

import React, { Suspense } from 'react';
import AuthFeature from '../../../features/auth';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-gray-400">Loading authentication portal...</div>}>
      <AuthFeature />
    </Suspense>
  );
}
