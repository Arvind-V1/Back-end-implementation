import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { QueryDepartmentCostsDto } from './dto/query-department-costs.dto';
import { QueryExpensiveToolsDto } from './dto/query-expensive-tools.dto';
import { QueryLowUsageToolsDto } from './dto/query-low-usage-tools.dto';

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

  @Get('tools-by-category')
  @ApiOperation({
    summary: 'Répartition des outils par catégorie',
    description:
      'Outils actifs. total_users = somme des active_users_count (sans dédoublonnage). ' +
      'average_cost_per_user = total_cost / total_users (null sans utilisateur). ' +
      'most_efficient_category = plus bas average_cost_per_user, catégories sans utilisateur exclues. ' +
      'Les pourcentages totalisent 100. Toutes les catégories sont listées.',
  })
  @ApiResponse({ status: 200, description: 'Données par catégorie et insights' })
  @ApiResponse({
    status: 500,
    description: 'Erreur serveur',
    schema: { example: { error: 'Internal server error', message: 'Database connection failed' } },
  })
  getToolsByCategory() {
    return this.analyticsService.getToolsByCategory();
  }

  @Get('low-usage-tools')
  @ApiOperation({
    summary: 'Outils sous-utilisés et économies potentielles',
    description:
      'Outils actifs avec active_users_count <= max_users (défaut 5, outils sans utilisateur inclus). ' +
      'warning_level d\'après cost_per_user : < 20 low, 20 à 50 medium, > 50 high ; sans utilisateur : high. ' +
      'potential_monthly_savings = somme des coûts des outils high et medium ; potential_annual_savings = × 12.',
  })
  @ApiResponse({ status: 200, description: 'Outils sous-utilisés et analyse des économies' })
  @ApiResponse({
    status: 400,
    description: 'max_users invalide',
    schema: { example: { error: 'Validation failed', details: { max_users: 'Must be a non-negative integer' } } },
  })
  @ApiResponse({
    status: 500,
    description: 'Erreur serveur',
    schema: { example: { error: 'Internal server error', message: 'Database connection failed' } },
  })
  getLowUsageTools(@Query() query: QueryLowUsageToolsDto) {
    return this.analyticsService.getLowUsageTools(query);
  }

  @Get('vendor-summary')
  @ApiOperation({
    summary: 'Synthèse par fournisseur',
    description:
      'Outils actifs groupés par vendor : coût total, utilisateurs, départements (uniques, ordre alphabétique) et coût moyen par utilisateur. ' +
      'vendor_efficiency : < 5 excellent, 5 à < 15 good, 15 à 25 average, > 25 poor ; sans utilisateur : poor. ' +
      'single_tool_vendors = vendors avec exactement 1 outil actif (opportunités de consolidation).',
  })
  @ApiResponse({ status: 200, description: 'Synthèse par vendor et insights comparatifs' })
  @ApiResponse({
    status: 500,
    description: 'Erreur serveur',
    schema: { example: { error: 'Internal server error', message: 'Database connection failed' } },
  })
  getVendorSummary() {
    return this.analyticsService.getVendorSummary();
  }
}