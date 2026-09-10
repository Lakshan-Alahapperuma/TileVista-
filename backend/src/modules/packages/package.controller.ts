import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { PackageService } from './package.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

const IMAGE_DIR = path.join(process.cwd(), 'uploads', 'images');

@Controller('packages')
export class PackageController {
  constructor(private readonly packageService: PackageService) {}

  @Post('upload-cover')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ADMINISTRATOR')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          if (!fs.existsSync(IMAGE_DIR)) {
            fs.mkdirSync(IMAGE_DIR, { recursive: true });
          }
          cb(null, IMAGE_DIR);
        },
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname) || '.jpg';
          cb(null, `package-cover-${Date.now()}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowed = /\.(jpg|jpeg|png|webp|avif)$/i;
        if (!allowed.test(file.originalname)) {
          return cb(
            new BadRequestException('Only image files (jpg, png, webp) are allowed.'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadCover(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded.');
    const imageUrl = `/uploads/images/${file.filename}`;
    return { imageUrl };
  }

  @Get()
  async getAll() {
    return this.packageService.findAll(false);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ADMINISTRATOR')
  async adminGetAll() {
    return this.packageService.findAll(true);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.packageService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ADMINISTRATOR')
  async create(@Body() createDto: CreatePackageDto) {
    return this.packageService.create(createDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ADMINISTRATOR')
  async update(@Param('id') id: string, @Body() updateDto: UpdatePackageDto) {
    return this.packageService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ADMINISTRATOR')
  async remove(@Param('id') id: string) {
    return this.packageService.remove(id);
  }
}
