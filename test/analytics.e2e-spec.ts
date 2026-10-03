import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { Category } from '../src/tools/entities/category.entity';
import { Department, Tool, ToolStatus } from '../src/tools/entities/tool.entity';

jest.setTimeout(30000);

describe('Analytics API (e2e)', () => {
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
    const base = { description: null, vendor: 'Vendor', websiteUrl: null, category };
    await ds.getRepository(Tool).save([
      { ...base, name: 'Eng A', monthlyCost: 10, ownerDepartment: Department.ENGINEERING, status: ToolStatus.ACTIVE, activeUsersCount: 5 },
      { ...base, name: 'Eng B', monthlyCost: 20.5, ownerDepartment: Department.ENGINEERING, status: ToolStatus.ACTIVE, activeUsersCount: 3 },
      { ...base, name: 'Eng old', monthlyCost: 99, ownerDepartment: Department.ENGINEERING, status: ToolStatus.DEPRECATED, activeUsersCount: 4 },
      { ...base, name: 'Sales A', monthlyCost: 30, ownerDepartment: Department.SALES, status: ToolStatus.ACTIVE, activeUsersCount: 2 },
      { ...base, name: 'Design old', monthlyCost: 15, ownerDepartment: Department.DESIGN, status: ToolStatus.DEPRECATED, activeUsersCount: 6 },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/analytics/department-costs', () => {
    it('agrège uniquement les outils actifs par département', async () => {
      const res = await api().get('/api/analytics/department-costs').expect(200);
      const eng = res.body.data.find((d: { department: string }) => d.department === 'Engineering');
      const sales = res.body.data.find((d: { department: string }) => d.department === 'Sales');

      expect(eng).toEqual({
        department: 'Engineering', total_cost: 111.5, tools_count: 2, total_users: 8,
        average_cost_per_tool: 55.75, cost_percentage: 65,
      });
      expect(sales).toEqual({
        department: 'Sales', total_cost: 60, tools_count: 1, total_users: 2,
        average_cost_per_tool: 60, cost_percentage: 35,
      });
      expect(res.body.summary).toEqual({
        total_company_cost: 171.5, departments_count: 7, most_expensive_department: 'Engineering',
      });
    });

    it('les pourcentages totalisent 100', async () => {
      const res = await api().get('/api/analytics/department-costs').expect(200);
      const sum = res.body.data.reduce((s: number, d: { cost_percentage: number }) => s + d.cost_percentage, 0);

      expect(Math.round(sum * 10)).toBe(1000);
    });

    it('inclut les départements sans outil actif avec des zéros', async () => {
      const res = await api().get('/api/analytics/department-costs').expect(200);
      const design = res.body.data.find((d: { department: string }) => d.department === 'Design');

      expect(res.body.data).toHaveLength(7);
      expect(design).toEqual({
        department: 'Design', total_cost: 0, tools_count: 0, total_users: 0, average_cost_per_tool: 0, cost_percentage: 0,
      });
    });

    it('trie par coût décroissant par défaut', async () => {
      const res = await api().get('/api/analytics/department-costs?sort_by=total_cost&order=desc').expect(200);

      expect(res.body.data[0].department).toBe('Engineering');
      expect(res.body.data[1].department).toBe('Sales');
    });

    it('trie par nom de département', async () => {
      const res = await api().get('/api/analytics/department-costs?sort_by=department&order=asc').expect(200);
      const names = res.body.data.map((d: { department: string }) => d.department);

      expect(names).toEqual([...names].sort());
    });

    it('refuse un tri invalide (400)', async () => {
      const res = await api().get('/api/analytics/department-costs?sort_by=foo&order=up').expect(400);

      expect(res.body.error).toBe('Validation failed');
      expect(Object.keys(res.body.details).sort()).toEqual(['order', 'sort_by']);
    });
  });
});