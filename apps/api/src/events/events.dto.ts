import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** EV-1 */
export class CreateEventDto {
  @IsString()
  @Matches(/^[a-z0-9-]{3,40}$/, { message: 'Use lowercase letters, numbers and hyphens.' })
  slug: string;

  @IsString()
  @Length(2, 60)
  city: string;

  @IsString()
  @Length(2, 120)
  venue: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  doorsOpenAt: string;

  @IsDateString()
  doorsCloseAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  timezone?: string;

  @IsOptional()
  @Matches(HEX, { message: 'Use a hex colour such as #F5C400.' })
  cityColor?: string;

  @IsOptional()
  @IsUrl()
  privacyUrl?: string;
}

export class UpdateEventDto extends CreateEventDto {
  @IsOptional()
  @IsIn(['DRAFT', 'OPEN', 'CLOSED', 'LIVE', 'ENDED'])
  status?: 'DRAFT' | 'OPEN' | 'CLOSED' | 'LIVE' | 'ENDED';
}

/** EV-4 */
export class ZoneDto {
  @IsString()
  @Length(1, 2)
  letter: string;

  @IsString()
  @Length(2, 60)
  name: string;

  @Matches(HEX)
  color: string;

  @IsInt()
  @Min(1)
  @Max(100_000)
  capacity: number;
}

/** EV-2 */
export class PickupPointDto {
  @IsIn(['CAMPUS', 'AREA'])
  kind: 'CAMPUS' | 'AREA';

  @IsString()
  @Length(2, 80)
  name: string;

  @IsString()
  @Length(2, 200)
  address: string;

  @IsDateString()
  departsAt: string;

  @IsOptional()
  @IsString()
  zoneId?: string;
}

/** EV-3 */
export class BusDto {
  @IsString()
  @Length(1, 12)
  code: string;

  @IsInt()
  @Min(1)
  @Max(200)
  capacity: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  plate?: string;
}

export class TripDto {
  @IsString()
  @Length(1, 12)
  code: string;

  @IsString()
  busId: string;

  @IsString()
  pickupPointId: string;

  @IsInt()
  @Min(1)
  @Max(200)
  capacity: number;

  @IsDateString()
  departsAt: string;

  @IsOptional()
  @IsString()
  delegateId?: string;

  @IsOptional()
  @IsUrl()
  whatsappUrl?: string;
}

export class GateDto {
  @IsString()
  @Length(1, 40)
  name: string;
}

/** EV-5 */
export class InviteDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(2, 80)
  fullName: string;

  @IsIn(['SUPER_ADMIN', 'ADMIN', 'DELEGATE', 'USHER'])
  role: 'SUPER_ADMIN' | 'ADMIN' | 'DELEGATE' | 'USHER';

  @IsOptional()
  @IsString()
  pickupPointId?: string;

  @IsOptional()
  @IsString()
  gateId?: string;

  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;
}

/** EV-6 */
export class DuplicateEventDto {
  @IsString()
  @Matches(/^[a-z0-9-]{3,40}$/)
  slug: string;

  @IsString()
  @Length(2, 60)
  city: string;

  @IsString()
  @Length(2, 120)
  venue: string;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  doorsOpenAt: string;

  @IsDateString()
  doorsCloseAt: string;

  @IsOptional()
  @Matches(HEX)
  cityColor?: string;
}

/** EV-7: rows parsed from the uploaded CSV. */
export class ImportRowDto {
  @IsIn(['CAMPUS', 'AREA'])
  kind: 'CAMPUS' | 'AREA';

  @IsString()
  pickupPoint: string;

  @IsString()
  address: string;

  @IsDateString()
  departsAt: string;

  @IsOptional()
  @IsString()
  zoneLetter?: string;

  @IsOptional()
  @IsString()
  busCode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  capacity?: number;

  @IsOptional()
  @IsString()
  tripCode?: string;

  @IsOptional()
  @IsEmail()
  delegateEmail?: string;

  @IsOptional()
  @IsString()
  delegateName?: string;
}

export class ImportDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportRowDto)
  rows: ImportRowDto[];
}
