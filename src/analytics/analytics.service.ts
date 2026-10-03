import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../tools/entities/category.entity';
import { Department, Tool, ToolStatus } from '../tools/entities/tool.entity';
import { buildDepartmentCosts } from './department-costs.util';
import { QueryDepartmentCostsDto } from './dto/query-department-costs.dto';
import { QueryExpensiveToolsDto } from './dto/query-expensive-tools.dto';
import { QueryLowUsageToolsDto } from './dto/query-low-usage-tools.dto';
import { buildExpensiveTools } from './expensive-tools.util';
import { buildLowUsageTools } from './low-usage-tools.util';
import { withNoDataNotice } from './no-data.util';
import { buildToolsByCategory } from './tools-by-category.util';
import { buildVendorSummary } from './vendor-summary.util';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Tool) private readonly toolsRepo: Repository<Tool>,
    @InjectRepository(Category) private readonly categoriesRepo: Repository<Category>,
  ) {}

  async getDepartmentCosts(query: QueryDepartmentCostsDto) {
    const rows = await this.toolsRepo
      .createQueryBuilder('tool')
      .select('tool.ownerDepartment', 'department')
      .addSelect('SUM(tool.monthlyCost)', 'total_cost')
      .addSelect('COUNT(tool.id)', 'tools_count')
      .addSelect('SUM(tool.activeUsersCount)', 'total_users')
      .where('tool.status = :status', { status: ToolStatus.ACTIVE })
      .groupBy('tool.ownerDepartment')
      .getRawMany();

    const isEmpty = rows.length === 0; // aucun outil actif : aucune donnée analytics
    const result = buildDepartmentCosts(rows, isEmpty ? [] : Object.values(Department), query.sort_by, query.order);
    return withNoDataNotice(result, isEmpty);
  }

  async getExpensiveTools(query: QueryExpensiveToolsDto) {
    const tools = await this.toolsRepo.find({ where: { status: ToolStatus.ACTIVE } });
    const result = buildExpensiveTools(tools, { minCost: query.min_cost, limit: query.limit });
    return withNoDataNotice(result, tools.length === 0);
  }

  async getToolsByCategory() {
    const [categories, rows] = await Promise.all([
      this.categoriesRepo.find(),
      this.toolsRepo
        .createQueryBuilder('tool')
        .innerJoin('tool.category', 'category')
        .select('category.name', 'category_name')
        .addSelect('COUNT(tool.id)', 'tools_count')
        .addSelect('SUM(tool.monthlyCost)', 'total_cost')
        .addSelect('SUM(tool.activeUsersCount)', 'total_users')
        .where('tool.status = :status', { status: ToolStatus.ACTIVE })
        .groupBy('category.id')
        .addGroupBy('category.name')
        .getRawMany(),
    ]);

    const isEmpty = rows.length === 0;
    const result = buildToolsByCategory(rows, isEmpty ? [] : categories.map((c) => c.name));
    return withNoDataNotice(result, isEmpty);
  }

  async getLowUsageTools(query: QueryLowUsageToolsDto) {
    const tools = await this.toolsRepo.find({ where: { status: ToolStatus.ACTIVE } });
    const result = buildLowUsageTools(tools, { maxUsers: query.max_users });
    return withNoDataNotice(result, tools.length === 0);
  }

  async getVendorSummary() {
    const tools = await this.toolsRepo.find({ where: { status: ToolStatus.ACTIVE } });
    return withNoDataNotice(buildVendorSummary(tools), tools.length === 0);
  }
}