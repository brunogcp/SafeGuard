import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { CreateDocumentDto } from './dto/create-document.dto';
import { Document } from '@prisma/client';
import { UpdateDocumentDto } from './dto/update-document.dto';

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  async create(
    createDocumentDto: CreateDocumentDto,
    userId: string,
  ): Promise<Document> {
    return this.prisma.document.create({
      data: {
        ...createDocumentDto,
        ownerId: userId,
      },
    });
  }

  async findAll(userId: string): Promise<Document[]> {
    return this.prisma.document.findMany({
      where: { ownerId: userId },
    });
  }

  async findOne(id: string, userId: string): Promise<Document> {
    const document = await this.prisma.document.findUnique({
      where: { id },
    });

    if (!document || document.ownerId !== userId) {
      throw new NotFoundException(
        'Document not found or you do not have permission to access it.',
      );
    }

    return document;
  }

  async update(
    id: string,
    updateDocumentDto: UpdateDocumentDto,
    userId: string,
  ): Promise<Document> {
    await this.findOne(id, userId); // Re-use to check ownership and existence
    return this.prisma.document.update({
      where: { id },
      data: updateDocumentDto,
    });
  }

  async remove(id: string, userId: string): Promise<Document> {
    await this.findOne(id, userId); // Re-use to check ownership and existence
    return this.prisma.document.delete({
      where: { id },
    });
  }
}
