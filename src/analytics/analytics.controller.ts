import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { QueryDepartmentCostsDto } from './dto/query-department-costs.dto';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('department-costs')
  @ApiOperation({
    summary: 'Répartition des coûts par département',
    description:
      'Outils actifs uniquement. total_cost = somme de monthly_cost × active_users_count. ' +
      'Les pourcentages totalisent 100. Tous les départements sont listés, même sans outil actif.',
  })
  @ApiResponse({ status: 200, description: 'Données par département et résumé entreprise' })
  @ApiResponse({
    status: 400,
    description: 'Paramètre de tri invalide',
    schema: { example: { error: 'Validation failed', details: { sort_by: 'Must be one of: total_cost, department, tools_count, total_users' } } },
  })
  @ApiResponse({
    status: 500,
    description: 'Erreur serveur',
    schema: { example: { error: 'Internal server error', message: 'Database connection failed' } },
  })
  getDepartmentCosts(@Query() query: QueryDepartmentCostsDto) {
    return this.analyticsService.getDepartmentCosts(query);
  }
}