import {
  type ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { MarketFeedService } from '@core/feed/market-feed.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Start the producer at boot, whichever page the user opens first.
    provideAppInitializer((): void => {
      inject(MarketFeedService);
    }),
  ],
};
