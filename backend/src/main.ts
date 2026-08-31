import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Increase JSON payload limit for image logo uploads (up to 50MB)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  // Enable CORS for Frontend React app (Dynamic Origin Reflection for credentials support)
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders:
      'Content-Type,Authorization,x-branch-id,X-Branch-Id,x-portal-session,X-Portal-Session,X-Requested-With,Accept,Origin,X-Statement-Kind',
    exposedHeaders: 'X-Statement-Kind,Content-Disposition',
    credentials: true,
  });

  // Global API Prefix (/api)
  app.setGlobalPrefix('api');

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('نظام المحاسبة المالية لشركات السياحة والسفر')
    .setDescription('واجهات API لإدارة شجرة الحسابات، القيد المزدوج، سندات القبض والدفع، والتقارير المالية')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 Accounting Backend is running at: http://localhost:${port}`);
  console.log(`📚 Swagger API Documentation: http://localhost:${port}/api/docs`);
}
bootstrap();
