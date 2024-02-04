import { IsNotEmpty, IsString } from 'class-validator';

export class CreateSignDocumentDto {
  @IsNotEmpty()
  @IsString()
  crc: string;

  @IsNotEmpty()
  @IsString()
  id: string;
}
