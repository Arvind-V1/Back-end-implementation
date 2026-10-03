import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { Category } from '../src/tools/entities/category.entity';
import { Department, Tool, ToolStatus } from '../src/tools/entities/tool.entity';

jest.setTimeout(30000);

describe('GET /api/analytics/vendor-summary (e2e)', () => {
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
      { ...base, name: 'G1', vendor: 'Google', ownerDepartment: Department.ENGINEERING, monthlyCost: 100, activeUsersCount: 30 },
      { ...base, name: 'G2', vendor: 'Google', ownerDepartment: Department.SALES, monthlyCost: 80, activeUsersCount: 20 },
      { ...base, name: 'G3', vendor: 'Google', ownerDepartment: Department.MARKETING, monthlyCost: 40, activeUsersCount: 10 },
      { ...base, name: 'G4', vendor: 'Google', ownerDepartment: Department.ENGINEERING, monthlyCost: 14.5, activeUsersCount: 7 },
      { ...base, name: 'B1', vendor: 'BigCorp', ownerDepartment: Department.SALES, monthlyCost: 300, activeUsersCount: 10 },
      { ...base, name: 'A1', vendor: 'Atlassian', ownerDepartment: Department.ENGINEERING, monthlyCost: 50, activeUsersCount: 5 },
      { ...base, name: 'A2', vendor: 'Atlassian', ownerDepartment: Department.DESIGN, monthlyCost: 30, activeUsersCount: 5 },
      { ...base, name: 'Z1', vendor: 'Ghosty', ownerDepartment: Department.HR, monthlyCost: 40, activeUsersCount: 0 },
      { ...base, name: 'M1', vendor: 'Mid Vendor', ownerDepartment: Department.FINANCE, monthlyCost: 150, activeUsersCount: 10 },
      { ...base, name: 'R1', vendor: 'Retired Vendor', ownerDepartment: Department.ENGINEERING, monthlyCost: 999, activeUsersCount: 5, status: ToolStatus.DEPRECATED },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('agrège les outils actifs par vendor avec efficacité et insights', async () => {
    const res = await api().get('/api/analytics/vendor-summary').expect(200);

    expect(res.body).toEqual({
      data: [
        { vendor: 'BigCorp', tools_count: 1, total_monthly_cost: 300, total_users: 10, departments: 'Sales', average_cost_per_user: 30, vendor_efficiency: 'poor' },
        { vendor: 'Google', tools_count: 4, total_monthly_cost: 234.5, total_users: 67, departments: 'Engineering,Marketing,Sales', average_cost_per_user: 3.5, vendor_efficiency: 'excellent' },
        { vendor: 'Mid Vendor', tools_count: 1, total_monthly_cost: 150, total_users: 10, departments: 'Finance', average_cost_per_user: 15, vendor_efficiency: 'average' },
        { vendor: 'Atlassian', tools_count: 2, total_monthly_cost: 80, total_users: 10, departments: 'Design,Engineering', average_cost_per_user: 8, vendor_efficiency: 'good' },
        { vendor: 'Ghosty', tools_count: 1, total_monthly_cost: 40, total_users: 0, departments: 'HR', average_cost_per_user: null, vendor_efficiency: 'poor' },
      ],
      vendor_insights: { most_expensive_vendor: 'BigCorp', most_efficient_vendor: 'Google', single_tool_vendors: 3 },
    });
  });

  it('ignore les vendors qui n\'ont que des outils non actifs', async () => {
    const res = await api().get('/api/analytics/vendor-summary').expect(200);

    expect(res.body.data.map((d: { vendor: string }) => d.vendor)).not.toContain('Retired Vendor');
    expect(res.body.vendor_insights.single_tool_vendors).toBe(3);
  });

  it('concatène les départements uniques par ordre alphabétique', async () => {
    const res = await api().get('/api/analytics/vendor-summary').expect(200);
    const google = res.body.data.find((d: { vendor: string }) => d.vendor === 'Google');

    expect(google.departments).toBe('Engineering,Marketing,Sales'); // un tri SQL sur l'ENUM donnerait Engineering,Sales,Marketing
  });
});