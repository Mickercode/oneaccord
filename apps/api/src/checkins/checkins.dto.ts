import { IsBoolean, IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ScanDto {
  @IsString()
  @MaxLength(400)
  token: string;

  /** BD-3: when the phone does not remember them. */
  @IsOptional()
  @IsString()
  @MaxLength(16)
  passCode?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(160)
  email?: string;
}

/** BD-5: the delegate checks in someone without a phone. */
export class ByNameDto {
  @IsString()
  @MaxLength(40)
  tripId: string;

  @IsString()
  @MaxLength(40)
  registrationId: string;
}

/** GT-4: a walk-in with no registration at all. */
export class WalkInDto {
  @IsString()
  @MaxLength(400)
  token: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 80)
  fullName: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(160)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsBoolean()
  consentData: boolean;

  @IsBoolean()
  consentEmail: boolean;
}
