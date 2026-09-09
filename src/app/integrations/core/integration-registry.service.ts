import { Injectable, signal } from '@angular/core';
import { Integration } from './integration.interface';
import { CapabilityType, IntegrationCategory } from './capabilities/capability.types';

/**
 * IntegrationRegistryService is the central catalog of available integration providers.
 * Providers register themselves here upon startup.
 * The UI and IntegrationManager discover integrations dynamically without hardcoded provider checks.
 */
@Injectable({
  providedIn: 'root',
})
export class IntegrationRegistryService {
  private providers = new Map<string, Integration>();
  public registeredProviders = signal<Integration[]>([]);

  /**
   * Register a new integration provider.
   */
  public register(integration: Integration): void {
    if (this.providers.has(integration.id)) {
      console.warn(`[IntegrationRegistry] Provider "${integration.id}" is already registered. Overwriting.`);
    }
    this.providers.set(integration.id, integration);
    this.updateSignal();
  }

  /**
   * Unregister an integration provider.
   */
  public unregister(id: string): void {
    this.providers.delete(id);
    this.updateSignal();
  }

  /**
   * Retrieve a specific integration by its unique ID.
   */
  public get(id: string): Integration | undefined {
    return this.providers.get(id);
  }

  /**
   * Get all registered integration providers.
   */
  public getAll(): Integration[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get all providers that support a specific capability (e.g. 'tasks', 'messages').
   */
  public getByCapability(capability: CapabilityType): Integration[] {
    return this.getAll().filter((p) => p.hasCapability(capability));
  }

  /**
   * Get all providers in a given category (e.g. 'communication', 'tasks').
   */
  public getByCategory(category: IntegrationCategory): Integration[] {
    return this.getAll().filter((p) => p.category === category);
  }

  /**
   * Check if any registered provider supports the capability.
   */
  public hasCapabilitySupport(capability: CapabilityType): boolean {
    return this.getAll().some((p) => p.hasCapability(capability));
  }

  private updateSignal(): void {
    this.registeredProviders.set(Array.from(this.providers.values()));
  }
}
