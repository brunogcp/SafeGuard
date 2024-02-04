import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';

import { UsersService } from '../users/users.service';
import { LoginUserDto } from './dto/login-user.dto';
import { User } from '@prisma/client';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { MailerService } from '@nestjs-modules/mailer';
import { LoginUserVerifyDto } from './dto/login-user-verify.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private mailerService: MailerService,
  ) {}

  async validateUser(
    loginUserDto: LoginUserDto,
  ): Promise<Omit<User, 'password' | 'otpSecret'> | null> {
    const { email, password } = loginUserDto;
    const user: User = await this.usersService.findOne(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, otpSecret, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginUserDto: LoginUserDto): Promise<{ message: string }> {
    const user = await this.validateUser(loginUserDto);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    await this.sendLoginOtp(user.email);

    return {
      message: 'Código de validação enviado ao seu email!',
    };
  }

  async sendLoginOtp(email: string) {
    const secret = speakeasy.generateSecret({ length: 20 });
    const token = speakeasy.totp({
      secret: secret.hex,
      encoding: 'hex',
      step: 180,
    });

    await this.usersService.saveOtpSecret(email, secret.hex);

    await this.mailerService.sendMail({
      to: email,
      subject: 'Seu código de login',
      text: `Seu código é: ${token}`,
    });
  }

  async verifyOtp(
    loginUserDto: LoginUserVerifyDto,
  ): Promise<{ access_token: string }> {
    const user = await this.usersService.findOne(loginUserDto.email);
    const verified = speakeasy.totp.verify({
      secret: user.otpSecret,
      encoding: 'hex',
      token: loginUserDto.token,
      step: 180,
    });

    if (!verified) {
      throw new Error('Código OTP inválido ou expirado.');
    }

    const payload: JwtPayload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
