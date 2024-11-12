import { outputMarkdown } from './md'

export * from './md'

/**
 * Output log
 */
export async function output(type: 'md' | 'html' = 'md') {
  switch (type) {
    case 'md':
      await outputMarkdown()
      break
    default:
      break
  }
}
