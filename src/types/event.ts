import type { Request, Response } from 'playwright'

export interface PageUrlEvent {
  request: Request
  response?: Response
}

export type UrlMap = Map<string, PageUrlEvent>
