import type { ChartBase } from './api/types'

export function chartOwners(chart: ChartBase) {
  return (
    chart.owners ?? [
      { id: chart.ownerId, nickname: chart.uploader, avatarUrl: chart.uploaderAvatarUrl },
    ]
  )
}

export function isChartOwner(chart: ChartBase, userId?: string) {
  return !!userId && (chart.ownerIds ?? [chart.ownerId]).includes(userId)
}
