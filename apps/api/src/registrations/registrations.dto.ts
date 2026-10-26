import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class RegisterDto {
  @Transform(trim)
  @IsString()
  @Length(2, 80, { message: 'Please give your full name.' })
  fullName: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Please check your email address.' })
  @MaxLength(160)
  email: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^[0-9+\-() ]{7,20}$/, { message: 'Please check your phone number.' })
  phone?: string;

  @IsIn(['CAMPUS', 'AREA', 'PRIVATE'])
  type: 'CAMPUS' | 'AREA' | 'PRIVATE';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  pickupPointId?: string;

  /** RG-4 */
  @IsBoolean()
  consentData: boolean;

  @IsBoolean()
  consentEmail: boolean;
}

/** GT-4: the walk-in lane, filled in on the attendee's own phone. */
export class WalkInDto {
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  fullName: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(160)
  email: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^[0-9+\-() ]{7,20}$/)
  phone?: string;

  @IsString()
  gateToken: string;

  @IsBoolean()
  consentData: boolean;

  @IsBoolean()
  consentEmail: boolean;
}

/** BD-5: the delegate adds someone who turned up without registering. */
export class AddToTripDto {
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  fullName: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(160)
  email: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^[0-9+\-() ]{7,20}$/)
  phone?: string;
}

/** The attendee asking for their details to be removed. */
export class ForgetMeDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(160)
  email: string;
}
