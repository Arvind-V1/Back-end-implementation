import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateToolDto } from './dto/create-tool.dto';
import { QueryToolsDto } from './dto/query-tools.dto';
import { UpdateToolDto } from './dto/update-tool.dto';
import { ToolsService } from './tools.service';

const validationError = {
  error: 'Validation failed',
  details: { name: 'Name is required and must be 2-100 characters' },
};
const toolNotFound = { error: 'Tool not found', message: 'Tool with ID 999 does not exist' };
const serverError = { error: 'Internal server error', message: 'Database connection failed' };

@ApiTags('tools')
@Controller('tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister les outils',
    description: 'Filtres combinables (département, statut, catégorie, coût), pagination et tri.',
  })
  @ApiResponse({ status: 200, description: 'Liste paginée. Sans résultat : data vide et filtered à 0.' })
  @ApiResponse({ status: 400, description: 'Paramètre invalide', schema: { example: validationError } })
  @ApiResponse({ status: 500, description: 'Erreur serveur', schema: { example: serverError } })
  findAll(@Query() query: QueryToolsDto) {
    return this.toolsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: "Détail d'un outil",
    description: 'Inclut total_monthly_cost et les métriques d\'usage des 30 derniers jours.',
  })
  @ApiResponse({ status: 200, description: 'Outil trouvé' })
  @ApiResponse({ status: 400, description: 'ID non numérique' })
  @ApiResponse({ status: 404, description: 'Outil inexistant', schema: { example: toolNotFound } })
  @ApiResponse({ status: 500, description: 'Erreur serveur', schema: { example: serverError } })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.toolsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Créer un outil', description: 'Créé avec le statut active et 0 utilisateur actif.' })
  @ApiResponse({ status: 201, description: 'Outil créé' })
  @ApiResponse({ status: 400, description: 'Validation échouée ou catégorie inexistante', schema: { example: validationError } })
  @ApiResponse({ status: 409, description: 'Un outil porte déjà ce nom' })
  @ApiResponse({ status: 500, description: 'Erreur serveur', schema: { example: serverError } })
  create(@Body() createToolDto: CreateToolDto) {
    return this.toolsService.create(createToolDto);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Mettre à jour un outil',
    description: 'Mise à jour partielle : les champs non fournis sont conservés.',
  })
  @ApiResponse({ status: 200, description: 'Outil mis à jour' })
  @ApiResponse({ status: 400, description: 'Validation échouée ou body vide', schema: { example: validationError } })
  @ApiResponse({ status: 404, description: 'Outil inexistant', schema: { example: toolNotFound } })
  @ApiResponse({ status: 409, description: 'Un autre outil porte déjà ce nom' })
  @ApiResponse({ status: 500, description: 'Erreur serveur', schema: { example: serverError } })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateToolDto: UpdateToolDto) {
    return this.toolsService.update(id, updateToolDto);
  }
}