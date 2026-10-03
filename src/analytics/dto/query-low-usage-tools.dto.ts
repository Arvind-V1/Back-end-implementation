import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class QueryLowUsageToolsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Must be a non-negative integer' })
  @Min(0, { message: 'Must be a non-negative integer' })
  max_users?: number;
}