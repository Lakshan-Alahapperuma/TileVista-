import { IsString, IsOptional, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PackageItemDto } from './create-package.dto';

export class UpdatePackageDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  discountPercent?: number;

  @IsString()
  @IsOptional()
  coverImage?: string;

  @IsOptional()
  designData?: any;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PackageItemDto)
  packageItems?: PackageItemDto[];
}
