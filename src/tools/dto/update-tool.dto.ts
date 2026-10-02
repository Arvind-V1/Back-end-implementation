import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateToolDto } from './create-tool.dto';
import { ToolStatus } from '../entities/tool.entity';

export class UpdateToolDto extends PartialType(CreateToolDto) {
  @IsOptional() @IsEnum(ToolStatus, { message: 'Must be one of: active, deprecated, trial' })
  status?: ToolStatus;
}