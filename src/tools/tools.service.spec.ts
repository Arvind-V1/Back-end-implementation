import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { Department, Tool, ToolStatus } from './entities/tool.entity';
import { UsageLog } from './entities/usage-log.entity';
import { ToolsService } from './tools.service';

const makeTool = (overrides: Partial<Tool> = {}): Tool =>
  ({
    id: 5,
    name: 'Confluence',
    description: 'Team collaboration and documentation',
    vendor: 'Atlassian',
    category: { id: 2, name: 'Development' },
    monthlyCost: 5.5,
    ownerDepartment: Department.ENGINEERING,
    status: ToolStatus.ACTIVE,
    websiteUrl: 'https://confluence.atlassian.com',
    activeUsersCount: 9,
    createdAt: new Date('2025-05-01T09:00:00Z'),
    updatedAt: new Date('2025-05-01T09:00:00Z'),
    ...overrides,
  }) as Tool;

// QueryBuilder simulé : chaque méthode renvoie le builder pour permettre le chaînage
const makeListQb = (result: [Tool[], number]) => ({
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue(result),
});

const makeStatsQb = (raw: { sessions: string; avg_minutes: string | null }) => ({
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getRawOne: jest.fn().mockResolvedValue(raw),
});

describe('ToolsService', () => {
  let service: ToolsService;
  let toolsRepo: Record<string, jest.Mock>;
  let usageRepo: { createQueryBuilder: jest.Mock };
  let categoriesRepo: { findOneBy: jest.Mock };

  beforeEach(async () => {
    toolsRepo = {
      createQueryBuilder: jest.fn(),
      count: jest.fn(),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      existsBy: jest.fn(),
      save: jest.fn(),
      create: jest.fn((x) => x),
    };
    usageRepo = { createQueryBuilder: jest.fn() };
    categoriesRepo = { findOneBy: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ToolsService,
        { provide: getRepositoryToken(Tool), useValue: toolsRepo },
        { provide: getRepositoryToken(UsageLog), useValue: usageRepo },
        { provide: getRepositoryToken(Category), useValue: categoriesRepo },
      ],
    }).compile();

    service = moduleRef.get(ToolsService);
  });

  describe('findAll', () => {
    it('renvoie les outils mappés avec total, filtered et filters_applied', async () => {
      const qb = makeListQb([[makeTool()], 1]);
      toolsRepo.createQueryBuilder.mockReturnValue(qb);
      toolsRepo.count.mockResolvedValue(20);

      const result = await service.findAll({ department: 'Engineering', status: ToolStatus.ACTIVE });

      expect(result.total).toBe(20);
      expect(result.filtered).toBe(1);
      expect(result.filters_applied).toEqual({ department: 'Engineering', status: 'active' });
      expect(result.data[0]).toMatchObject({
        id: 5,
        name: 'Confluence',
        category: 'Development',
        monthly_cost: 5.5,
        owner_department: 'Engineering',
      });
      expect(qb.andWhere).toHaveBeenCalledTimes(2);
    });

    it('renvoie une liste vide quand aucun outil ne correspond', async () => {
      toolsRepo.createQueryBuilder.mockReturnValue(makeListQb([[], 0]));
      toolsRepo.count.mockResolvedValue(20);

      const result = await service.findAll({ department: 'Legal' });

      expect(result.data).toEqual([]);
      expect(result.filtered).toBe(0);
      expect(result.total).toBe(20);
    });

    it('applique les valeurs de pagination par défaut puis personnalisées', async () => {
      const qb = makeListQb([[], 0]);
      toolsRepo.createQueryBuilder.mockReturnValue(qb);
      toolsRepo.count.mockResolvedValue(0);

      await service.findAll({});
      expect(qb.skip).toHaveBeenLastCalledWith(0);
      expect(qb.take).toHaveBeenLastCalledWith(20);

      await service.findAll({ page: 3, limit: 10 });
      expect(qb.skip).toHaveBeenLastCalledWith(20);
      expect(qb.take).toHaveBeenLastCalledWith(10);
    });

    it('refuse min_cost supérieur à max_cost', async () => {
      await expect(service.findAll({ min_cost: 50, max_cost: 10 })).rejects.toBeInstanceOf(BadRequestException);
      expect(toolsRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('lève une 404 si l\'outil n\'existe pas', async () => {
      toolsRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('calcule total_monthly_cost et expose les métriques des 30 derniers jours', async () => {
      toolsRepo.findOne.mockResolvedValue(makeTool());
      usageRepo.createQueryBuilder.mockReturnValue(makeStatsQb({ sessions: '127', avg_minutes: '45.4' }));

      const result = await service.findOne(5);

      expect(result.total_monthly_cost).toBe(49.5);
      expect(result.usage_metrics.last_30_days).toEqual({ total_sessions: 127, avg_session_minutes: 45 });
    });

    it('renvoie des métriques à 0 quand il n\'y a aucune session', async () => {
      toolsRepo.findOne.mockResolvedValue(makeTool());
      usageRepo.createQueryBuilder.mockReturnValue(makeStatsQb({ sessions: '0', avg_minutes: null }));

      const result = await service.findOne(5);

      expect(result.usage_metrics.last_30_days).toEqual({ total_sessions: 0, avg_session_minutes: 0 });
    });

    it('arrondit total_monthly_cost à 2 décimales', async () => {
      toolsRepo.findOne.mockResolvedValue(makeTool({ monthlyCost: 8.33, activeUsersCount: 3 }));
      usageRepo.createQueryBuilder.mockReturnValue(makeStatsQb({ sessions: '0', avg_minutes: null }));

      const result = await service.findOne(5);

      expect(result.total_monthly_cost).toBe(24.99);
    });
  });

  describe('create', () => {
    const dto = {
      name: 'Linear',
      description: 'Issue tracking and project management',
      vendor: 'Linear',
      website_url: 'https://linear.app',
      category_id: 2,
      monthly_cost: 8,
      owner_department: Department.ENGINEERING,
    };

    it('refuse une catégorie inexistante', async () => {
      categoriesRepo.findOneBy.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(toolsRepo.save).not.toHaveBeenCalled();
    });

    it('refuse un nom déjà utilisé (409)', async () => {
      categoriesRepo.findOneBy.mockResolvedValue({ id: 2, name: 'Development' });
      toolsRepo.existsBy.mockResolvedValue(true);

      await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
      expect(toolsRepo.save).not.toHaveBeenCalled();
    });

    it('crée l\'outil avec le statut active et 0 utilisateur actif', async () => {
      const now = new Date('2025-08-20T14:30:00Z');
      categoriesRepo.findOneBy.mockResolvedValue({ id: 2, name: 'Development' });
      toolsRepo.existsBy.mockResolvedValue(false);
      toolsRepo.save.mockImplementation(async (t) => ({ ...t, id: 21, createdAt: now, updatedAt: now }));

      const result = await service.create(dto);

      expect(toolsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active', activeUsersCount: 0, monthlyCost: 8 }),
      );
      expect(result).toMatchObject({
        id: 21,
        name: 'Linear',
        category: 'Development',
        status: 'active',
        active_users_count: 0,
        updated_at: now,
      });
    });
  });

  describe('update', () => {
    it('refuse un body vide', async () => {
      await expect(service.update(5, {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lève une 404 si l\'outil n\'existe pas', async () => {
      toolsRepo.findOne.mockResolvedValue(null);
      await expect(service.update(999, { monthly_cost: 7 })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuse un nom déjà pris par un autre outil (409)', async () => {
      toolsRepo.findOne.mockResolvedValue(makeTool());
      toolsRepo.existsBy.mockResolvedValue(true);

      await expect(service.update(5, { name: 'Slack' })).rejects.toBeInstanceOf(ConflictException);
      expect(toolsRepo.save).not.toHaveBeenCalled();
    });

    it('ne modifie que les champs fournis', async () => {
      const updatedAt = new Date('2025-08-20T15:45:00Z');
      toolsRepo.findOne.mockResolvedValue(makeTool());
      toolsRepo.save.mockResolvedValue(undefined);
      toolsRepo.findOneOrFail.mockResolvedValue(
        makeTool({ monthlyCost: 7, status: ToolStatus.DEPRECATED, updatedAt }),
      );

      const result = await service.update(5, { monthly_cost: 7, status: ToolStatus.DEPRECATED });

      expect(toolsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          monthlyCost: 7,
          status: 'deprecated',
          name: 'Confluence',
          vendor: 'Atlassian',
          activeUsersCount: 9,
        }),
      );
      expect(result).toMatchObject({ monthly_cost: 7, status: 'deprecated', name: 'Confluence', updated_at: updatedAt });
    });
  });
});