import { IsIn, IsOptional } from 'class-validator';

export class QueryDepartmentCostsDto {
  @IsOptional()
  @IsIn(['total_cost', 'department', 'tools_count', 'total_users'], {
    message: 'Must be one of: total_cost, department, tools_count, total_users',
  })
  sort_by?: 'total_cost' | 'department' | 'tools_count' | 'total_users';

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'Must be one of: asc, desc' })
  order?: 'asc' | 'desc';
}