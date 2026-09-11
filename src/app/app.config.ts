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
import { GitHubIntegration } from './integrations/providers/github/github.integration';
import { OutlookIntegration } from './integrations/providers/outlook/outlook.integration';
import { WhatsAppIntegration } from './integrations/providers/whatsapp/whatsapp.integration';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAppInitializer(() => {
      const registry = inject(IntegrationRegistryService);
      const jira = inject(JiraIntegration);
      const gmail = inject(GmailIntegration);
      const github = inject(GitHubIntegration);
      const outlook = inject(OutlookIntegration);
      const whatsapp = inject(WhatsAppIntegration);
      registry.register(jira);
      registry.register(gmail);
      registry.register(github);
      registry.register(outlook);
      registry.register(whatsapp);
    }),
  ],
};

