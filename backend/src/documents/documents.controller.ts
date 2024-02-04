import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { mkdir } from 'fs/promises';
import { CreateShareDocumentDto } from './dto/create-share-document.dto';
import { CreateSignDocumentDto } from './dto/validate-sign-document.dto';

@Controller('documents')
@UseGuards(JwtAuthGuard) // Protege todas as rotas deste controlador
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @Delete('/share')
  async deleteShare(
    @Body() createShareDocumentDto: CreateShareDocumentDto,
    @Req() req,
  ) {
    return this.documentsService.removeShareWithUser(
      createShareDocumentDto,
      req.user.userId,
    );
  }

  @Post('/share')
  async createShare(
    @Body() createShareDocumentDto: CreateShareDocumentDto,
    @Req() req,
  ) {
    return this.documentsService.shareWithUser(
      createShareDocumentDto,
      req.user.userId,
    );
  }

  @Post('/sign')
  async sign(@Body() createShareDocumentDto: CreateShareDocumentDto) {
    return this.documentsService.signDocument(createShareDocumentDto);
  }

  @Post('/sign/verify')
  async signVerify(@Body() createSignDocumentDto: CreateSignDocumentDto) {
    return this.documentsService.verifySignDocument(createSignDocumentDto);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: async (req, file, callback) => {
          const userId = req.user.userId;
          const uploadPath = join('uploads', String(userId));
          console.log(uploadPath);

          await mkdir(uploadPath, { recursive: true });

          callback(null, uploadPath);
        },
        filename: (req, file, callback) => {
          const fileExtName = extname(file.originalname);
          const uniqueName = `${randomUUID()}${fileExtName}`;
          callback(null, uniqueName);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(pdf|doc|docx)$/)) {
          return callback(new Error('Only document files are allowed!'), false);
        }
        callback(null, true);
      },
      limits: { fileSize: 1024 * 1024 * 5 },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req) {
    const encryptedFileInfo = await this.documentsService.encryptFile(
      file.path,
    );
    const createDocumentDto: CreateDocumentDto = {
      ...encryptedFileInfo,
      title: file.originalname,
      mimetype: file.mimetype,
    };
    return this.documentsService.create(createDocumentDto, req.user.userId);
  }

  @Get()
  async findAll(@Req() req) {
    return this.documentsService.findAll(req.user.userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req, @Res() res) {
    const document = await this.documentsService.findDocument(
      id,
      req.user.userId,
    );
    res.setHeader('Content-Type', document.mimetype);

    return res.send(document.data);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDocumentDto: UpdateDocumentDto,
    @Req() req,
  ) {
    return this.documentsService.update(id, updateDocumentDto, req.user.userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req) {
    return this.documentsService.remove(id, req.user.userId);
  }
}
