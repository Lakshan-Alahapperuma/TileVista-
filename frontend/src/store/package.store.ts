import { create } from 'zustand';
import { Package } from '../types/package';

interface PackageState {
  packages: Package[];
  selectedPackage: Package | null;
  isLoading: boolean;
  error: string | null;
  setPackages: (pkgs: Package[]) => void;
  setSelectedPackage: (pkg: Package | null) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (err: string | null) => void;
}

export const usePackageStore = create<PackageState>((set) => ({
  packages: [],
  selectedPackage: null,
  isLoading: false,
  error: null,
  setPackages: (pkgs) => set({ packages: pkgs }),
  setSelectedPackage: (pkg) => set({ selectedPackage: pkg }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (err) => set({ error: err }),
}));
