import { create } from 'zustand';
import { DesignState, PlacedItem, WallOpening, RoomShape } from '../types/designer';

export interface DoorSizeModalState {
  isOpen: boolean;
  target: 'placement' | 'existing';
  openingType?: 'door' | 'window';
  doorStyle?: string;
  doorName?: string;
  openingId?: string;
  currentWidth: number;
  currentHeight: number;
}

interface DesignerStoreState {
  state: DesignState;
  topView: boolean;
  activeSideView: number | null;
  zoomTrigger: 'in' | 'out' | null;
  numWalls: number;

  wizardStep: number;
  fadeState: 'in' | 'out';
  selectedRoomType: 'room' | 'bathroom';
  subRoomType: 'dining_room' | 'bed_room' | 'living_room';
  showRoomTypeModal: boolean;
  projectName: string;
  selectedShape: RoomShape;
  dimensionsUnit: 'cm' | 'm';
  widthInput: string;
  lengthInput: string;
  heightInput: string;
  projectId: string | null;
  validationErrors: { width?: string; length?: string; height?: string };
  isSubmitting: boolean;
  previewZoomTrigger: 'in' | 'out' | null;
  activePlacement: { type: 'door' | 'window'; style: string; name: string; width: number; height: number; sillHeight: number } | null;
  wizardWallOpenings: WallOpening[];

  placedItems: PlacedItem[];
  selectedItemId: string | null;
  selectedItemColor: string;
  isPlacingItem: PlacedItem | null;
  activeCategory: string | null;
  selectedWallIdx: number | null;
  showRoomCustomizer: boolean;
  showSummaryModal: boolean;
  orbitEnabled: boolean;
  undoStack: PlacedItem[][];
  redoStack: PlacedItem[][];
  alertMessage: string | null;
  doorSizeModal: DoorSizeModalState | null;
}

interface DesignerStoreActions {
  setState: (state: Partial<DesignState> | ((prev: DesignState) => DesignState)) => void;
  setTopView: (val: boolean) => void;
  setActiveSideView: (val: number | null) => void;
  setZoomTrigger: (val: 'in' | 'out' | null) => void;
  setNumWalls: (val: number) => void;

  setWizardStep: (step: number) => void;
  setFadeState: (state: 'in' | 'out') => void;
  setSelectedRoomType: (type: 'room' | 'bathroom') => void;
  setSubRoomType: (type: 'dining_room' | 'bed_room' | 'living_room') => void;
  setShowRoomTypeModal: (val: boolean) => void;
  setProjectName: (name: string) => void;
  setSelectedShape: (shape: RoomShape) => void;
  setDimensionsUnit: (unit: 'cm' | 'm') => void;
  setWidthInput: (val: string) => void;
  setLengthInput: (val: string) => void;
  setHeightInput: (val: string) => void;
  setProjectId: (id: string | null) => void;
  setValidationErrors: (errs: { width?: string; length?: string; height?: string }) => void;
  setIsSubmitting: (val: boolean) => void;
  setPreviewZoomTrigger: (val: 'in' | 'out' | null) => void;
  setActivePlacement: (placement: any) => void;
  setWizardWallOpenings: (val: WallOpening[] | ((prev: WallOpening[]) => WallOpening[])) => void;

  setPlacedItems: (items: PlacedItem[] | ((prev: PlacedItem[]) => PlacedItem[])) => void;
  setSelectedItemId: (id: string | null) => void;
  setSelectedItemColor: (color: string) => void;
  setIsPlacingItem: (item: PlacedItem | null) => void;
  setActiveCategory: (cat: string | null) => void;
  setSelectedWallIdx: (val: number | null) => void;
  setShowRoomCustomizer: (val: boolean) => void;
  setShowSummaryModal: (val: boolean) => void;
  setOrbitEnabled: (val: boolean) => void;
  setUndoStack: (stack: PlacedItem[][] | ((prev: PlacedItem[][]) => PlacedItem[][])) => void;
  setRedoStack: (stack: PlacedItem[][] | ((prev: PlacedItem[][]) => PlacedItem[][])) => void;
  showAlert: (msg: string) => void;
  hideAlert: () => void;
  setDoorSizeModal: (modal: DoorSizeModalState | null) => void;

  recordHistory: (next: PlacedItem[]) => void;
  handleUndo: () => void;
  handleRedo: () => void;
}

const INITIAL_WALL_DESIGN = {
  splitMode: 'full' as const,
  tileColorBottom: '#ffffff',
  tileColorTop: '#ffffff',
  tileColorCenter: '#ffffff',
  tileColorSides: '#ffffff',
};

const INITIAL: DesignState = {
  widthFt: 12.0,
  depthFt: 9.0,
  heightFt: 8.5,
  shape: 'rectangular',
  unit: 'feet',
  floorColor: '#34383C',
  wallDesigns: Array(8).fill(null).map(() => ({ ...INITIAL_WALL_DESIGN })),
  designType: 'bathroom',
  subRoomType: 'living_room',
  wallOpenings: [],
};

export const useDesignerStore = create<DesignerStoreState & DesignerStoreActions>((set, get) => ({
  state: INITIAL,
  topView: false,
  activeSideView: null,
  zoomTrigger: null,
  numWalls: 0,

  wizardStep: 1,
  fadeState: 'in',
  selectedRoomType: 'bathroom',
  subRoomType: 'living_room',
  showRoomTypeModal: false,
  projectName: 'My Bathroom Plan',
  selectedShape: 'rectangular',
  dimensionsUnit: 'cm',
  widthInput: '300',
  lengthInput: '240',
  heightInput: '250',
  projectId: null,
  validationErrors: {},
  isSubmitting: false,
  previewZoomTrigger: null,
  activePlacement: null,
  wizardWallOpenings: [],

  placedItems: [],
  selectedItemId: null,
  selectedItemColor: "#FFFFFF",
  isPlacingItem: null,
  activeCategory: null,
  selectedWallIdx: null,
  showRoomCustomizer: false,
  showSummaryModal: false,
  orbitEnabled: true,
  undoStack: [],
  redoStack: [],
  alertMessage: null,
  doorSizeModal: null,
  showAlert: (msg) => set({ alertMessage: msg }),
  hideAlert: () => set({ alertMessage: null }),
  setDoorSizeModal: (modal) => set({ doorSizeModal: modal }),

  setState: (updater) => set((prev) => ({
    state: typeof updater === 'function' ? updater(prev.state) : { ...prev.state, ...updater }
  })),
  setTopView: (val) => set({ topView: val }),
  setActiveSideView: (val) => set({ activeSideView: val }),
  setZoomTrigger: (val) => set({ zoomTrigger: val }),
  setNumWalls: (val) => set({ numWalls: val }),

  setWizardStep: (step) => set({ wizardStep: step }),
  setFadeState: (state) => set({ fadeState: state }),
  setSelectedRoomType: (type) => set({ selectedRoomType: type }),
  setSubRoomType: (type) => set({ subRoomType: type }),
  setShowRoomTypeModal: (val) => set({ showRoomTypeModal: val }),
  setProjectName: (name) => set({ projectName: name }),
  setSelectedShape: (shape) => set({ selectedShape: shape }),
  setDimensionsUnit: (unit) => set({ dimensionsUnit: unit }),
  setWidthInput: (val) => set({ widthInput: val }),
  setLengthInput: (val) => set({ lengthInput: val }),
  setHeightInput: (val) => set({ heightInput: val }),
  setProjectId: (id) => set({ projectId: id }),
  setValidationErrors: (errs) => set({ validationErrors: errs }),
  setIsSubmitting: (val) => set({ isSubmitting: val }),
  setPreviewZoomTrigger: (val) => set({ previewZoomTrigger: val }),
  setActivePlacement: (placement) => set({ activePlacement: placement }),
  setWizardWallOpenings: (updater) => set((prev) => ({
    wizardWallOpenings: typeof updater === 'function' ? updater(prev.wizardWallOpenings) : updater
  })),

  setPlacedItems: (updater) => set((prev) => ({
    placedItems: typeof updater === 'function' ? updater(prev.placedItems) : updater
  })),
  setSelectedItemId: (id) => set({ selectedItemId: id }),
  setSelectedItemColor: (color) => set({ selectedItemColor: color }),
  setIsPlacingItem: (item) => set({ isPlacingItem: item }),
  setActiveCategory: (cat) => set({ activeCategory: cat }),
  setSelectedWallIdx: (val) => set({ selectedWallIdx: val }),
  setShowRoomCustomizer: (val) => set({ showRoomCustomizer: val }),
  setShowSummaryModal: (val) => set({ showSummaryModal: val }),
  setOrbitEnabled: (val) => set({ orbitEnabled: val }),
  setUndoStack: (updater) => set((prev) => ({
    undoStack: typeof updater === 'function' ? updater(prev.undoStack) : updater
  })),
  setRedoStack: (updater) => set((prev) => ({
    redoStack: typeof updater === 'function' ? updater(prev.redoStack) : updater
  })),

  recordHistory: (next) => {
    const { placedItems, undoStack } = get();
    set({
      undoStack: [...undoStack, placedItems],
      redoStack: [],
      placedItems: next,
    });
  },
  handleUndo: () => {
    const { undoStack, placedItems, redoStack } = get();
    if (!undoStack.length) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, placedItems],
      placedItems: prev,
      selectedItemId: null,
  selectedItemColor: "#FFFFFF",
    });
  },
  handleRedo: () => {
    const { redoStack, placedItems, undoStack } = get();
    if (!redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, placedItems],
      placedItems: next,
      selectedItemId: null,
  selectedItemColor: "#FFFFFF",
    });
  }
}));
