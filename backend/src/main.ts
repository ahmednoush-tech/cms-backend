import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Real client IP for the audit log (and electronic signatures).
  // nginx forwards the true client address in X-Forwarded-For; Express
  // only honors that header from sources it trusts. Trusting ONLY
  // private/loopback addresses (i.e. nginx inside the Docker network)
  // matters here because port 3000 is also published directly in
  // docker-compose.yml: a request arriving straight from the internet
  // comes from a public IP, so its X-Forwarded-For is ignored and
  // can't be used to forge the IP recorded in the audit trail.
  // Previously nothing was trusted, so req.ip was always nginx's own
  // container address — every signature so far recorded that instead
  // of the signer's IP.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties
      forbidNonWhitelisted: true, // 400 on unexpected fields
      transform: true, // apply DTO type coercion (e.g. pagination numbers)
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Company Management System API')
    .setDescription(
      'Phase 2A: Authentication, RBAC, and tenant/customer context. ' +
        'Additional modules land in subsequent phases.',
    )
    .setVersion('0.1.0-phase2a')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on :${port} — Swagger at /api/docs`);
}
bootstrap();
