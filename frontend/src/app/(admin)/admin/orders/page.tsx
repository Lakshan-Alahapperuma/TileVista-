'use client';

import React from 'react';
import { OrderManagement } from '../../../../features/admin';

export default function AdminOrdersPage() {
  return (
    <div className="font-sans space-y-6">
      <div>
        <span className="text-[9px] font-bold tracking-widest text-[#D4C5B9] uppercase">Store Console</span>
        <h1 className="text-3xl font-semibold tracking-tight text-[#1A1A1A] mt-1.5">Order Management</h1>
        <p className="text-xs text-gray-500 font-light mt-1">Manage customer orders, stock approval thresholds, inventory reservations, showroom pickup, and order lifecycles.</p>
      </div>
      <OrderManagement />
    </div>
  );
}
