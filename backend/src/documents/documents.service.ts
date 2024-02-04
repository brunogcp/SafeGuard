import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import {
  createCipheriv,
  createDecipheriv,
  createSign,
  randomBytes,
  scrypt,
  scryptSync,
} from 'crypto';
import { promisify } from 'util';
import { Document, SharedDocument } from '@prisma/client';
import { readFile, writeFile } from 'fs/promises';

import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CreateShareDocumentDto } from './dto/create-share-document.dto';
import { crc32 } from 'crc';
import { join } from 'path';
import { CreateSignDocumentDto } from './dto/validate-sign-document.dto';

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  async create(
    createDocumentDto: CreateDocumentDto,
    userId: string,
  ): Promise<Omit<Document, 'iv' | 'signature'>> {
    return this.prisma.document.create({
      data: {
        ...createDocumentDto,
        ownerId: userId,
      },
      select: {
        id: true,
        title: true,
        filePath: true,
        crc: true,
        signature: false,
        ownerId: true,
        mimetype: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async encryptFile(
    filePath: string,
  ): Promise<{ iv: string; filePath: string }> {
    const algorithm = 'aes-256-ctr';
    const password = process.env.FILE_ENCRYPTION_SECRET || 'password';
    const key = (await promisify(scrypt)(password, 'salt', 32)) as Buffer;
    const iv = randomBytes(16);

    const content = await readFile(filePath);
    const cipher = createCipheriv(algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(content), cipher.final()]);

    await writeFile(filePath, encrypted);

    return { iv: iv.toString('hex'), filePath };
  }

  async decryptFile(filePath: string, ivHex: string): Promise<Buffer> {
    const key = scryptSync(
      process.env.FILE_ENCRYPTION_SECRET || 'password',
      'salt',
      32,
    );
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv('aes-256-ctr', key, iv);

    const encryptedContent = await readFile(filePath);
    const decrypted = Buffer.concat([
      decipher.update(encryptedContent),
      decipher.final(),
    ]);

    return decrypted;
  }

  async findAll(userId: string): Promise<Omit<Document, 'iv' | 'signature'>[]> {
    return this.prisma.document.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        title: true,
        filePath: true,
        crc: true,
        signature: false,
        ownerId: true,
        mimetype: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(
    id: string,
    userId: string,
    verifyUser = true,
  ): Promise<Document> {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        sharedWith: true,
      },
    });

    const hasSharedAccess = document.sharedWith.find((document) => {
      return document.userId === userId;
    });

    if (verifyUser) {
      if (!document || !(document.ownerId === userId || hasSharedAccess)) {
        throw new NotFoundException(
          'Document not found or you do not have permission to access it.',
        );
      }
    }

    return document;
  }

  async findDocument(
    id: string,
    userId: string,
    verifyUser = true,
  ): Promise<{ data: Buffer; mimetype: string; crc: string; id: string }> {
    const document = await this.findOne(id, userId, verifyUser);

    const decryptedContent = await this.decryptFile(
      document.filePath,
      document.iv,
    );

    return {
      data: decryptedContent,
      mimetype: document.mimetype,
      crc: document.crc,
      id: document.id,
    };
  }

  async update(
    id: string,
    updateDocumentDto: UpdateDocumentDto,
    userId: string,
  ): Promise<Omit<Document, 'iv' | 'signature'>> {
    await this.findOne(id, userId); // Re-use to check ownership and existence
    return this.prisma.document.update({
      where: { id },
      data: {
        title: updateDocumentDto.title,
      },
      select: {
        id: true,
        title: true,
        filePath: true,
        ownerId: true,
        crc: true,
        signature: false,
        mimetype: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string, userId: string): Promise<null> {
    await this.findOne(id, userId); // Re-use to check ownership and existence
    await this.prisma.document.delete({
      where: { id },
    });
    return null;
  }

  async shareWithUser(
    createShareDocumentDto: CreateShareDocumentDto,
    ownerId: string,
  ): Promise<SharedDocument> {
    await this.findOne(createShareDocumentDto.documentId, ownerId);
    return this.prisma.sharedDocument.create({
      data: {
        userId: createShareDocumentDto.userId,
        documentId: createShareDocumentDto.documentId,
        accessLevel: 'read',
      },
    });
  }

  async removeShareWithUser(
    createShareDocumentDto: CreateShareDocumentDto,
    ownerId: string,
  ): Promise<null> {
    await this.findOne(createShareDocumentDto.documentId, ownerId);
    await this.prisma.sharedDocument.delete({
      where: {
        user_document_unique: {
          userId: createShareDocumentDto.userId,
          documentId: createShareDocumentDto.documentId,
        },
      },
    });
    return null;
  }

  async signUsers(data: Partial<SharedDocument>[]): Promise<string> {
    const PRIVATE_KEY_PATH = join(__dirname, '../../keys/private_key.pem');
    const privateKey = await readFile(PRIVATE_KEY_PATH, 'utf8');
    const signer = createSign('sha256');
    signer.update(JSON.stringify(data));
    signer.end();
    const signature = signer.sign(privateKey, 'hex');
    return signature;
  }

  async verifySignDocument(
    createSignDocumentDto: CreateSignDocumentDto,
  ): Promise<any> {
    const document = await this.prisma.document.findUnique({
      where: {
        id: createSignDocumentDto.id,
      },
    });

    if (document.crc !== createSignDocumentDto.crc) {
      throw new BadRequestException('Código CRC Não pertence ao Arquivo!');
    }

    const documentDecrypted = await this.findDocument(
      createSignDocumentDto.id,
      undefined,
      false,
    );

    const crc = crc32(documentDecrypted.data)
      .toString(16)
      .toUpperCase()
      .padStart(8, '0');

    if (documentDecrypted.crc !== crc) {
      throw new BadRequestException('Código CRC Inválido!');
    }

    const users = await this.prisma.sharedDocument.findMany({
      where: {
        documentId: createSignDocumentDto.id,
      },
      include: {
        user: true,
      },
    });

    const userVerify = users.map((user) => {
      return {
        id: user.id,
        documentId: user.documentId,
        userId: user.userId,
      };
    });
    const signature = await this.signUsers(userVerify);

    if (signature !== document.signature) {
      throw new BadRequestException('Assinatura do Documento Inválido!');
    }

    const assinaturas = users.map((user) => {
      return `Assinado por ${user.user.email}`;
    });

    return {
      assinaturas,
    };
  }

  async signDocument(
    createSingDocumentDto: CreateShareDocumentDto,
  ): Promise<{ crc: string; id: string }> {
    const document = await this.findDocument(
      createSingDocumentDto.documentId,
      createSingDocumentDto.userId,
    );

    const crc = crc32(document.data)
      .toString(16)
      .toUpperCase()
      .padStart(8, '0');

    await this.prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: {
          id: document.id,
        },
        data: {
          crc,
        },
      });

      await tx.sharedDocument.update({
        where: {
          user_document_unique: {
            documentId: createSingDocumentDto.documentId,
            userId: createSingDocumentDto.userId,
          },
        },
        data: {
          signed: true,
        },
      });

      const users = await tx.sharedDocument.findMany({
        where: {
          documentId: createSingDocumentDto.documentId,
        },
        select: {
          id: true,
          documentId: true,
          userId: true,
        },
      });

      const signature = await this.signUsers(users);

      await tx.document.update({
        where: {
          id: createSingDocumentDto.documentId,
        },
        data: {
          signature,
        },
      });
      return;
    });

    return {
      crc,
      id: createSingDocumentDto.documentId,
    };
  }
}
