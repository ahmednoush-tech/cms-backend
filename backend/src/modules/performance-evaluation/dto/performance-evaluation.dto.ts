import { IsArray, IsInt, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class EvaluationScoreInputDto {
  @IsUUID()
  criterionId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  score: number;

  @IsOptional()
  @IsString()
  comments?: string;
}

export class CreatePerformanceEvaluationDto {
  @IsUUID()
  cycleId: string;

  @IsUUID()
  employeeId: string;

  @IsOptional()
  @IsString()
  overallComments?: string;

  /** Scoring every criterion at create time is NOT required — a draft can be filled in gradually across several update() calls before being finalized. */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvaluationScoreInputDto)
  scores: EvaluationScoreInputDto[];
}

/** Same shape as create — an update REPLACES the full score set (see PerformanceEvaluationsService.update()'s comment for why: a draft's scores are freely re-editable in whole, not merged field-by-field). */
export class UpdatePerformanceEvaluationDto {
  @IsOptional()
  @IsString()
  overallComments?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvaluationScoreInputDto)
  scores?: EvaluationScoreInputDto[];
}
