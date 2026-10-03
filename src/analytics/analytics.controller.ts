import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { QueryDepartmentCostsDto } from './dto/query-department-costs.dto';
import { QueryExpensiveToolsDto } from './dto/query-expensive-tools.dto';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('department-costs')
  @ApiOperation({
    summary: 'Répartition des coûts par département',
    description:
      'Outils actifs uniquement. total_cost = somme des monthly_cost. ' +
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

  @Get('expensive-tools')
  @ApiOperation({
    summary: 'Outils les plus coûteux et économies potentielles',
    description:
      'Outils actifs triés par coût décroissant. cost_per_user = monthly_cost / active_users_count (null sans utilisateur). ' +
      "efficiency_rating : cost_per_user comparé à la moyenne entreprise (< 50 % excellent, < 80 % good, <= 120 % average, sinon low ; sans utilisateur : low). " +
      'potential_savings_identified = somme des coûts des outils low parmi tous les outils analysés (avant limit).',
  })
  @ApiResponse({ status: 200, description: 'Top des outils coûteux et analyse comparative' })
  @ApiResponse({
    status: 400,
    description: 'Paramètre invalide',
    schema: { example: { error: 'Validation failed', details: { limit: 'Must be an integer between 1 and 100' } } },
  })
  @ApiResponse({
    status: 500,
    description: 'Erreur serveur',
    schema: { example: { error: 'Internal server error', message: 'Database connection failed' } },
  })
  getExpensiveTools(@Query() query: QueryExpensiveToolsDto) {
    return this.analyticsService.getExpensiveTools(query);
  }
}