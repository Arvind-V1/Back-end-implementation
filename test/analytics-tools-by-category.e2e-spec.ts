import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { Category } from '../src/tools/entities/category.entity';
import { Department, Tool, ToolStatus } from '../src/tools/entities/tool.entity';

jest.setTimeout(30000);

describe('GET /api/analytics/tools-by-category (e2e)', () => {
  let app: INestApplication;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    const ds = app.get(DataSource);
    await ds.synchronize(true);

    const [dev, comm, design, security] = await ds
      .getRepository(Category)
      .save([{ name: 'Development' }, { name: 'Communication' }, { name: 'Design' }, { name: 'Security' }]);

    const base = {
      description: null, vendor: 'Vendor', websiteUrl: null,
      status: ToolStatus.ACTIVE, ownerDepartment: Department.ENGINEERING,
    };
    await ds.getRepository(Tool).save([
      { ...base, name: 'Dev A', category: dev, monthlyCost: 100, activeUsersCount: 10 },
      { ...base, name: 'Dev B', category: dev, monthlyCost: 50.5, activeUsersCount: 7 },
      { ...base, name: 'Comm A', category: comm, monthlyCost: 30, activeUsersCount: 30 },
      { ...base, name: 'Design A', category: design, monthlyCost: 20, activeUsersCount: 0 },
      { ...base, name: 'Sec old', category: security, monthlyCost: 500, activeUsersCount: 5, status: ToolStatus.DEPRECATED },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('agrège les outils actifs par catégorie avec pourcentages, moyennes et insights', async () => {
    const res = await api().get('/api/analytics/tools-by-category').expect(200);

    expect(res.body).toEqual({
      data: [
        { category_name: 'Development', tools_count: 2, total_cost: 150.5, total_users: 17, percentage_of_budget: 75, average_cost_per_user: 8.85 },
        { category_name: 'Communication', tools_count: 1, total_cost: 30, total_users: 30, percentage_of_budget: 15, average_cost_per_user: 1 },
        { category_name: 'Design', tools_count: 1, total_cost: 20, total_users: 0, percentage_of_budget: 10, average_cost_per_user: null },
        { category_name: 'Security', tools_count: 0, total_cost: 0, total_users: 0, percentage_of_budget: 0, average_cost_per_user: null },
      ],
      insights: { most_expensive_category: 'Development', most_efficient_category: 'Communication' },
    });
  });

  it('les pourcentages totalisent 100', async () => {
    const res = await api().get('/api/analytics/tools-by-category').expect(200);
    const sum = res.body.data.reduce((s: number, d: { percentage_of_budget: number }) => s + d.percentage_of_budget, 0);

    expect(Math.round(sum * 10)).toBe(1000);
  });

  it('garde une catégorie sans outil actif avec des zéros et ignore les outils non actifs', async () => {
    const res = await api().get('/api/analytics/tools-by-category').expect(200);
    const security = res.body.data.find((d: { category_name: string }) => d.category_name === 'Security');

    expect(security).toEqual({
      category_name: 'Security', tools_count: 0, total_cost: 0, total_users: 0,
      percentage_of_budget: 0, average_cost_per_user: null,
    });
  });
});