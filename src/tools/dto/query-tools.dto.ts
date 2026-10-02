import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ToolStatus } from '../entities/tool.entity';

export class QueryToolsDto {
  @IsOptional() @IsString()
  department?: string;

  @IsOptional() @IsEnum(ToolStatus)
  status?: ToolStatus;

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  min_cost?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  max_cost?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;

  @IsOptional() @IsIn(['name', 'monthly_cost', 'created_at'])
  sort_by?: 'name' | 'monthly_cost' | 'created_at';

  @IsOptional() @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}