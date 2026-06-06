import {
  analyticsRepository,
  AnalyticsDateRange,
} from '../../repositories/analytics.repository';

export class AnalyticsService {
  async getDashboard(range: AnalyticsDateRange = {}) {
    const [overview, sentimentBreakdown, dailyCallVolume] = await Promise.all([
      analyticsRepository.getOverview(range),
      analyticsRepository.getSentimentBreakdown(range),
      analyticsRepository.getDailyCallVolume(range),
    ]);

    return {
      overview,
      sentimentBreakdown,
      dailyCallVolume,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const analyticsService = new AnalyticsService();
