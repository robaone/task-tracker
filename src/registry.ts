import { TaskProvider } from './provider'

export type ProviderConfig = Record<string, unknown>

export type ProviderFactory = (config?: ProviderConfig) => TaskProvider

const registry = new Map<string, ProviderFactory>()

export function registerProvider(name: string, factory: ProviderFactory): void {
  registry.set(name, factory)
}

export function createProvider(name: string, config?: ProviderConfig): TaskProvider {
  const factory = registry.get(name)
  if (!factory) {
    throw new Error(`Unknown provider: "${name}". Available providers: ${[...registry.keys()].join(', ')}`)
  }
  return factory(config)
}

export function getRegisteredProviders(): string[] {
  return [...registry.keys()]
}
