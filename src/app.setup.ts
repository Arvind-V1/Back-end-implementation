import { BadRequestException, INestApplication, ValidationError, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) =>
        new BadRequestException({
          error: 'Validation failed',
          details: Object.fromEntries(
            errors.map((e) => [e.property, Object.values(e.constraints ?? {})[0]]),
          ),
        }),
    }),
  );
}