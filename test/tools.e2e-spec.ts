import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { Category } from '../src/tools/entities/category.entity';
import { Department, Tool, ToolStatus } from '../src/tools/entities/tool.entity';
import { UsageLog } from '../src/tools/entities/usage-log.entity';

jest.setTimeout(30000);

const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Les describe s'exécutent dans l'ordre : les lectures passent avant les écritures (POST/PUT).
describe('Tools API (e2e)', () => {
  let app: INestApplication;
  let github: Tool;
  let slack: Tool;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    const ds = app.get(DataSource);
    await ds.synchronize(true); // repart de tables vides dans la base de test

    const [comm, dev, design] = await ds
      .getRepository(Category)
      .save([{ name: 'Communication' }, { name: 'Development' }, { name: 'Design' }]);

    const tools = await ds.getRepository(Tool).save([
      { name: 'Slack', description: 'Team messaging', vendor: 'Slack Technologies', category: comm, monthlyCost: 8, ownerDepartment: Department.ENGINEERING, status: ToolStatus.ACTIVE, websiteUrl: 'https://slack.com', activeUsersCount: 25 },
      { name: 'GitHub', description: 'Code hosting', vendor: 'GitHub Inc.', category: dev, monthlyCost: 21, ownerDepartment: Department.ENGINEERING, status: ToolStatus.ACTIVE, websiteUrl: 'https://github.com', activeUsersCount: 18 },
      { name: 'Figma', description: 'Design collaboration', vendor: 'Figma Inc.', category: design, monthlyCost: 15, ownerDepartment: Department.DESIGN, status: ToolStatus.ACTIVE, websiteUrl: 'https://figma.com', activeUsersCount: 8 },
      { name: 'Trello', description: 'Kanban boards', vendor: 'Atlassian', category: dev, monthlyCost: 10, ownerDepartment: Department.OPERATIONS, status: ToolStatus.DEPRECATED, websiteUrl: 'https://trello.com', activeUsersCount: 3 },
    ]);
    slack = tools[0];
    github = tools[1];

    // 3 sessions dans les 30 derniers jours (moyenne 60 min) + 1 session hors fenêtre
    await ds.getRepository(UsageLog).save([
      { tool: github, userId: 1, sessionDate: daysAgo(2), durationMinutes: 30 },
      { tool: github, userId: 2, sessionDate: daysAgo(10), durationMinutes: 60 },
      { tool: github, userId: 3, sessionDate: daysAgo(20), durationMinutes: 90 },
      { tool: github, userId: 4, sessionDate: daysAgo(60), durationMinutes: 45 },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/tools', () => {
    it('liste tous les outils avec total et filtered', async () => {
      const res = await api().get('/api/tools').expect(200);

      expect(res.body.total).toBe(4);
      expect(res.body.filtered).toBe(4);
      expect(res.body.data).toHaveLength(4);
      expect(res.body.filters_applied).toEqual({});
      expect(res.body.data[0]).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          name: expect.any(String),
          category: expect.any(String),
          monthly_cost: expect.any(Number),
          owner_department: expect.any(String),
          status: expect.any(String),
        }),
      );
    });

    it('combine plusieurs filtres', async () => {
      const res = await api().get('/api/tools?department=Engineering&status=active').expect(200);

      expect(res.body.filtered).toBe(2);
      expect(res.body.total).toBe(4);
      expect(res.body.filters_applied).toEqual({ department: 'Engineering', status: 'active' });
      expect(res.body.data.map((t: { name: string }) => t.name).sort()).toEqual(['GitHub', 'Slack']);
    });

    it('filtre par fourchette de coût (bornes incluses) et par catégorie', async () => {
      const res = await api().get('/api/tools?category=Development&min_cost=10&max_cost=50').expect(200);

      expect(res.body.data.map((t: { name: string }) => t.name).sort()).toEqual(['GitHub', 'Trello']);
      expect(res.body.filters_applied).toEqual({ category: 'Development', min_cost: 10, max_cost: 50 });
    });

    it('trie par coût croissant', async () => {
      const res = await api().get('/api/tools?sort_by=monthly_cost&order=asc').expect(200);

      expect(res.body.data.map((t: { monthly_cost: number }) => t.monthly_cost)).toEqual([8, 10, 15, 21]);
    });

    it('pagine les résultats', async () => {
      const res = await api().get('/api/tools?sort_by=name&order=asc&page=2&limit=2').expect(200);

      expect(res.body.data.map((t: { name: string }) => t.name)).toEqual(['Slack', 'Trello']);
      expect(res.body.filtered).toBe(4);
      expect(res.body.page).toBe(2);
      expect(res.body.limit).toBe(2);
    });

    it('renvoie 200 avec une liste vide quand aucun outil ne correspond', async () => {
      const res = await api().get('/api/tools?department=Legal').expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.filtered).toBe(0);
      expect(res.body.total).toBe(4);
    });

    it('refuse un statut invalide (400)', async () => {
      const res = await api().get('/api/tools?status=archived').expect(400);

      expect(res.body.error).toBe('Validation failed');
      expect(res.body.details.status).toBeDefined();
    });

    it('refuse min_cost > max_cost (400)', async () => {
      await api().get('/api/tools?min_cost=50&max_cost=10').expect(400);
    });
  });

  describe('GET /api/tools/:id', () => {
    it('renvoie le détail avec total_monthly_cost et usage_metrics', async () => {
      const res = await api().get(`/api/tools/${github.id}`).expect(200);

      expect(res.body).toMatchObject({
        id: github.id,
        name: 'GitHub',
        category: 'Development',
        monthly_cost: 21,
        active_users_count: 18,
        total_monthly_cost: 378,
        usage_metrics: { last_30_days: { total_sessions: 3, avg_session_minutes: 60 } },
      });
      expect(res.body.created_at).toBeDefined();
      expect(res.body.updated_at).toBeDefined();
    });

    it('renvoie des métriques à 0 pour un outil sans session', async () => {
      const res = await api().get(`/api/tools/${slack.id}`).expect(200);

      expect(res.body.usage_metrics.last_30_days).toEqual({ total_sessions: 0, avg_session_minutes: 0 });
    });

    it('renvoie 404 au format du sujet pour un outil inexistant', async () => {
      const res = await api().get('/api/tools/99999').expect(404);

      expect(res.body).toEqual({ error: 'Tool not found', message: 'Tool with ID 99999 does not exist' });
    });

    it('renvoie 400 pour un ID non numérique', async () => {
      await api().get('/api/tools/abc').expect(400);
    });
  });

  describe('POST /api/tools', () => {
    const validBody = {
      name: 'Linear',
      description: 'Issue tracking and project management',
      vendor: 'Linear',
      website_url: 'https://linear.app',
      category_id: 2,
      monthly_cost: 8.0,
      owner_department: 'Engineering',
    };

    it('crée un outil (201) avec statut active et 0 utilisateur actif', async () => {
      const res = await api().post('/api/tools').send(validBody).expect(201);

      expect(res.body).toMatchObject({
        name: 'Linear',
        vendor: 'Linear',
        category: 'Development',
        monthly_cost: 8,
        owner_department: 'Engineering',
        status: 'active',
        active_users_count: 0,
      });
      expect(res.body.id).toEqual(expect.any(Number));
      expect(res.body.created_at).toBeDefined();
      expect(res.body.updated_at).toBeDefined();

      await api().get(`/api/tools/${res.body.id}`).expect(200);
    });

    it('ignore les champs non autorisés (status, active_users_count)', async () => {
      const res = await api()
        .post('/api/tools')
        .send({ ...validBody, name: 'Linear Pro', status: 'deprecated', active_users_count: 100 })
        .expect(201);

      expect(res.body.status).toBe('active');
      expect(res.body.active_users_count).toBe(0);
    });

    it('renvoie 400 avec le détail des champs invalides', async () => {
      const res = await api()
        .post('/api/tools')
        .send({ ...validBody, name: 'L', monthly_cost: -1, website_url: 'nope' })
        .expect(400);

      expect(res.body.error).toBe('Validation failed');
      expect(Object.keys(res.body.details).sort()).toEqual(['monthly_cost', 'name', 'website_url']);
    });

    it('refuse un coût avec plus de 2 décimales', async () => {
      const res = await api().post('/api/tools').send({ ...validBody, name: 'Decimals', monthly_cost: 8.123 }).expect(400);

      expect(res.body.details.monthly_cost).toBeDefined();
    });

    it('refuse un département hors enum', async () => {
      const res = await api().post('/api/tools').send({ ...validBody, name: 'Dept', owner_department: 'Legal' }).expect(400);

      expect(res.body.details.owner_department).toBeDefined();
    });

    it('refuse un vendor manquant', async () => {
      const { vendor, ...withoutVendor } = validBody;
      const res = await api().post('/api/tools').send({ ...withoutVendor, name: 'NoVendor' }).expect(400);

      expect(res.body.details.vendor).toBeDefined();
    });

    it('refuse une catégorie inexistante (400)', async () => {
      const res = await api().post('/api/tools').send({ ...validBody, name: 'BadCat', category_id: 999 }).expect(400);

      expect(res.body.message).toContain('999');
    });

    it('refuse un nom déjà utilisé (409)', async () => {
      await api().post('/api/tools').send({ ...validBody, name: 'Slack' }).expect(409);
    });
  });

  describe('PUT /api/tools/:id', () => {
    it('met à jour uniquement les champs fournis', async () => {
      const before = (await api().get(`/api/tools/${github.id}`).expect(200)).body;
      await sleep(20);

      const res = await api()
        .put(`/api/tools/${github.id}`)
        .send({ monthly_cost: 7, status: 'deprecated', description: 'Updated description after renewal' })
        .expect(200);

      expect(res.body).toMatchObject({
        id: github.id,
        name: 'GitHub',
        vendor: 'GitHub Inc.',
        category: 'Development',
        monthly_cost: 7,
        status: 'deprecated',
        description: 'Updated description after renewal',
        owner_department: 'Engineering',
        active_users_count: 18,
      });
      expect(new Date(res.body.updated_at).getTime()).toBeGreaterThan(new Date(before.updated_at).getTime());
      expect(res.body.created_at).toBe(before.created_at);
    });

    it('permet de vider la description avec null', async () => {
      const res = await api().put(`/api/tools/${github.id}`).send({ description: null }).expect(200);

      expect(res.body.description).toBeNull();
    });

    it('renvoie 404 pour un outil inexistant', async () => {
      const res = await api().put('/api/tools/99999').send({ monthly_cost: 7 }).expect(404);

      expect(res.body.error).toBe('Tool not found');
    });

    it('renvoie 400 pour un ID non numérique', async () => {
      await api().put('/api/tools/abc').send({ monthly_cost: 7 }).expect(400);
    });

    it('renvoie 400 pour un body vide', async () => {
      await api().put(`/api/tools/${github.id}`).send({}).expect(400);
    });

    it('applique les mêmes validations que le POST', async () => {
      const res = await api().put(`/api/tools/${github.id}`).send({ status: 'archived', monthly_cost: -5 }).expect(400);

      expect(res.body.details.status).toBeDefined();
      expect(res.body.details.monthly_cost).toBeDefined();
    });

    it('refuse de renommer vers un nom déjà pris (409)', async () => {
      await api().put(`/api/tools/${github.id}`).send({ name: 'Slack' }).expect(409);
    });
  });
});