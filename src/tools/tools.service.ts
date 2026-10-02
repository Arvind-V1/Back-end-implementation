import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateToolDto } from './dto/create-tool.dto';
import { UpdateToolDto } from './dto/update-tool.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Not, Repository } from 'typeorm';
import { QueryToolsDto } from './dto/query-tools.dto';
import { Tool, ToolStatus } from './entities/tool.entity';
import { UsageLog } from './entities/usage-log.entity';
import { Category } from './entities/category.entity';

@Injectable()
export class ToolsService {
  constructor(
    @InjectRepository(Tool) private readonly toolsRepo: Repository<Tool>,
    @InjectRepository(UsageLog) private readonly usageRepo: Repository<UsageLog>,
    @InjectRepository(Category) private readonly categoriesRepo: Repository<Category>,) { }

  private toListItem(t: Tool) {
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      vendor: t.vendor,
      category: t.category.name,
      monthly_cost: t.monthlyCost,
      owner_department: t.ownerDepartment,
      status: t.status,
      website_url: t.websiteUrl,
      active_users_count: t.activeUsersCount,
      created_at: t.createdAt,
    };
  }

  private toolNotFound(id: number) {
  return new NotFoundException({
    error: 'Tool not found',
    message: `Tool with ID ${id} does not exist`,
  });
}

  async create(dto: CreateToolDto) {
    const category = await this.categoriesRepo.findOneBy({ id: dto.category_id });
    if (!category) {
      throw new BadRequestException(`La catégorie #${dto.category_id} n'existe pas`);
    }

    if (await this.toolsRepo.existsBy({ name: dto.name })) {
      throw new ConflictException(`Un outil nommé "${dto.name}" existe déjà`);
    }

    const saved = await this.toolsRepo.save(
      this.toolsRepo.create({
        name: dto.name,
        description: dto.description ?? null,
        vendor: dto.vendor,
        websiteUrl: dto.website_url ?? null,
        category,
        monthlyCost: dto.monthly_cost,
        ownerDepartment: dto.owner_department,
        status: ToolStatus.ACTIVE,
        activeUsersCount: 0,
      }),
    );

    return { ...this.toListItem(saved), updated_at: saved.updatedAt };
  }

  async findAll(query: QueryToolsDto) {
    const {
      department, status, category, min_cost, max_cost,
      page = 1, limit = 20, sort_by = 'created_at', order = 'desc',
    } = query;

    if (min_cost !== undefined && max_cost !== undefined && min_cost > max_cost) {
      throw new BadRequestException('min_cost ne peut pas être supérieur à max_cost');
    }

    const qb = this.toolsRepo.createQueryBuilder('tool').leftJoinAndSelect('tool.category', 'category');
    if (department) qb.andWhere('tool.ownerDepartment = :department', { department });
    if (status) qb.andWhere('tool.status = :status', { status });
    if (category) qb.andWhere('category.name = :category', { category });
    if (min_cost !== undefined) qb.andWhere('tool.monthlyCost >= :min_cost', { min_cost });
    if (max_cost !== undefined) qb.andWhere('tool.monthlyCost <= :max_cost', { max_cost });

    const sortColumns = {
      name: 'tool.name',
      monthly_cost: 'tool.monthlyCost',
      created_at: 'tool.createdAt',
    };
    qb.orderBy(sortColumns[sort_by], order.toUpperCase() as 'ASC' | 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [tools, filtered] = await qb.getManyAndCount();
    const total = await this.toolsRepo.count();

    const filters_applied = Object.fromEntries(
      Object.entries({ department, status, category, min_cost, max_cost })
        .filter(([, v]) => v !== undefined),
    );

    return {
      data: tools.map((t) => this.toListItem(t)),
      total,
      filtered,
      filters_applied,
      page,
      limit,
    };
  }

  async findOne(id: number) {
    const tool = await this.toolsRepo.findOne({ where: { id }, relations: { category: true } });
    if (!tool) throw this.toolNotFound(id);

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const stats = await this.usageRepo
      .createQueryBuilder('log')
      .select('COUNT(*)', 'sessions')
      .addSelect('AVG(log.durationMinutes)', 'avg_minutes')
      .where('log.toolId = :id', { id })
      .andWhere('log.sessionDate >= :since', { since })
      .getRawOne();

    return {
      ...this.toListItem(tool),
      total_monthly_cost: Math.round(tool.monthlyCost * tool.activeUsersCount * 100) / 100,
      updated_at: tool.updatedAt,
      usage_metrics: {
        last_30_days: {
          total_sessions: Number(stats.sessions),
          avg_session_minutes: Math.round(Number(stats.avg_minutes ?? 0)),
        },
      },
    };
  }

  async update(id: number, dto: UpdateToolDto) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Aucun champ à modifier');
    }

    const tool = await this.toolsRepo.findOne({ where: { id }, relations: { category: true } });
    if (!tool) throw this.toolNotFound(id);

    if (dto.name != null && dto.name !== tool.name) {
      const taken = await this.toolsRepo.existsBy({ name: dto.name, id: Not(id) });
      if (taken) {
        throw new ConflictException(`Un outil nommé "${dto.name}" existe déjà`);
      }
      tool.name = dto.name;
    }

    if (dto.category_id != null) {
      const category = await this.categoriesRepo.findOneBy({ id: dto.category_id });
      if (!category) {
        throw new BadRequestException(`La catégorie #${dto.category_id} n'existe pas`);
      }
      tool.category = category;
    }

    if (dto.vendor != null) tool.vendor = dto.vendor;
    if (dto.monthly_cost != null) tool.monthlyCost = dto.monthly_cost;
    if (dto.owner_department != null) tool.ownerDepartment = dto.owner_department;
    if (dto.status != null) tool.status = dto.status;
    if (dto.description !== undefined) tool.description = dto.description;
    if (dto.website_url !== undefined) tool.websiteUrl = dto.website_url;

    await this.toolsRepo.save(tool);

    const updated = await this.toolsRepo.findOneOrFail({ where: { id }, relations: { category: true } });
    return { ...this.toListItem(updated), updated_at: updated.updatedAt };
  }
  remove(id: number) {
    return `This action removes a #${id} tool`;
  }
}
