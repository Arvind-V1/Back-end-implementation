import { ArgumentsHost, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = { switchToHttp: () => ({ getResponse: () => ({ status }) }) } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  return { status, json };
}

describe('AllExceptionsFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('renvoie telle quelle une erreur de validation { error, details }', () => {
    const body = { error: 'Validation failed', details: { name: 'Name is required and must be 2-100 characters' } };
    const { status, json } = run(new BadRequestException(body));

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('renvoie le format { error, message } pour une 404 personnalisée', () => {
    const { status, json } = run(
      new NotFoundException({ error: 'Tool not found', message: 'Tool with ID 999 does not exist' }),
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ error: 'Tool not found', message: 'Tool with ID 999 does not exist' });
  });

  it('gère une HttpException standard sans statusCode dans la réponse', () => {
    const { json } = run(new NotFoundException('Cannot GET /x'));

    expect(json).toHaveBeenCalledWith({ error: 'Not Found', message: 'Cannot GET /x' });
  });

  it('renvoie une 500 "Database connection failed" quand la base est injoignable', () => {
    const { status, json } = run(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }));

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: 'Internal server error', message: 'Database connection failed' });
  });

  it('renvoie une 500 générique sans fuiter le détail de l\'erreur', () => {
    const { status, json } = run(new Error('secret internal detail'));

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: 'Internal server error', message: 'An unexpected error occurred' });
  });
});