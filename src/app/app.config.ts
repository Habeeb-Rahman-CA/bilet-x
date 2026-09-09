import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { IntegrationRegistryService } from './integrations/core/integration-registry.service';
import { JiraIntegration } from './integrations/providers/jira/jira.integration';
import { GmailIntegration } from './integrations/providers/gmail/gmail.integration';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAppInitializer(() => {
      const registry = inject(IntegrationRegistryService);
      const jira = inject(JiraIntegration);
      const gmail = inject(GmailIntegration);
      registry.register(jira);
      registry.register(gmail);
    }),
  ],
};

