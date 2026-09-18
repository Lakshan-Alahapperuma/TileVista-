import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class PackageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeInactive = false) {
    return this.prisma.packages.findMany({
      where: includeInactive ? undefined : { status: 'active' },
      include: {
        package_items: {
          include: {
            products: {
              include: {
                product_assets: true,
              },
            },
          },
        },
      },
    });
  }

  async findById(id: string) {
    return this.prisma.packages.findUnique({
      where: { package_id: id },
      include: {
        package_items: {
          include: {
            products: {
              include: {
                product_assets: true,
              },
            },
          },
        },
      },
    });
  }

  private async resolveProductId(tx: any, item: any): Promise<string | null> {
    if (item.osposItemId) {
      const osposId = Number(item.osposItemId);
      let product = await tx.products.findUnique({
        where: { ospos_item_id: osposId },
      });
      if (!product) {
        product = await tx.products.create({
          data: {
            product_id: randomUUID(),
            ospos_item_id: osposId,
            is_active: true,
          },
        });
      }
      return product.product_id;
    }

    if (item.productId) {
      if (!isNaN(Number(item.productId))) {
        const osposId = Number(item.productId);
        let product = await tx.products.findUnique({
          where: { ospos_item_id: osposId },
        });
        if (!product) {
          product = await tx.products.create({
            data: {
              product_id: randomUUID(),
              ospos_item_id: osposId,
              is_active: true,
            },
          });
        }
        return product.product_id;
      }

      const product = await tx.products.findUnique({
        where: { product_id: item.productId },
      });
      if (product) return product.product_id;
    }

    return null;
  }

  async create(data: CreatePackageDto) {
    return this.prisma.$transaction(async (tx) => {
      const pkg = await tx.packages.create({
        data: {
          package_id: randomUUID(),
          package_name: data.name,
          description: data.description || '',
          cover_image: data.coverImage || '',
          discount_percentage: data.discountPercent,
          design_data: data.designData ? (typeof data.designData === 'string' ? data.designData : JSON.stringify(data.designData)) : null,
          status: 'active',
        },
      });

      if (data.packageItems && data.packageItems.length > 0) {
        for (const item of data.packageItems) {
          const targetProductId = await this.resolveProductId(tx, item);
          if (targetProductId) {
            await tx.package_items.create({
              data: {
                package_id: pkg.package_id,
                product_id: targetProductId,
                quantity: item.quantity,
              },
            });
          }
        }
      }
      return pkg;
    });
  }

  async update(id: string, data: UpdatePackageDto) {
    return this.prisma.$transaction(async (tx) => {
      const pkg = await tx.packages.update({
        where: { package_id: id },
        data: {
          package_name: data.name,
          description: data.description,
          cover_image: data.coverImage,
          discount_percentage: data.discountPercent,
          design_data: data.designData ? (typeof data.designData === 'string' ? data.designData : JSON.stringify(data.designData)) : undefined,
        },
      });

      if (data.packageItems) {
        await tx.package_items.deleteMany({
          where: { package_id: id },
        });

        for (const item of data.packageItems) {
          const targetProductId = await this.resolveProductId(tx, item);
          if (targetProductId) {
            await tx.package_items.create({
              data: {
                package_id: id,
                product_id: targetProductId,
                quantity: item.quantity,
              },
            });
          }
        }
      }
      return pkg;
    });
  }

  async delete(id: string) {
    return this.prisma.$transaction(async (tx) => {
      // Cascade delete items first (although Prisma has onDelete: Cascade, we make it explicit to prevent FK constraints)
      await tx.package_items.deleteMany({
        where: { package_id: id },
      });
      return tx.packages.delete({
        where: { package_id: id },
      });
    });
  }
}
