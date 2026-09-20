import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class InquiriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInquiryDto) {
    return this.prisma.inquiries.create({
      data: {
        inquiry_id: uuidv4(),
        name: dto.name,
        email: dto.email,
        subject: dto.subject,
        message: dto.message,
        status: 'pending',
      },
    });
  }

  async findAll() {
    return this.prisma.inquiries.findMany({
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const inquiry = await this.prisma.inquiries.findUnique({
      where: { inquiry_id: id },
    });
    if (!inquiry) {
      throw new NotFoundException(`Inquiry with ID ${id} not found`);
    }
    return inquiry;
  }

  async markAsReplied(id: string) {
    const inquiry = await this.findOne(id);
    return this.prisma.inquiries.update({
      where: { inquiry_id: id },
      data: {
        status: 'replied',
        updated_at: new Date(),
      },
    });
  }
}
