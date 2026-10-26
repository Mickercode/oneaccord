import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { TeamRole } from '@oa/types';
import { CookiesService } from './cookies.service';
import { PrismaService } from './prisma.service';

export interface TeamPrincipal {
  id: string;
  email: string;
  fullName: string;
  role: TeamRole;
  pickupPointIds: string[];
  gateIds: string[];
  eventIds: string[];
}

export const ROLES_KEY = 'oa:roles';
export const Roles = (...roles: TeamRole[]) => SetMetadata(ROLES_KEY, roles);

export const Team = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TeamPrincipal => {
    const request = context.switchToHttp().getRequest<Request & { team?: TeamPrincipal }>();
    if (!request.team) throw new UnauthorizedException('Please sign in again.');
    return request.team;
  },
);

@Injectable()
export class TeamGuard implements CanActivate {
  constructor(
    private readonly cookies: CookiesService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { team?: TeamPrincipal }>();
    const session = this.cookies.readTeam(request);
    if (!session) throw new UnauthorizedException('Please sign in again.');

    const member = await this.prisma.teamMember.findUnique({
      where: { id: session.sub },
      include: { assignments: true },
    });
    if (!member || !member.active)
      throw new UnauthorizedException('This account is no longer active.');

    const principal: TeamPrincipal = {
      id: member.id,
      email: member.email,
      fullName: member.fullName,
      role: member.role as TeamRole,
      pickupPointIds: member.assignments
        .map((a) => a.pickupPointId)
        .filter((v): v is string => !!v),
      gateIds: member.assignments.map((a) => a.gateId).filter((v): v is string => !!v),
      eventIds: [...new Set(member.assignments.map((a) => a.eventId))],
    };
    request.team = principal;

    const allowed = this.reflector.getAllAndOverride<TeamRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed && allowed.length > 0 && !allowed.includes(principal.role)) {
      throw new ForbiddenException('That is not yours to do.');
    }
    return true;
  }
}

/** Admins and super admins may act anywhere; delegates and ushers only where they are posted. */
export function worksAtPickupPoint(team: TeamPrincipal, pickupPointId: string): boolean {
  if (team.role === 'ADMIN' || team.role === 'SUPER_ADMIN') return true;
  return team.pickupPointIds.includes(pickupPointId);
}

export function worksAtGate(team: TeamPrincipal, gateId: string): boolean {
  if (team.role === 'ADMIN' || team.role === 'SUPER_ADMIN') return true;
  return team.gateIds.includes(gateId);
}
