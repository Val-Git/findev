import { AsyncPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MarketFeedService } from '@core/feed/market-feed.service';
import { CentsCurrencyPipe } from '@shared/pipes/cents-currency.pipe';
import { ImbalancePipe } from '@shared/pipes/imbalance.pipe';

@Component({
  imports: [AsyncPipe, DecimalPipe, CentsCurrencyPipe, ImbalancePipe],
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './dashboard.component.scss',
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private readonly feed = inject(MarketFeedService);

  protected readonly rows$ = this.feed.rows$;
  protected readonly status$ = this.feed.status$;
  protected readonly error$ = this.feed.error$;

  protected pause(): void {
    this.feed.pause();
  }

  protected resume(): void {
    this.feed.resume();
  }
}
