import { IsIn, IsOptional, IsString } from "class-validator";

const ALLOWED_SCENES = [
  "default",
  "tech",
  "edu",
  "soe",
  "finance",
  "research",
] as const;

export class CreateSessionDto {
  @IsString()
  meetingId: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_SCENES)
  scene?: string;
}

export class UploadAudioChunkDto {
  @IsString()
  chunk: string;
}

export class AskQuestionDto {
  @IsString()
  question: string;
}

export class VisualizationOptionConfirmDto {
  @IsString()
  optionId: string;
}
