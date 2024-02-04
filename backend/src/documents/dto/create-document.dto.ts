import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDocumentDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  filePath: string;

  @IsOptional()
  @IsString()
  iv: string;

  @IsOptional()
  @IsString()
  mimetype: string;
}
