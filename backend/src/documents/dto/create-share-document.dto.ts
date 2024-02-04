import { IsNotEmpty, IsString } from 'class-validator';

export class CreateShareDocumentDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsString()
  documentId: string;
}
