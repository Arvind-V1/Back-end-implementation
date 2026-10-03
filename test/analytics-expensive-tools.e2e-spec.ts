import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { Category } from '../src/tools/entities/category.entity';
import { Department, Tool, ToolStatus } from '../src/tools/entities/tool.entity';

jest.setTimeout(30000);

describe('GET /api/analytics/expensive-tools (e2e)', () => {
  let app: INestApplication;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    const ds = app.get(DataSource);
    await ds.synchronize(true);

    const category = await ds.getRepository(Category).save({ name: 'Development' });
    const base = { description: null, websiteUrl: null, category, status: ToolStatus.ACTIVE };
    await ds.getRepository(Tool).save([
      { ...base, name: 'Big CRM', vendor: 'V1', monthlyCost: 300, ownerDepartment: Department.SALES, activeUsersCount: 10 },
      { ...base, name: 'Mid Tool', vendor: 'V2', monthlyCost: 200, ownerDepartment: Department.ENGINEERING, activeUsersCount: 10 },
      { ...base, name: 'Small Tool', vendor: 'V3', monthlyCost: 100, ownerDepartment: Department.DESIGN, activeUsersCount: 10 },
      { ...base, name: 'Unused', vendor: 'V4', monthlyCost: 40, ownerDepartment: Department.HR, activeUsersCount: 0 },
      { ...base, name: 'Cheap', vendor: 'V5', monthlyCost: 20, ownerDepartment: Department.MARKETING, activeUsersCount: 10 },
      { ...base, name: 'Old', vendor: 'V6', monthlyCost: 999, ownerDepartment: Department.ENGINEERING, status: ToolStatus.DEPRECATED, activeUsersCount: 5 },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('classe les outils actifs par coût décroissant avec ratings et analyse', async () => {
    const res = await api().get('/api/analytics/expensive-tools').expect(200);
    const rating = (name: string) =>
      res.body.data.find((d: { name: string }) => d.name === name).efficiency_rating;

    expect(res.body.data.map((d: { name: string }) => d.name)).toEqual([
      'Big CRM', 'Mid Tool', 'Small Tool', 'Unused', 'Cheap',
    ]);
    expect(res.body.data[0]).toEqual({
      id: expect.any(Number), name: 'Big CRM', monthly_cost: 300, active_users_count: 10,
      cost_per_user: 30, department: 'Sales', vendor: 'V1', efficiency_rating: 'low',
    });
    expect(rating('Mid Tool')).toBe('low'); // 20 / 15.5 = 129 %
    expect(rating('Small Tool')).toBe('good'); // 10 / 15.5 = 65 %
    expect(rating('Cheap')).toBe('excellent'); // 2 / 15.5 = 13 %
    expect(res.body.analysis).toEqual({
      total_tools_analyzed: 5,
      avg_cost_per_user_company: 15.5,
      potential_savings_identified: 540,
    });
  });

  it('applique min_cost et limit sans changer la moyenne entreprise', async () => {
    const res = await api().get('/api/analytics/expensive-tools?min_cost=100&limit=2').expect(200);

    expect(res.body.data.map((d: { name: string }) => d.name)).toEqual(['Big CRM', 'Mid Tool']);
    expect(res.body.analysis).toEqual({
      total_tools_analyzed: 3,
      avg_cost_per_user_company: 15.5,
      potential_savings_identified: 500,
    });
  });

  it('gère un outil sans utilisateur : cost_per_user null, rating low', async () => {
    const res = await api().get('/api/analytics/expensive-tools').expect(200);
    const unused = res.body.data.find((d: { name: string }) => d.name === 'Unused');

    expect(unused.cost_per_user).toBeNull();
    expect(unused.efficiency_rating).toBe('low');
  });

  it('ignore les outils non actifs', async () => {
    const res = await api().get('/api/analytics/expensive-tools').expect(200);

    expect(res.body.data.map((d: { name: string }) => d.name)).not.toContain('Old');
  });

  it('refuse des paramètres invalides (400)', async () => {
    for (const query of ['limit=0', 'limit=abc', 'limit=101', 'min_cost=-1']) {
      const res = await api().get(`/api/analytics/expensive-tools?${query}`).expect(400);

      expect(res.body.error).toBe('Validation failed');
    }
  });
});