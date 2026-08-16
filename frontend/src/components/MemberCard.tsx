import { Avatar, Text, UnstyledButton } from '@mantine/core';

import type { Employee, Skill } from '../types/api';
import { formatHours } from '../utils/dates';

/** How completely a member's month is accounted for. Drives the card rail. */
export type CoverageState = 'complete' | 'partial' | 'critical' | 'none';

export interface MemberOverview {
  member: Employee;
  /** Mon-Fri days in the month that are not holidays. */
  expectedDays: number;
  loggedDays: number;
  missingDays: number;
  /** Project hours for the month, from the projects-summary rollup. */
  hours: number;
  mainProjects: string[];
  supportProjects: string[];
  skills: Skill[];
}

export function coverageState(overview: MemberOverview): CoverageState {
  if (overview.expectedDays === 0) return 'none';
  if (overview.missingDays === 0) return 'complete';
  return overview.loggedDays / overview.expectedDays >= 0.75 ? 'partial' : 'critical';
}

const SKILL_PIPS = 5;

function SkillPips({ level }: { level: number }) {
  const filled = Math.max(0, Math.min(SKILL_PIPS, Math.round(level)));
  return (
    <span className="skill-pips" aria-label={`Level ${filled} of ${SKILL_PIPS}`}>
      {Array.from({ length: SKILL_PIPS }, (_, index) => (
        <span key={index} className="skill-pip" data-on={index < filled} />
      ))}
    </span>
  );
}

export function MemberCard({
  overview,
  index,
  selected,
  onSelect,
}: {
  overview: MemberOverview;
  index: number;
  selected: boolean;
  onSelect: (member: Employee) => void;
}) {
  const { member, expectedDays, loggedDays, missingDays, hours, mainProjects, supportProjects, skills } = overview;
  const state = coverageState(overview);
  const percent = expectedDays ? Math.round((loggedDays / expectedDays) * 100) : 0;
  const name = member.name ?? member.id;

  return (
    <UnstyledButton
      className="member-card"
      data-state={state}
      data-selected={selected}
      // Cap the stagger so the last card in a 25-member roster is not left
      // waiting two seconds to appear.
      style={{ '--card-delay': `${Math.min(index, 12) * 28}ms` } as React.CSSProperties}
      onClick={() => onSelect(member)}
      aria-label={`${name}. ${loggedDays} of ${expectedDays} days logged, ${missingDays} missing.`}
    >
      <div className="member-identity">
        <Avatar src={member.avatar_url} radius="xl" size={40} color="indigo">
          {name.slice(0, 1)}
        </Avatar>
        <div className="member-identity-copy">
          <div className="member-name" title={name}>{name}</div>
          <div className="member-position" title={member.position ?? ''}>
            {member.position ?? 'Position not set'}
          </div>
          <Text size="xs" c="dimmed" mt={2}>ID {member.staff_id ?? member.id}</Text>
        </div>
      </div>

      <div className="coverage-block">
        <div className="coverage-head">
          <span className="micro-label">Coverage</span>
          <span className="coverage-count">
            {expectedDays ? `${loggedDays} / ${expectedDays} days` : 'No working days'}
          </span>
        </div>
        <div
          className="coverage-track"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="coverage-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="member-stats">
        <div>
          <div className="micro-label">Hours</div>
          <div className="member-stat-value">{formatHours(hours)}</div>
        </div>
        <div>
          <div className="micro-label">Missing</div>
          <div className="member-stat-value" data-tone={missingDays === 0 ? 'complete' : 'critical'}>
            {missingDays === 0 ? 'None' : `${missingDays} days`}
          </div>
        </div>
      </div>

      <div className="member-meta">
        <div className="member-meta-row">
          <span className="micro-label">Main</span>
          <span className="member-meta-value" title={mainProjects.join(', ')}>
            {mainProjects.length ? mainProjects.join(', ') : '—'}
          </span>
        </div>
        <div className="member-meta-row">
          <span className="micro-label">Support</span>
          <span className="member-meta-value" title={supportProjects.join(', ')}>
            {supportProjects.length ? supportProjects.join(', ') : '—'}
          </span>
        </div>
        {skills.slice(0, 2).map((skill, index) => (
          <div key={skill.id} className="member-meta-row">
            <span className="micro-label">{index === 0 ? 'Skills' : ''}</span>
            <span className="skill-row">
              <span className="member-meta-value" title={skill.name}>{skill.name}</span>
              <SkillPips level={skill.level} />
            </span>
          </div>
        ))}
      </div>
    </UnstyledButton>
  );
}
