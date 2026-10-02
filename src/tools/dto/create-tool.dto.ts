import { Transform, Type } from 'class-transformer';
import {
  IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, Length, MaxLength, Min,
} from 'class-validator';
import { Department } from '../entities/tool.entity';

const NAME_MSG = 'Name is required and must be 2-100 characters';

export class CreateToolDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: NAME_MSG }) @Length(2, 100, { message: NAME_MSG })
  name: string;

  @IsOptional() @IsString({ message: 'Must be a string' })
  description?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Vendor is required' })
  @IsNotEmpty({ message: 'Vendor is required' })
  @MaxLength(100, { message: 'Vendor must be at most 100 characters' })
  vendor: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { message: 'Must be a valid URL format' })
  website_url?: string;

  @Type(() => Number)
  @IsInt({ message: 'Must be a valid category ID' })
  @Min(1, { message: 'Must be a valid category ID' })
  category_id: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Must be a number with at most 2 decimals' })
  @Min(0, { message: 'Must be a positive number' })
  monthly_cost: number;

  @IsEnum(Department, { message: `Must be one of: ${Object.values(Department).join(', ')}` })
  owner_department: Department;
}