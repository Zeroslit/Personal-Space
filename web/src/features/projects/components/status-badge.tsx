import { STATUS_LABELS, type ProjectStatus } from '@/api/types';
import { Badge, type BadgeTone } from '@/components/ui/badge';

const TONES: Record<ProjectStatus, BadgeTone> = {
  active: 'success',
  wip: 'accent',
  idea: 'accent',
  paused: 'muted',
  archived: 'muted',
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge tone={TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
