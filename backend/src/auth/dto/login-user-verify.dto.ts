import { IsEmail, IsNotEmpty } from 'class-validator';

export class LoginUserVerifyDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  token: string;
}
