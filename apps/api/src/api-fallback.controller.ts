import { All, Controller, Module, NotFoundException, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';

/**
 * The apps are served from this same origin with a catch-all that hands back
 * index.html, which is right for a mistyped page and wrong for a mistyped API
 * path: a client asking for /api/whatever should be told no in JSON, not given
 * a web page with a 200. This claims everything left under /api so it never
 * reaches the static fallback.
 *
 * It is registered before the static apps, so every real route still wins.
 */
@ApiExcludeController()
@Controller()
export class ApiFallbackController {
  @All('*')
  notFound(@Req() request: Request): never {
    throw new NotFoundException(`No API route for ${request.method} ${request.path}`);
  }
}

@Module({ controllers: [ApiFallbackController] })
export class ApiFallbackModule {}
