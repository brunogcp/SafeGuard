import { Logger, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import {
  PrismaModule,
  QueryInfo,
  loggingMiddleware,
  providePrismaClientExceptionFilter,
} from 'nestjs-prisma';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [
    PrismaModule.forRootAsync({
      isGlobal: true,
      useFactory: () => ({
        prismaOptions: {
          log: ['info'],
        },
        explicitConnect: true,
        middlewares: [
          loggingMiddleware({
            logger: new Logger('PrismaMiddleware'),
            logLevel: 'log',
            logMessage: (query: QueryInfo) =>
              `[Prisma Query] ${query.model}.${query.action} - ${query.executionTime}ms`,
          }),
        ],
      }),
    }),
    AuthModule,
    UsersModule,
    DocumentsModule,
  ],
  controllers: [AppController],
  providers: [providePrismaClientExceptionFilter(), AppService],
})
export class AppModule {}
