import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { Category } from '../src/tools/entities/category.entity';
import { Department, Tool, ToolStatus } from '../src/tools/entities/tool.entity';

jest.setTimeout(30000);

describe('GET /api/analytics/low-usage-tools (e2e)', () => {
  let app: INestApplication;
  const api = () => request(app.getHttpServer());
  const names = (body: { data: { name: string }[] }) => body.data.map((d) => d.name);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    const ds = app.get(DataSource);
    await ds.synchronize(true);

    const category = await ds.getRepository(Category).save({ name: 'Development' });
    const base = {
      description: null, websiteUrl: null, category,
      status: ToolStatus.ACTIVE, vendor: 'Vendor', ownerDepartment: Department.ENGINEERING,
    };
    await ds.getRepository(Tool).save([
      { ...base, name: 'Ghost', monthlyCost: 40, activeUsersCount: 0 },
      { ...base, name: 'Pricey Few', vendor: 'SmallVendor', ownerDepartment: Department.MARKETING, monthlyCost: 89.99, activeUsersCount: 2 },
      { ...base, name: 'Very Pricey', vendor: 'BigVendor', ownerDepartment: Department.SALES, monthlyCost: 300, activeUsersCount: 3 },
      { ...base, name: 'Cheap Few', monthlyCost: 10, activeUsersCount: 4 },
      { ...base, name: 'Edge Five', monthlyCost: 100, activeUsersCount: 5 },
      { ...base, name: 'Popular', monthlyCost: 500, activeUsersCount: 6 },
      { ...base, name: 'Old Few', monthlyCost: 99, activeUsersCount: 1, status: ToolStatus.DEPRECATED },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('utilise max_users = 5 par défaut, trie par gravité et calcule les économies', async () => {
    const res = await api().get('/api/analytics/low-usage-tools').expect(200);

    expect(names(res.body)).toEqual(['Very Pricey', 'Ghost', 'Edge Five', 'Pricey Few', 'Cheap Few']);
    expect(res.body.data[0]).toEqual({
      id: expect.any(Number), name: 'Very Pricey', monthly_cost: 300, active_users_count: 3,
      cost_per_user: 100, department: 'Sales', vendor: 'BigVendor',
      warning_level: 'high', potential_action: 'Consider canceling or downgrading',
    });
    expect(res.body.savings_analysis).toEqual({
      total_underutilized_tools: 5,
      potential_monthly_savings: 529.99,
      potential_annual_savings: 6359.88,
    });
  });

  it('applique le seuil max_users fourni', async () => {
    const res = await api().get('/api/analytics/low-usage-tools?max_users=3').expect(200);

    expect(names(res.body)).toEqual(['Very Pricey', 'Ghost', 'Pricey Few']);
    expect(res.body.savings_analysis).toEqual({
      total_underutilized_tools: 3,
      potential_monthly_savings: 429.99,
      potential_annual_savings: 5159.88,
    });
  });

  it('max_users=0 ne renvoie que les outils sans utilisateur', async () => {
    const res = await api().get('/api/analytics/low-usage-tools?max_users=0').expect(200);

    expect(res.body.data).toEqual([
      {
        id: expect.any(Number), name: 'Ghost', monthly_cost: 40, active_users_count: 0,
        cost_per_user: null, department: 'Engineering', vendor: 'Vendor',
        warning_level: 'high', potential_action: 'Consider canceling or downgrading',
      },
    ]);
    expect(res.body.savings_analysis).toEqual({
      total_underutilized_tools: 1,
      potential_monthly_savings: 40,
      potential_annual_savings: 480,
    });
  });

  it('ignore les outils non actifs', async () => {
    const res = await api().get('/api/analytics/low-usage-tools?max_users=10').expect(200);

    expect(names(res.body)).not.toContain('Old Few');
    expect(names(res.body)).toContain('Popular');
  });

  it('refuse un max_users invalide (400)', async () => {
    for (const query of ['max_users=-1', 'max_users=abc', 'max_users=1.5']) {
      const res = await api().get(`/api/analytics/low-usage-tools?${query}`).expect(400);

      expect(res.body.error).toBe('Validation failed');
      expect(res.body.details.max_users).toBeDefined();
    }
  });
});