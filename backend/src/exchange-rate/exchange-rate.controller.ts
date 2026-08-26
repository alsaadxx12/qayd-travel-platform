import { Controller, Get, Query } from '@nestjs/common';
import { ExchangeRateService } from './exchange-rate.service';

@Controller('exchange-rate')
export class ExchangeRateController {
  constructor(private readonly service: ExchangeRateService) {}

  /** Get live rates (proxy to iraqborsa.com) */
  @Get()
  async getExchangeRate() {
    try {
      const data = await this.service.fetchLiveRates();
      void this.service.saveSnapshot(data);
      return data;
    } catch (error: any) {
      return { error: error.message || 'Failed to fetch exchange rate', statusCode: 502 };
    }
  }

  /** Get historical snapshots: ?period=TODAY|WEEK|MONTH|3MONTHS|YEAR */
  @Get('history')
  async getHistory(@Query('period') period: string) {
    const valid = ['TODAY', 'WEEK', 'MONTH', '3MONTHS', 'YEAR'];
    const p = (valid.includes(period?.toUpperCase()) ? period.toUpperCase() : 'WEEK') as 'TODAY' | 'WEEK' | 'MONTH' | '3MONTHS' | 'YEAR';
    return this.service.getHistory(p);
  }

  /** Run AI Market Intelligence Advisor powered by OpenAI */
  @Get('ai-advisor')
  async getAIAdvisor(
    @Query('period') period?: string,
    @Query('adoptedRate') adoptedRate?: string,
  ) {
    const p = (['TODAY', 'WEEK', 'MONTH'].includes(period?.toUpperCase() || '') ? period?.toUpperCase() : 'WEEK') as 'TODAY' | 'WEEK' | 'MONTH';
    const rateNum = adoptedRate ? parseFloat(adoptedRate) : undefined;
    return this.service.getAIAdvisorAnalysis(rateNum, p);
  }
}
