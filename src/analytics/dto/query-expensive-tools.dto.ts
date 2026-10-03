import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class QueryExpensiveToolsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Must be a positive number' })
  @Min(0, { message: 'Must be a positive number' })
  min_cost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Must be positive integer between 1 and 100' })
  @Min(1, { message: 'Must be positive integer between 1 and 100' })
  @Max(100, { message: 'Must be positive integer between 1 and 100' })
  limit?: number;
}