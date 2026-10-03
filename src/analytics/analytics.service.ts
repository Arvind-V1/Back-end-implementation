import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department, Tool, ToolStatus } from '../tools/entities/tool.entity';
import { buildDepartmentCosts } from './department-costs.util';
import { QueryDepartmentCostsDto } from './dto/query-department-costs.dto';
import { buildExpensiveTools } from './expensive-tools.util';
import { QueryExpensiveToolsDto } from './dto/query-expensive-tools.dto';

@Injectable()
export class AnalyticsService {
  constructor(@InjectRepository(Tool) private readonly toolsRepo: Repository<Tool>) {}

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

    return buildDepartmentCosts(rows, Object.values(Department), query.sort_by, query.order);
  }

  async getExpensiveTools(query: QueryExpensiveToolsDto) {
  // Quelques centaines d'outils au plus : on charge les outils actifs et on calcule en mémoire
  const tools = await this.toolsRepo.find({ where: { status: ToolStatus.ACTIVE } });
  return buildExpensiveTools(tools, { minCost: query.min_cost, limit: query.limit });
}
}