import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { configureApp } from '../app.setup';
import { Category } from '../tools/entities/category.entity';
import { Tool } from '../tools/entities/tool.entity';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { NO_DATA_MESSAGE } from './no-data.util';

// QueryBuilder simulé : chaque méthode renvoie le builder pour permettre le chaînage
const makeQb = (rows: unknown[]) => {
  const qb: Record<string, jest.Mock> = {};
  for (const method of ['select', 'addSelect', 'where', 'groupBy', 'addGroupBy', 'innerJoin']) {
    qb[method] = jest.fn().mockReturnValue(qb);
  }
  qb.getRawMany = jest.fn().mockResolvedValue(rows);
  return qb;
};

const aTool = { id: 1, name: 'Slack', monthlyCost: 10, activeUsersCount: 2, ownerDepartment: 'Engineering', vendor: 'Slack Technologies' };

// Format "aucune donnée" attendu pour chaque endpoint quand aucun outil actif n'existe
const EMPTY_RESPONSES: [string, object][] = [
  ['department-costs', { summary: { total_company_cost: 0, departments_count: 0, most_expensive_department: null } }],
  ['expensive-tools', { analysis: { total_tools_analyzed: 0, avg_cost_per_user_company: 0, potential_savings_identified: 0 } }],
  ['tools-by-category', { insights: { most_expensive_category: null, most_efficient_category: null } }],
  ['low-usage-tools', { savings_analysis: { total_underutilized_tools: 0, potential_monthly_savings: 0, potential_annual_savings: 0 } }],
  ['vendor-summary', { vendor_insights: { most_expensive_vendor: null, most_efficient_vendor: null, single_tool_vendors: 0 } }],
];

describe('Analytics : erreurs et absence de données (HTTP, repositories simulés)', () => {
  let app: INestApplication;
  const toolsRepo = { find: jest.fn(), createQueryBuilder: jest.fn() };
  const categoriesRepo = { find: jest.fn() };
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(Tool), useValue: toolsRepo },
        { provide: getRepositoryToken(Category), useValue: categoriesRepo },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    toolsRepo.find.mockReset().mockResolvedValue([]);
    toolsRepo.createQueryBuilder.mockReset().mockReturnValue(makeQb([]));
    categoriesRepo.find.mockReset().mockResolvedValue([{ id: 1, name: 'Development' }]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('paramètres invalides (400)', () => {
    it('limit=-5 : format "Invalid analytics parameter" du sujet', async () => {
      const res = await api().get('/api/analytics/expensive-tools?limit=-5').expect(400);

      expect(res.body).toEqual({
        error: 'Invalid analytics parameter',
        details: { limit: 'Must be positive integer between 1 and 100' },
      });
    });

    it.each([
      ['/api/analytics/expensive-tools?limit=0', 'limit'],
      ['/api/analytics/expensive-tools?limit=101', 'limit'],
      ['/api/analytics/expensive-tools?limit=abc', 'limit'],
      ['/api/analytics/expensive-tools?min_cost=-1', 'min_cost'],
      ['/api/analytics/department-costs?sort_by=foo', 'sort_by'],
      ['/api/analytics/department-costs?order=up', 'order'],
      ['/api/analytics/low-usage-tools?max_users=-1', 'max_users'],
      ['/api/analytics/low-usage-tools?max_users=1.5', 'max_users'],
    ])('%s : 400 sur le paramètre %s', async (url, field) => {
      const res = await api().get(url).expect(400);

      expect(res.body.error).toBe('Invalid analytics parameter');
      expect(Object.keys(res.body.details)).toEqual([field]);
    });
  });

  describe('aucune donnée analytics (200 avec message)', () => {
    it.each(EMPTY_RESPONSES)('%s : data vide, message et synthèse à zéro', async (route, expectedAnalysis) => {
      const res = await api().get(`/api/analytics/${route}`).expect(200);

      expect(res.body).toEqual({ data: [], message: NO_DATA_MESSAGE, ...expectedAnalysis });
    });

    it('department-costs : le message exact du sujet', async () => {
      const res = await api().get('/api/analytics/department-costs').expect(200);

      expect(res.body.message).toBe('No analytics data available - ensure tools data exists');
      expect(res.body.summary.total_company_cost).toBe(0);
    });

    it("pas de message quand des outils existent mais qu'un filtre n'en retient aucun", async () => {
      toolsRepo.find.mockResolvedValue([aTool]);

      const res = await api().get('/api/analytics/expensive-tools?min_cost=1000').expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body).not.toHaveProperty('message');
      expect(res.body.analysis.total_tools_analyzed).toBe(0);
    });

    it('pas de message quand des données existent (department-costs)', async () => {
      toolsRepo.createQueryBuilder.mockReturnValue(
        makeQb([{ department: 'Engineering', total_cost: '30.50', tools_count: '2', total_users: '8' }]),
      );

      const res = await api().get('/api/analytics/department-costs').expect(200);

      expect(res.body.data).toHaveLength(7);
      expect(res.body).not.toHaveProperty('message');
      expect(res.body.summary.most_expensive_department).toBe('Engineering');
    });
  });

  describe('erreur serveur (500)', () => {
    it('renvoie "Database connection failed" quand la base est injoignable', async () => {
      toolsRepo.find.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }));

      const res = await api().get('/api/analytics/expensive-tools').expect(500);

      expect(res.body).toEqual({ error: 'Internal server error', message: 'Database connection failed' });
    });

    it('renvoie la même 500 quand une requête agrégée échoue', async () => {
      toolsRepo.createQueryBuilder.mockImplementation(() => {
        throw Object.assign(new Error('Connection lost'), { code: 'PROTOCOL_CONNECTION_LOST' });
      });

      const res = await api().get('/api/analytics/department-costs').expect(500);

      expect(res.body).toEqual({ error: 'Internal server error', message: 'Database connection failed' });
    });
  });
});