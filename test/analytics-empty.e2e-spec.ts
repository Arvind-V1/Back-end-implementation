import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { Category } from '../src/tools/entities/category.entity';
import { Department, Tool, ToolStatus } from '../src/tools/entities/tool.entity';

jest.setTimeout(30000);

const NO_DATA = 'No analytics data available - ensure tools data exists';
const ROUTES = ['department-costs', 'expensive-tools', 'tools-by-category', 'low-usage-tools', 'vendor-summary'];

describe('Analytics : absence de données (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    ds = app.get(DataSource);
    await ds.synchronize(true); // tables vides
  });

  afterAll(async () => {
    await app.close();
  });

  // Les tests s'exécutent dans l'ordre : base vide d'abord, puis outil déprécié seul
  it.each(ROUTES)('%s : base vide -> 200, data vide et message', async (route) => {
    const res = await api().get(`/api/analytics/${route}`).expect(200);

    expect(res.body.data).toEqual([]);
    expect(res.body.message).toBe(NO_DATA);
  });

  it('department-costs : base vide -> total_company_cost à 0', async () => {
    const res = await api().get('/api/analytics/department-costs').expect(200);

    expect(res.body.summary.total_company_cost).toBe(0);
  });

  it('des outils tous non actifs donnent la même réponse "aucune donnée"', async () => {
    const category = await ds.getRepository(Category).save({ name: 'Development' });
    await ds.getRepository(Tool).save({
      name: 'Old', description: null, vendor: 'Vendor', websiteUrl: null, category,
      ownerDepartment: Department.ENGINEERING, monthlyCost: 99, activeUsersCount: 5, status: ToolStatus.DEPRECATED,
    });

    for (const route of ROUTES) {
      const res = await api().get(`/api/analytics/${route}`).expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.message).toBe(NO_DATA);
    }
  });
});