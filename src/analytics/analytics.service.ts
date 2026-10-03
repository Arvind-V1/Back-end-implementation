import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department, Tool, ToolStatus } from '../tools/entities/tool.entity';
import { buildDepartmentCosts } from './department-costs.util';
import { QueryDepartmentCostsDto } from './dto/query-department-costs.dto';

@Injectable()
export class AnalyticsService {
  constructor(@InjectRepository(Tool) private readonly toolsRepo: Repository<Tool>) {}

  async getDepartmentCosts(query: QueryDepartmentCostsDto) {
    const rows = await this.toolsRepo
      .createQueryBuilder('tool')
      .select('tool.ownerDepartment', 'department')
      .addSelect('SUM(tool.monthlyCost * tool.activeUsersCount)', 'total_cost')
      .addSelect('COUNT(tool.id)', 'tools_count')
      .addSelect('SUM(tool.activeUsersCount)', 'total_users')
      .where('tool.status = :status', { status: ToolStatus.ACTIVE })
      .groupBy('tool.ownerDepartment')
      .getRawMany();

    return buildDepartmentCosts(rows, Object.values(Department), query.sort_by, query.order);
  }
}