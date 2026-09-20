export class CreateProjectDto {
  userId?: string;
  name: string;
  shape: string;
  designType?: 'room' | 'bathroom';
}
