import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { PrismaClientExceptionFilter } from 'nestjs-prisma';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import * as dotenv from 'dotenv';
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(
    rateLimit({
      windowMs: 1 * 60 * 1000,
      max: 25,
    }),
  );

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
    allowedHeaders: 'Content-Type, Accept, authorization',
  });

  app.use(helmet());

  app.setGlobalPrefix('api', { exclude: ['/'] });
  app.useGlobalPipes(new ValidationPipe());

  const instance = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(instance));
  app.useGlobalFilters(new PrismaClientExceptionFilter(instance.httpAdapter));

  const config = new DocumentBuilder()
    .setTitle(process.env.npm_package_description)
    .setDescription('The example API description')
    .setVersion(process.env.npm_package_version)
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  await app.listen(3000);
}
bootstrap();
