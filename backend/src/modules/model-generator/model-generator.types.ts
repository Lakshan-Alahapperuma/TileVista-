export interface ModelGenerationJob {
  projectId: string;
  inputVideoPath: string;
  projectFolder: string;
  framesFolder: string;
  reconstructionFolder: string;
  outputFolder: string;
  itemId?: string;
}
